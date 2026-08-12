// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test, console } from "forge-std/Test.sol";
import { RelayPayInvoiceRegistry } from "../src/RelayPayInvoiceRegistry.sol";
import { IRelayPay } from "../src/interfaces/IRelayPay.sol";
import { IFlareDataConnector } from "../src/interfaces/IFlareDataConnector.sol";
import { MockFdcVerification } from "../src/mocks/MockFdcVerification.sol";
import { MockFtsoV2 } from "../src/mocks/MockFtsoV2.sol";

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
    string public merchantXrplAddr = "rMerchantAccountAddress123456";
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
    }

    function testCreateInvoiceFixedXrp() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            100_000_000, // 100 XRP drops
            900,         // 15 mins
            merchantXrplAddr,
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
            keccak256("ORDER-FTSO")
        );

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        // 1000 cents * 10000 * 10^4 / 50000 = 20,000,000 drops (20 XRP)
        assertEq(inv.requiredAmountDrops, 20_000_000);
    }

    function testExactPaymentFulfillment() public {
        vm.startPrank(merchant);
        registry.registerMerchantCallback(address(merchantCallback));
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            50_000_000, // 50 XRP
            900,
            merchantXrplAddr,
            keccak256("DIGITAL-PRODUCT")
        );
        vm.stopPrank();

        // Prepare FDC Attestation proof
        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-1"),
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress987654",
            destinationAddress: merchantXrplAddr,
            amountDrops: 50_000_000,
            memoHash: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.FULFILLED));
        assertEq(inv.buyer, buyer);
        assertTrue(merchantCallback.fulfilledCalled());
        assertEq(merchantCallback.lastInvoiceId(), invoiceId);
        assertTrue(registry.processedTxHashes(keccak256("XRPL-TX-1")));
    }

    function testUnderpaymentAndTopup() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            100_000_000, // 100 XRP drops
            900,
            merchantXrplAddr,
            keccak256("ORDER-UNDERPAY")
        );

        // First payment: only 40 XRP drops
        IFlareDataConnector.PaymentAttestation memory proof1;
        proof1.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-PARTIAL-1"),
            blockNumber: 1001,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 40_000_000,
            memoHash: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success1 = registry.verifyAndFulfill(invoiceId, proof1);
        assertFalse(success1); // Partial payment returns false

        IRelayPay.Invoice memory inv1 = registry.getInvoice(invoiceId);
        assertEq(uint8(inv1.status), uint8(IRelayPay.InvoiceStatus.UNDERPAID));
        assertEq(inv1.paidAmountDrops, 40_000_000);

        // Topup payment: remaining 60 XRP drops
        IFlareDataConnector.PaymentAttestation memory proof2;
        proof2.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-PARTIAL-2"),
            blockNumber: 1002,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 60_000_000,
            memoHash: invoiceId,
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
            10_000_000, // 10 XRP
            900,
            merchantXrplAddr,
            keccak256("ORDER-OVERPAY")
        );

        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-OVERPAY"),
            blockNumber: 1005,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 15_000_000, // Paid 15 XRP
            memoHash: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        IRelayPay.Invoice memory inv = registry.getInvoice(invoiceId);
        assertEq(uint8(inv.status), uint8(IRelayPay.InvoiceStatus.OVERPAID_FULFILLED));
        assertEq(inv.paidAmountDrops, 15_000_000);
    }

    function testLatePaymentRecording() public {
        vm.prank(merchant);
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            10_000_000,
            300, // Expiration in 300s
            merchantXrplAddr,
            keccak256("ORDER-LATE")
        );

        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-LATE"),
            blockNumber: 2000,
            blockTimestamp: uint64(block.timestamp + 400), // Paid after expiration
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 10_000_000,
            memoHash: invoiceId,
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
            keccak256("ORDER-REPLAY")
        );

        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-DUPLICATE"),
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 10_000_000,
            memoHash: invoiceId,
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
            keccak256("ORDER-WRONG-MEMO")
        );

        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-WRONG-MEMO"),
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: merchantXrplAddr,
            amountDrops: 10_000_000,
            memoHash: keccak256("RANDOM-MEMO"),
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
            keccak256("ORDER-WRONG-DEST")
        );

        IFlareDataConnector.PaymentAttestation memory proof;
        proof.response = IFlareDataConnector.PaymentResponse({
            transactionHash: keccak256("XRPL-TX-WRONG-DEST"),
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddress: "rBuyerAddress",
            destinationAddress: "rAttackerAddress999999",
            amountDrops: 10_000_000,
            memoHash: invoiceId,
            status: true
        });

        vm.expectRevert("RelayPay: Destination address mismatch");
        vm.prank(buyer);
        registry.verifyAndFulfill(invoiceId, proof);
    }
}
