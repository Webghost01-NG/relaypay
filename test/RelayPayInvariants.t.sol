// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RelayPayInvoiceRegistry} from "../src/RelayPayInvoiceRegistry.sol";
import {IRelayPay} from "../src/interfaces/IRelayPay.sol";
import {Payment} from "../src/interfaces/IFlareDataConnector.sol";
import {MockFdcVerification} from "../src/mocks/MockFdcVerification.sol";
import {MockFtsoV2} from "../src/mocks/MockFtsoV2.sol";
import {RelayPayReceipt} from "../src/RelayPayReceipt.sol";

/**
 * @title RelayPayHandler
 * @notice Handler contract driving randomized state transitions for invariant testing
 */
contract RelayPayHandler is Test {
    RelayPayInvoiceRegistry public registry;
    MockFdcVerification public mockFdc;
    MockFtsoV2 public mockFtso;

    address public merchant = address(0x1111);
    address public buyer = address(0x2222);
    string public merchantXrplAddr = "rInvariantMerchantAddr";
    bytes32 public receivingHash;

    bytes32[] public invoiceIds;
    uint64 public currentBlockNumber = 1000;
    uint64 public currentTimestamp = 10000;

    constructor(address _registry, address _mockFdc, address _mockFtso) {
        registry = RelayPayInvoiceRegistry(_registry);
        mockFdc = MockFdcVerification(_mockFdc);
        mockFtso = MockFtsoV2(_mockFtso);
        receivingHash = keccak256(bytes(merchantXrplAddr));
    }

    function createInvoice(uint256 amountDrops, uint64 duration) external {
        amountDrops = bound(amountDrops, 1_000_000, 100_000_000_000); // 1 XRP to 100,000 XRP
        duration = uint64(bound(duration, 60, 86400));

        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            amountDrops, duration, merchantXrplAddr, address(0), keccak256(abi.encodePacked(invoiceIds.length))
        );

        invoiceIds.push(invoiceId);
    }

    function payInvoice(uint256 invoiceIndex, uint256 payAmountDrops, uint64 timeDelta) external {
        if (invoiceIds.length == 0) return;
        invoiceIndex = invoiceIndex % invoiceIds.length;
        bytes32 invoiceId = invoiceIds[invoiceIndex];

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        if (inv.status != IRelayPay.InvoiceStatus.PENDING && inv.status != IRelayPay.InvoiceStatus.UNDERPAID) {
            return;
        }

        payAmountDrops = bound(payAmountDrops, 100_000, 200_000_000_000);
        timeDelta = uint64(bound(timeDelta, 0, 3600));

        currentBlockNumber++;
        currentTimestamp += timeDelta;

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: currentBlockNumber,
            blockTimestamp: currentTimestamp,
            sourceAddressHash: keccak256(abi.encodePacked("rBuyer", currentBlockNumber)),
            receivingAddressHash: receivingHash,
            spentAmount: int256(payAmountDrops),
            receivedAmount: int256(payAmountDrops),
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        try registry.verifyAndFulfill(invoiceId, proof) {} catch {}
    }

    function cancelInvoice(uint256 invoiceIndex) external {
        if (invoiceIds.length == 0) return;
        invoiceIndex = invoiceIndex % invoiceIds.length;
        bytes32 invoiceId = invoiceIds[invoiceIndex];

        vm.prank(merchant);
        try registry.cancelInvoice(invoiceId) {} catch {}
    }

    function getInvoiceCount() external view returns (uint256) {
        return invoiceIds.length;
    }
}

contract RelayPayInvariantTest is Test {
    RelayPayInvoiceRegistry public registry;
    MockFdcVerification public mockFdc;
    MockFtsoV2 public mockFtso;
    RelayPayHandler public handler;

    function setUp() public {
        mockFdc = new MockFdcVerification();
        mockFtso = new MockFtsoV2(5000, 4);
        registry = new RelayPayInvoiceRegistry(address(mockFdc), address(mockFtso), bytes21("XRP/USD"));

        handler = new RelayPayHandler(address(registry), address(mockFdc), address(mockFtso));

        targetContract(address(handler));
    }

    /**
     * @notice Invariant 1: FULFILLED invoices MUST have paidAmountDrops >= requiredAmountDrops
     */
    function invariant_fulfilledInvoicesMustBePaidInFull() public view {
        uint256 count = handler.getInvoiceCount();
        for (uint256 i = 0; i < count; i++) {
            bytes32 invoiceId = handler.invoiceIds(i);
            IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);

            if (
                inv.status == IRelayPay.InvoiceStatus.FULFILLED
                    || inv.status == IRelayPay.InvoiceStatus.OVERPAID_FULFILLED
            ) {
                assertTrue(
                    inv.paidAmountDrops >= inv.requiredAmountDrops,
                    "INVARIANT VIOLATED: Fulfilled invoice has insufficient paid drops"
                );
            }
        }
    }

    /**
     * @notice Invariant 2: FULFILLED invoices MUST have a valid receipt NFT minted to buyer
     */
    function invariant_fulfilledInvoicesMustHaveReceiptNFT() public view {
        uint256 count = handler.getInvoiceCount();
        RelayPayReceipt receipt = registry.receiptContract();

        for (uint256 i = 0; i < count; i++) {
            bytes32 invoiceId = handler.invoiceIds(i);
            IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);

            if (
                inv.status == IRelayPay.InvoiceStatus.FULFILLED
                    || inv.status == IRelayPay.InvoiceStatus.OVERPAID_FULFILLED
            ) {
                assertTrue(inv.receiptTokenId > 0, "INVARIANT VIOLATED: Receipt NFT ID is zero");
                assertEq(
                    receipt.ownerOf(inv.receiptTokenId),
                    handler.buyer(),
                    "INVARIANT VIOLATED: Receipt NFT owner mismatch"
                );
            }
        }
    }

    /**
     * @notice Invariant 3: CANCELLED invoices MUST remain CANCELLED and never become FULFILLED
     */
    function invariant_cancelledInvoicesStayCancelled() public view {
        uint256 count = handler.getInvoiceCount();
        for (uint256 i = 0; i < count; i++) {
            bytes32 invoiceId = handler.invoiceIds(i);
            IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);

            if (inv.status == IRelayPay.InvoiceStatus.CANCELLED) {
                assertEq(inv.paidAmountDrops, 0, "INVARIANT VIOLATED: Cancelled invoice has paid drops");
            }
        }
    }
}
