// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RelayPayInvoiceRegistry} from "../src/RelayPayInvoiceRegistry.sol";
import {IRelayPay} from "../src/interfaces/IRelayPay.sol";
import {Payment} from "../src/interfaces/IFlareDataConnector.sol";
import {MockFdcVerification} from "../src/mocks/MockFdcVerification.sol";
import {MockFtsoV2} from "../src/mocks/MockFtsoV2.sol";

contract RelayPayFuzzTest is Test {
    RelayPayInvoiceRegistry public registry;
    MockFdcVerification public mockFdc;
    MockFtsoV2 public mockFtso;

    address public merchant = address(0x1111);
    address public buyer = address(0x2222);
    string public merchantXrplAddr = "rMerchantFuzzAddress12345";
    bytes32 public receivingHash;
    bytes21 public xrpFeedId = bytes21("XRP/USD");

    function setUp() public {
        mockFdc = new MockFdcVerification();
        mockFtso = new MockFtsoV2(5000, 4); // $0.50
        registry = new RelayPayInvoiceRegistry(address(mockFdc), address(mockFtso), xrpFeedId);
        receivingHash = keccak256(bytes(merchantXrplAddr));
    }

    function testFuzz_CreateInvoiceFixedXrp(uint256 requiredDrops, uint64 durationSeconds, bytes32 payloadHash) public {
        vm.assume(requiredDrops > 0 && requiredDrops < 1e18);
        vm.assume(durationSeconds >= 60 && durationSeconds <= 365 days);

        vm.prank(merchant);
        bytes32 invoiceId =
            registry.createInvoiceFixedXrp(requiredDrops, durationSeconds, merchantXrplAddr, address(0), payloadHash);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.requiredAmountDrops, requiredDrops);
        assertEq(inv.expirationTimestamp, block.timestamp + durationSeconds);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.PENDING));
    }

    function testFuzz_FtsoPricingConversion(uint256 amountInUsdCents, uint256 oraclePrice, int8 decimals) public {
        vm.assume(amountInUsdCents > 0 && amountInUsdCents < 1_000_000_000); // Up to $10M
        vm.assume(oraclePrice > 0 && oraclePrice < 100_000_000); // Positive oracle price
        vm.assume(decimals >= 0 && decimals <= 8);

        mockFtso.setMockPrice(oraclePrice, decimals, block.timestamp);

        uint256 expectedDrops = (amountInUsdCents * 10000 * (10 ** uint8(decimals))) / oraclePrice;

        vm.prank(merchant);
        if (expectedDrops == 0) {
            vm.expectRevert("RelayPay: Calculated drops rounded to zero");
            registry.createInvoice(amountInUsdCents, 900, merchantXrplAddr, address(0), keccak256("FUZZ-ORDER"));
        } else {
            bytes32 invoiceId =
                registry.createInvoice(amountInUsdCents, 900, merchantXrplAddr, address(0), keccak256("FUZZ-ORDER"));

            IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
            assertEq(inv.requiredAmountDrops, expectedDrops);
        }
    }

    function testFuzz_ExactPaymentFulfillment(uint256 drops, uint64 blockOffset) public {
        vm.assume(drops > 0 && drops < 1e15);
        vm.assume(blockOffset < 900); // Paid before expiry

        vm.prank(merchant);
        bytes32 invoiceId =
            registry.createInvoiceFixedXrp(drops, 900, merchantXrplAddr, address(0), keccak256("FUZZ-EXACT"));

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 5000,
            blockTimestamp: uint64(block.timestamp + blockOffset),
            sourceAddressHash: keccak256("rBuyer"),
            receivingAddressHash: receivingHash,
            spentAmount: int256(drops),
            receivedAmount: int256(drops),
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.FULFILLED));
        assertEq(inv.paidAmountDrops, drops);
    }
}
