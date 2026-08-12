// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IRelayPay } from "./interfaces/IRelayPay.sol";
import { IFlareDataConnector } from "./interfaces/IFlareDataConnector.sol";
import { IFtsoV2 } from "./interfaces/IFtsoV2.sol";
import { IRelayPayFulfillment } from "./interfaces/IRelayPayFulfillment.sol";

/**
 * @title RelayPayInvoiceRegistry
 * @notice Core registry and state machine for non-custodial XRP merchant checkouts verified on Flare via FDC & FTSO
 */
contract RelayPayInvoiceRegistry is IRelayPay {

    // Flare System Interfaces
    IFlareDataConnector public immutable fdcVerification;
    IFtsoV2 public immutable ftsoV2;

    // FTSO Feed ID for XRP/USD
    bytes21 public immutable xrpUsdFeedId;

    // Nonce counter for unique invoice IDs
    uint256 private _nonceCounter;

    // Anti-replay storage: txHash => processed
    mapping(bytes32 => bool) public processedTxHashes;

    // Invoices storage: invoiceId => Invoice
    mapping(bytes32 => Invoice) public invoices;

    // Merchant custom fulfillment contracts: merchant => contract address
    mapping(address => address) public merchantFulfillmentContracts;

    modifier onlyMerchant(bytes32 invoiceId) {
        require(invoices[invoiceId].merchant == msg.sender, "RelayPay: Caller is not merchant");
        _;
    }

    constructor(
        address _fdcVerification,
        address _ftsoV2,
        bytes21 _xrpUsdFeedId
    ) {
        require(_fdcVerification != address(0), "RelayPay: Invalid FDC address");
        require(_ftsoV2 != address(0), "RelayPay: Invalid FTSO address");
        fdcVerification = IFlareDataConnector(_fdcVerification);
        ftsoV2 = IFtsoV2(_ftsoV2);
        xrpUsdFeedId = _xrpUsdFeedId;
    }

    /**
     * @notice Registers or updates a merchant's custom fulfillment callback contract
     * @param fulfillmentContract Address of contract implementing IRelayPayFulfillment
     */
    function registerMerchantCallback(address fulfillmentContract) external {
        merchantFulfillmentContracts[msg.sender] = fulfillmentContract;
    }

    /**
     * @notice Creates an expiring invoice with dynamic FTSO XRP/USD pricing
     * @param amountInUsdCents Price in USD cents (e.g. 4999 = $49.99)
     * @param durationSeconds Validity period in seconds (min 60s)
     * @param xrplDestinationAddress Merchant's native XRPL payment address
     * @param fulfillmentPayloadHash Hash of merchant order metadata / delivery payload
     */
    function createInvoice(
        uint256 amountInUsdCents,
        uint64 durationSeconds,
        string calldata xrplDestinationAddress,
        bytes32 fulfillmentPayloadHash
    ) external override returns (bytes32 invoiceId) {
        require(amountInUsdCents > 0, "RelayPay: Amount must be > 0");
        require(durationSeconds >= 60, "RelayPay: Duration must be >= 60s");
        require(bytes(xrplDestinationAddress).length > 0, "RelayPay: Invalid XRPL address");

        // Fetch price from FTSO v2
        (uint256 xrpPrice, int8 decimals, uint256 timestamp) = ftsoV2.getFeedValue(xrpUsdFeedId);
        require(block.timestamp - timestamp <= 600, "RelayPay: Stale FTSO price quote");
        require(xrpPrice > 0, "RelayPay: Invalid oracle price");

        // Compute required XRP drops (1 XRP = 1e6 drops)
        // Formula: (amountInUsdCents * 1e6 * 10^decimals) / (xrpPrice * 100)
        uint256 requiredDrops;
        if (decimals >= 0) {
            requiredDrops = (amountInUsdCents * 10000 * (10 ** uint8(decimals))) / xrpPrice;
        } else {
            requiredDrops = (amountInUsdCents * 10000) / (xrpPrice * (10 ** uint8(-decimals)));
        }

        invoiceId = _generateInvoiceId(msg.sender, amountInUsdCents, xrplDestinationAddress);

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            buyer: address(0),
            xrplDestinationAddress: xrplDestinationAddress,
            requiredAmountDrops: requiredDrops,
            paidAmountDrops: 0,
            creationTimestamp: uint64(block.timestamp),
            expirationTimestamp: uint64(block.timestamp + durationSeconds),
            status: InvoiceStatus.PENDING,
            fulfillmentPayloadHash: fulfillmentPayloadHash
        });

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            requiredDrops,
            uint64(block.timestamp + durationSeconds),
            xrplDestinationAddress
        );
    }

    /**
     * @notice Creates an expiring invoice with a fixed XRP drop amount
     */
    function createInvoiceFixedXrp(
        uint256 requiredAmountDrops,
        uint64 durationSeconds,
        string calldata xrplDestinationAddress,
        bytes32 fulfillmentPayloadHash
    ) external override returns (bytes32 invoiceId) {
        require(requiredAmountDrops > 0, "RelayPay: Required drops must be > 0");
        require(durationSeconds >= 60, "RelayPay: Duration must be >= 60s");
        require(bytes(xrplDestinationAddress).length > 0, "RelayPay: Invalid XRPL address");

        invoiceId = _generateInvoiceId(msg.sender, requiredAmountDrops, xrplDestinationAddress);

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            buyer: address(0),
            xrplDestinationAddress: xrplDestinationAddress,
            requiredAmountDrops: requiredAmountDrops,
            paidAmountDrops: 0,
            creationTimestamp: uint64(block.timestamp),
            expirationTimestamp: uint64(block.timestamp + durationSeconds),
            status: InvoiceStatus.PENDING,
            fulfillmentPayloadHash: fulfillmentPayloadHash
        });

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            requiredAmountDrops,
            uint64(block.timestamp + durationSeconds),
            xrplDestinationAddress
        );
    }

    /**
     * @notice Verifies FDC attestation proof and fulfills invoice exactly once
     */
    function verifyAndFulfill(
        bytes32 invoiceId,
        IFlareDataConnector.PaymentAttestation calldata attestationProof
    ) external override returns (bool success) {
        // 1. Verify FDC Attestation Proof
        bool isValidProof = fdcVerification.verifyPayment(attestationProof);
        require(isValidProof, "RelayPay: Invalid FDC payment proof");

        // 2. Anti-replay check (rejects recycled tx hashes immediately)
        bytes32 txHash = attestationProof.response.transactionHash;
        require(!processedTxHashes[txHash], "RelayPay: XRPL tx hash already processed");

        Invoice storage inv = invoices[invoiceId];
        require(inv.invoiceId != bytes32(0), "RelayPay: Invoice does not exist");
        require(
            inv.status == InvoiceStatus.PENDING || inv.status == InvoiceStatus.UNDERPAID,
            "RelayPay: Invoice not in payable state"
        );

        // 3. Verify destination matches merchant's XRPL address
        require(
            keccak256(bytes(attestationProof.response.destinationAddress)) == keccak256(bytes(inv.xrplDestinationAddress)),
            "RelayPay: Destination address mismatch"
        );

        // 4. Verify Invoice ID binding in XRPL Memo
        require(
            attestationProof.response.memoHash == invoiceId,
            "RelayPay: Memo invoice ID mismatch"
        );

        // Mark txHash processed to prevent replay
        processedTxHashes[txHash] = true;

        uint256 receivedDrops = attestationProof.response.amountDrops;
        uint64 txTimestamp = attestationProof.response.blockTimestamp;
        inv.paidAmountDrops += receivedDrops;

        // 5. Evaluate state machine
        if (txTimestamp > inv.expirationTimestamp) {
            inv.status = InvoiceStatus.EXPIRED_PAID;
            emit LatePaymentRecorded(invoiceId, txHash, receivedDrops);
            return false;
        }

        if (inv.paidAmountDrops < inv.requiredAmountDrops) {
            inv.status = InvoiceStatus.UNDERPAID;
            emit UnderpaymentRecorded(invoiceId, inv.requiredAmountDrops, inv.paidAmountDrops);
            return false;
        }

        if (inv.paidAmountDrops == inv.requiredAmountDrops) {
            inv.status = InvoiceStatus.FULFILLED;
        } else {
            inv.status = InvoiceStatus.OVERPAID_FULFILLED;
            emit OverpaymentRecorded(
                invoiceId,
                inv.requiredAmountDrops,
                inv.paidAmountDrops,
                inv.paidAmountDrops - inv.requiredAmountDrops
            );
        }

        // Record buyer address as msg.sender submitting the proof
        inv.buyer = msg.sender;

        emit PaymentFulfilled(invoiceId, inv.merchant, txHash, inv.paidAmountDrops, inv.status);

        // 6. Trigger merchant custom callback if registered
        address merchantContract = merchantFulfillmentContracts[inv.merchant];
        if (merchantContract != address(0)) {
            bool cbSuccess = IRelayPayFulfillment(merchantContract).onRelayPayFulfill(
                invoiceId,
                msg.sender,
                inv.paidAmountDrops,
                inv.fulfillmentPayloadHash
            );
            require(cbSuccess, "RelayPay: Merchant callback failed");
        }

        return true;
    }

    /**
     * @notice Merchant manual release for late-paid expired invoices
     */
    function forceFulfillExpired(bytes32 invoiceId) external onlyMerchant(invoiceId) {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.EXPIRED_PAID, "RelayPay: Invoice not in EXPIRED_PAID state");
        inv.status = InvoiceStatus.FULFILLED;

        emit PaymentFulfilled(invoiceId, inv.merchant, bytes32(0), inv.paidAmountDrops, inv.status);

        address merchantContract = merchantFulfillmentContracts[inv.merchant];
        if (merchantContract != address(0)) {
            IRelayPayFulfillment(merchantContract).onRelayPayFulfill(
                invoiceId,
                msg.sender,
                inv.paidAmountDrops,
                inv.fulfillmentPayloadHash
            );
        }
    }

    /**
     * @notice Cancel pending invoice
     */
    function cancelInvoice(bytes32 invoiceId) external override onlyMerchant(invoiceId) {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.PENDING, "RelayPay: Invoice cannot be cancelled");
        inv.status = InvoiceStatus.CANCELLED;
        emit InvoiceCancelled(invoiceId);
    }

    /**
     * @notice Getter for invoice
     */
    function getInvoice(bytes32 invoiceId) external view override returns (Invoice memory) {
        return invoices[invoiceId];
    }

    /**
     * @dev Generates pseudo-random unique invoiceId bound to merchant, nonce, and details
     */
    function _generateInvoiceId(
        address merchant,
        uint256 amount,
        string calldata destination
    ) private returns (bytes32) {
        _nonceCounter++;
        return keccak256(
            abi.encodePacked(
                block.chainid,
                address(this),
                merchant,
                amount,
                destination,
                block.timestamp,
                _nonceCounter
            )
        );
    }
}
