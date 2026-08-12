// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { Test } from "forge-std/Test.sol";
import { RelayPayInvoiceRegistry } from "../src/RelayPayInvoiceRegistry.sol";
import { IRelayPay } from "../src/interfaces/IRelayPay.sol";
import { Payment } from "../src/interfaces/IFlareDataConnector.sol";
import { MockFdcVerification } from "../src/mocks/MockFdcVerification.sol";
import { MockFtsoV2 } from "../src/mocks/MockFtsoV2.sol";
import { RelayPayReceipt } from "../src/RelayPayReceipt.sol";

/**
 * @title MaliciousMerchantCallback
 * @notice Attack contract attempting re-entrancy into RelayPayInvoiceRegistry during fulfillment callback
 */
contract MaliciousMerchantCallback {
    RelayPayInvoiceRegistry public registry;
    bytes32 public targetInvoiceId;
    bool public attackAttempted;
    bool public reentrancyBlocked;

    constructor(address _registry) {
        registry = RelayPayInvoiceRegistry(_registry);
    }

    function setTargetInvoice(bytes32 _invoiceId) external {
        targetInvoiceId = _invoiceId;
    }

    function onRelayPayFulfill(
        bytes32 invoiceId,
        address,
        uint256,
        bytes32
    ) external returns (bool) {
        attackAttempted = true;
        
        // Attempt re-entrant call back into registry verifyAndFulfill or cancelInvoice
        Payment.Proof memory dummyProof;
        try registry.verifyAndFulfill(invoiceId, dummyProof) {
            // Re-entrancy succeeded (VULNERABILITY)
            reentrancyBlocked = false;
        } catch {
            // Re-entrancy reverted (PROTECTED)
            reentrancyBlocked = true;
        }

        try registry.cancelInvoice(invoiceId) {
            reentrancyBlocked = false;
        } catch {
            reentrancyBlocked = true;
        }

        return true;
    }
}

contract RelayPaySecurityTest is Test {

    RelayPayInvoiceRegistry public registry;
    MockFdcVerification public mockFdc;
    MockFtsoV2 public mockFtso;
    MaliciousMerchantCallback public attackerCallback;

    address public merchant = address(0x9999);
    address public buyer = address(0x8888);
    string public merchantXrplAddr = "rMerchantAccountAddressSecurity";
    bytes32 public receivingHash;
    bytes21 public xrpFeedId = bytes21("XRP/USD");

    function setUp() public {
        mockFdc = new MockFdcVerification();
        mockFtso = new MockFtsoV2(5000, 4); // $0.50 per XRP
        registry = new RelayPayInvoiceRegistry(
            address(mockFdc),
            address(mockFtso),
            xrpFeedId
        );

        attackerCallback = new MaliciousMerchantCallback(address(registry));
        receivingHash = keccak256(bytes(merchantXrplAddr));
    }

    function testReentrancyAttackIsBlocked() public {
        vm.startPrank(merchant);
        registry.registerMerchantCallback(address(attackerCallback));
        bytes32 invoiceId = registry.createInvoiceFixedXrp(
            50_000_000,
            900,
            merchantXrplAddr,
            address(0),
            keccak256("REENTRANCY-TARGET")
        );
        vm.stopPrank();

        attackerCallback.setTargetInvoice(invoiceId);

        Payment.Proof memory proof;
        proof.response.body = Payment.ResponseBody({
            blockNumber: 1000,
            blockTimestamp: uint64(block.timestamp),
            sourceAddressHash: keccak256("rBuyerAddress"),
            receivingAddressHash: receivingHash,
            spentAmount: 50_000_000,
            receivedAmount: 50_000_000,
            standardPaymentReference: invoiceId,
            status: true
        });

        vm.prank(buyer);
        bool success = registry.verifyAndFulfill(invoiceId, proof);
        assertTrue(success);

        assertTrue(attackerCallback.attackAttempted());
        assertTrue(attackerCallback.reentrancyBlocked());
    }

    function testUnapprovedReceiptMintingReverts() public {
        // Direct caller attempting to call RelayPayReceipt.mintReceipt
        RelayPayReceipt receipt = registry.receiptContract();
        vm.expectRevert("RelayPayReceipt: Only registry can mint");
        receipt.mintReceipt(
            buyer,
            keccak256("FAKE-INVOICE"),
            merchant,
            100,
            keccak256("FAKE-TX")
        );
    }
}
