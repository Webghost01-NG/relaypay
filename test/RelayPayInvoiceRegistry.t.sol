// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { RelayPayInvoiceRegistry } from "../src/RelayPayInvoiceRegistry.sol";
import { IRelayPay } from "../src/interfaces/IRelayPay.sol";
import { Payment } from "../src/interfaces/IFlareDataConnector.sol";
import { MockFdcVerification } from "../src/mocks/MockFdcVerification.sol";
import { MockFtsoV2 } from "../src/mocks/MockFtsoV2.sol";
import { RelayPayReceipt } from "../src/RelayPayReceipt.sol";

contract MockMerchantFulfillment {
    bool public fulfilledCalled;
    bytes32 public lastInvoiceId;

    function onRelayPayFulfill(
        bytes32 invoiceId,
        address,
        uint256,
        bytes32
    ) external returns (bool) {
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
        mockFdc = new MockFdcVerification();
        // Mock XRP price = $0.5000 (5000 with 4 decimals)
        mockFtso = new MockFtsoV2(5000, 4);
        
        registry = new RelayPayInvoiceRegistry(
            address(mockFdc),
            address(mockFtso),
            xrpFeedId
        );

        merchantCallback = new MockMerchantFulfillment();
        receivingHash = keccak256(bytes(merchantXrplAddr));
    }

    function testCreateInvoiceFixedXrp() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            100_000_000, // 100 XRP drops
            900,         // 15 mins
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
        // Price = $0.50 / XRP. Order = $10.00 (1000 cents). Required XRP = 20 XRP = 20,000,000 drops
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

        // Prepare FDC Attestation proof with official Payment struct
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

        // Verify Receipt NFT owned by buyer
        RelayPayReceipt receipt = registry.receiptContract();
        assertEq(receipt.ownerOf(inv.receiptTokenId), buyer);
    }

    function testRestrictedBuyerAuthorization() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            900,
            merchantXrplAddr,
            buyer, // Restricted to buyer only
            keccak256("RESTRICTED-ORDER")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        // Unauthorized caller fails
        vm.expectRevert("RelayPay: Caller not authorized buyer");
        vm.prank(unauthorizedBuyer);
        registry.verifyAndFulfill(invoiceId, proof);

        // Authorized buyer succeeds
        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);
    }

    function testUnderpaymentAndTopup() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            100_000_000, // 100 XRP drops
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-UNDERPAY")
        );

        // First payment: only 40 XRP drops
        Payment.Proof memory proof1;
        proof1.response.body = Payment.ResponseBody({
            blockNumber: 1001,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 40_000_000,
            receivedAmount: 40_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success1 = registry.verifyAndFulfill(invoiceId, proof1);
        assertFalse(success1); // Partial payment returns false

        IRelayPay.Invoice memory inv1 = registry.getInvoice(invoiceId);
        assertEq(uint8(inv1.status), uint8(IRelayPay.InvoiceStatus.UNDERPAID));

        // Topup payment: remaining 60 XRP drops with DIFFERENT proof hash (simulating second XRPL tx)
        Payment.Proof memory proof2;
        proof2.response.body = Payment.ResponseBody({
            blockNumber: 1002,
            blockTimestamp: uint64(block.timestamp + 5),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 60_000_000,
            receivedAmount: 60_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success2 = registry.verifyAndFulfill(invoiceId, proof2);
        assertTrue(success2);

        IRelayPay.Invoice memory inv2 = registry.getInvoice(invoiceId);
        assertEq(uint8(inv2.status), uint8(IRelayPay.InvoiceStatus.FULFILLED));
        assertEq(inv2.paidAmountDrops, 100_000_000);
    }

    function testOverpaymentFulfillment() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-OVERPAY")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1005,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 15_000_000,
            receivedAmount: 15_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.OVERPAID_FULFILLED));
    }

    function testLatePaymentRecording() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            300,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-LATE")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 2000,
            blockTimestamp: uint64(block.timestamp + 400), // Paid after expiration
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertFalse(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.EXPIRED_PAID));

        // Merchant force releases late payment
        vm.prank(merchant);
        registry.forceFulfillExpired(invoiceId);

        IRelayPay.Invoice memory invAfterForce = registry.getInvoice(invoiceId);
        assertEq(uint8(invAfterForce.status), uint8(IRelayPay.InvoiceStatus.FULFILLED));
    }

    function testReplayAttackReverts() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-REPLAY")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);

        // Try submitting same proof again
        vm.expectRevert("RelayPay: XRPL tx hash already processed");
        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);
    }

    function testInvalidMemoReverts() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-WRONG-MEMO")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: keccak256("WRONG-INVOICE"),
            status: true
        });

        vm.expectRevert("RelayPay: Memo invoice ID mismatch");
        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);
    }

    function testInvalidDestinationReverts() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            900,
            merchantXrplAddr,
            address(0),
            keccak256("ORDER-WRONG-DEST")
        );

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: keccak256("rAttackerAddress"),
            spentAmount: 10_000_000,
            receivedAmount: 10_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.expectRevert("RelayPay: Destination address mismatch");
        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);
    }
}
