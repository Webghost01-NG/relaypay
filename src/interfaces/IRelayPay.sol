// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IFlareDataConnector } from "./IFlareDataConnector.sol";

/**
 * @title IRelayPay
 * @notice Interface for RelayPay XRP Checkout Protocol on Flare EVM
 */
interface IRelayPay {

    enum InvoiceStatus {
        PENDING,
        FULFILLED,
        UNDERPAID,
        OVERPAID_FULFILLED,
        EXPIRED,
        EXPIRED_PAID,
        CANCELLED
    }

    struct Invoice {
        bytes32 invoiceId;
        address merchant;
        address buyer;
        string xrplDestinationAddress;
        uint256 requiredAmountDrops; // Amount in XRP drops (1 XRP = 1,000,000 drops)
        uint256 paidAmountDrops;
        uint64 creationTimestamp;
        uint64 expirationTimestamp;
        InvoiceStatus status;
        bytes32 fulfillmentPayloadHash;
    }

    // Events
    event InvoiceCreated(
        bytes32 indexed invoiceId,
        address indexed merchant,
        uint256 requiredAmountDrops,
        uint64 expirationTimestamp,
        string xrplDestinationAddress
    );

    event PaymentFulfilled(
        bytes32 indexed invoiceId,
        address indexed merchant,
        bytes32 indexed xrplTxHash,
        uint256 paidAmountDrops,
        InvoiceStatus finalStatus
    );

    event UnderpaymentRecorded(
        bytes32 indexed invoiceId,
        uint256 requiredDrops,
        uint256 totalPaidDrops
    );

    event LatePaymentRecorded(
        bytes32 indexed invoiceId,
        bytes32 indexed xrplTxHash,
        uint256 amountDrops
    );

    event OverpaymentRecorded(
        bytes32 indexed invoiceId,
        uint256 requiredDrops,
        uint256 totalPaidDrops,
        uint256 surplusDrops
    );

    event InvoiceCancelled(bytes32 indexed invoiceId);

    // Functions
    function createInvoice(
        uint256 amountInUsdCents,
        uint64 durationSeconds,
        string calldata xrplDestinationAddress,
        bytes32 fulfillmentPayloadHash
    ) external returns (bytes32 invoiceId);

    function createInvoiceFixedXrp(
        uint256 requiredAmountDrops,
        uint64 durationSeconds,
        string calldata xrplDestinationAddress,
        bytes32 fulfillmentPayloadHash
    ) external returns (bytes32 invoiceId);

    function verifyAndFulfill(
        bytes32 invoiceId,
        IFlareDataConnector.PaymentAttestation calldata attestationProof
    ) external returns (bool success);

    function cancelInvoice(bytes32 invoiceId) external;
    function getInvoice(bytes32 invoiceId) external view returns (Invoice memory);
}
