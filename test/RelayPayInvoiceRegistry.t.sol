// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test, console} from "forge-std/Test.sol";
import {RelayPayInvoiceRegistry} from "../src/RelayPayInvoiceRegistry.sol";
import {IRelayPay} from "../src/interfaces/IRelayPay.sol";
import {Payment} from "../src/interfaces/IFlareDataConnector.sol";
import {MockFdcVerification} from "../src/mocks/MockFdcVerification.sol";
import {MockFtsoV2} from "../src/mocks/MockFtsoV2.sol";
import {RelayPayReceipt} from "../src/RelayPayReceipt.sol";

contract MockMerchantFulfillment {
    bool public fulfilledCalled;
    bytes32 public lastInvoiceId;

    function onRelayPayFulfill(bytes32 invoiceId, address, uint256, bytes32) external returns (bool) {
        fulfilledCalled = true;
        lastInvoiceId = invoiceId;
        return true;
    }
}

contract RelayPayInvoiceRegistryTest is Test {
    RelayPayInvoiceRegistry public registry;
    MockFdcVerification public mockFdc;
    MockFtsoV2 public mockFtso;
    MockMerchantFulfillment public merchantCallback;

    address public merchant = address(0x1111);
    address public buyer = address(0x2222);
    address public unauthorizedBuyer = address(0x3333);
    string public merchantXrplAddr = "rMerchantAccountAddress123456";
    bytes32 public receivingHash;
    bytes21 public xrpFeedId = bytes21("XRP/USD");

    function setUp() public {
        vm.warp(1000);
        mockFdc = new MockFdcVerification();
        // Mock XRP price = $0.5000 (5000 with 4 decimals)
        mockFtso = new MockFtsoV2(5000, 4);

        registry = new RelayPayInvoiceRegistry(address(mockFdc), address(mockFtso), xrpFeedId);

        merchantCallback = new MockMerchantFulfillment();
        receivingHash = keccak256(bytes(merchantXrplAddr));
    }

    function testCreateInvoiceFixedXrp() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            100_000_000, // 100 XRP drops
            900, // 15 mins
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-1")
        );

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.merchant, merchant);
        assertEq(inv.requiredAmountDrops, 100_000_000);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.PENDING));
        assertEq(inv.expirationTimestamp, block.timestamp + 900);
    }

    function testCreateInvoiceFtsoPricing() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoice(
            1000, // $10.00
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-FTSO")
        );

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(inv.requiredAmountDrops, 20_000_000);
    }

    function testExactPaymentFulfillmentAndReceiptMinting() public {
        vm.startPrank(merchant);
        registry.registerMerchantCallback(address(merchantCallback));
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            50_000_000, // 50 XRP
            900,
            merchantXrplAddr,
            address(0),
            keccak256("DIGITAL-PRODUCT")
        );
        vm.stopPrank();

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress987654"),
            receivingAddressHash: receivingHash,
            spentAmount: 50_000_000,
            receivedAmount: 50_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.FULFILLED));
        assertTrue(inv.receiptTokenId > 0);
        assertTrue(merchantCallback.fulfilledCalled());

        RelayPayReceipt receipt = registry.receiptContract();
        assertEq(receipt.ownerOf(inv.receiptTokenId), buyer);

        // Verify Dynamic SVG tokenURI metadata
        string memory uri = receipt.tokenURI(inv.receiptTokenId);
        assertTrue(bytes(uri).length > 0);
        assertTrue(receipt.supportsInterface(0x80ac58cd)); // IERC721
    }

    function testPreExistingPaymentReverts() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000, 900, merchantXrplAddr, address(0), keccak256("ORDER-PREEXISTING")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp - 10), // Timestamp BEFORE invoice creation
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.expectRevert("RelayPay: Payment occurred before invoice creation");
        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);
    }

    function testFeedIdFormatter() public view {
        bytes21 feedId = registry.formatCryptoFeedId("XRP/USD");
        assertEq(bytes1(feedId), bytes1(0x01)); // Category byte == 0x01
    }
}
