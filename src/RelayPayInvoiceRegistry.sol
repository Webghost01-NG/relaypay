// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import { IRelayPay } from "./interfaces/IRelayPay.sol";
import { Payment, IFdcVerification } from "./interfaces/IFlareDataConnector.sol";
import { IFtsoV2 } from "./interfaces/IFtsoV2.sol";
import { IRelayPayFulfillment } from "./interfaces/IRelayPayFulfillment.sol";
import { RelayPayReceipt } from "./RelayPayReceipt.sol";

/**
 * @title RelayPayInvoiceRegistry
 * @notice Production-grade registry & state machine for non-custodial XRP merchant checkouts verified on Flare via FDC & FTSO
 */
contract RelayPayInvoiceRegistry is IRelayPay {

    // Flare System Contracts
    IFdcVerification public immutable fdcVerification;
    IFtsoV2 public immutable ftsoV2;

    // Flare FTSO v2 Feed ID for XRP/USD
    bytes21 public immutable xrpUsdFeedId;

    // Receipt NFT Contract
    RelayPayReceipt public immutable receiptContract;

    // Nonce counter for unique invoice IDs
    uint256 private _nonceCounter;

    // Reentrancy Guard state
    uint256 private constant _NOT_ENTERED = 1;
    uint256 private constant _ENTERED = 2;
    uint256 private _reentrancyStatus = _NOT_ENTERED;

    modifier nonReentrant() {
        require(_reentrancyStatus != _ENTERED, "RelayPay: Reentrant call");
        _reentrancyStatus = _ENTERED;
        _;
        _reentrancyStatus = _NOT_ENTERED;
    }

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
        fdcVerification = IFdcVerification(_fdcVerification);
        ftsoV2 = IFtsoV2(_ftsoV2);
        xrpUsdFeedId = _xrpUsdFeedId;

        // Deploy receipt NFT contract owned by this registry
        receiptContract = new RelayPayReceipt(address(this));
    }

    /**
     * @notice Registers or updates a merchant's custom fulfillment callback contract
     */
    function registerMerchantCallback(address fulfillmentContract) external {
        merchantFulfillmentContracts[msg.sender] = fulfillmentContract;
    }

    /**
     * @notice Creates an expiring invoice with dynamic FTSO XRP/USD pricing
     */
    function createInvoice(
        uint256 amountInUsdCents,
        uint64 durationSeconds,
        string calldata xrplDestinationAddress,
        address allowedBuyer,
        bytes32 fulfillmentPayloadHash
    ) external override returns (bytes32 invoiceId) {
        require(amountInUsdCents > 0, "RelayPay: Amount must be > 0");
        require(durationSeconds >= 60, "RelayPay: Duration must be >= 60s");
        require(bytes(xrplDestinationAddress).length > 0, "RelayPay: Invalid XRPL address");

        // Fetch price from FTSO v2
        (uint256 xrpPrice, int8 decimals, uint256 timestamp) = ftsoV2.getFeedValue(xrpUsdFeedId);
        
        // Clock Skew Protection: handle timestamp drift across Flare nodes
        require(timestamp <= block.timestamp && block.timestamp - timestamp <= 600, "RelayPay: Invalid FTSO price timestamp");
        require(xrpPrice > 0, "RelayPay: Invalid oracle price");

        // Compute required XRP drops (1 XRP = 1e6 drops)
        uint256 requiredDrops;
        if (decimals >= 0) {
            require(decimals <= 18, "RelayPay: Excessive oracle decimals");
            requiredDrops = (amountInUsdCents * 10000 * (10 ** uint8(decimals))) / xrpPrice;
        } else {
            require(decimals >= -18, "RelayPay: Negative oracle decimals out of bounds");
            requiredDrops = (amountInUsdCents * 10000) / (xrpPrice * (10 ** uint8(-decimals)));
        }
        require(requiredDrops > 0, "RelayPay: Calculated drops rounded to zero");

        invoiceId = _generateInvoiceId(msg.sender, amountInUsdCents, xrplDestinationAddress);
        bytes32 destinationHash = keccak256(bytes(xrplDestinationAddress));

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            allowedBuyer: allowedBuyer,
            xrplDestinationAddress: xrplDestinationAddress,
            receivingAddressHash: destinationHash,
            requiredAmountDrops: requiredDrops,
            paidAmountDrops: 0,
            creationTimestamp: uint64(block.timestamp),
            expirationTimestamp: uint64(block.timestamp + durationSeconds),
            status: InvoiceStatus.PENDING,
            fulfillmentPayloadHash: fulfillmentPayloadHash,
            receiptTokenId: 0
        });

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            allowedBuyer,
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
        address allowedBuyer,
        bytes32 fulfillmentPayloadHash
    ) external override returns (bytes32 invoiceId) {
        require(requiredAmountDrops > 0, "RelayPay: Required drops must be > 0");
        require(durationSeconds >= 60, "RelayPay: Duration must be >= 60s");
        require(bytes(xrplDestinationAddress).length > 0, "RelayPay: Invalid XRPL address");

        invoiceId = _generateInvoiceId(msg.sender, requiredAmountDrops, xrplDestinationAddress);
        bytes32 destinationHash = keccak256(bytes(xrplDestinationAddress));

        invoices[invoiceId] = Invoice({
            invoiceId: invoiceId,
            merchant: msg.sender,
            allowedBuyer: allowedBuyer,
            xrplDestinationAddress: xrplDestinationAddress,
            receivingAddressHash: destinationHash,
            requiredAmountDrops: requiredAmountDrops,
            paidAmountDrops: 0,
            creationTimestamp: uint64(block.timestamp),
            expirationTimestamp: uint64(block.timestamp + durationSeconds),
            status: InvoiceStatus.PENDING,
            fulfillmentPayloadHash: fulfillmentPayloadHash,
            receiptTokenId: 0
        });

        emit InvoiceCreated(
            invoiceId,
            msg.sender,
            allowedBuyer,
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
        Payment.Proof calldata attestationProof
    ) external override nonReentrant returns (bool success) {
        // 1. Verify FDC Attestation Proof against consensus Merkle root
        bool isValidProof = fdcVerification.verifyPayment(attestationProof);
        require(isValidProof, "RelayPay: Invalid FDC payment proof");

        // 2. Source Ledger Status Check
        require(attestationProof.response.body.status, "RelayPay: XRPL transaction failed on source");

        // 3. Anti-replay check (unique hash per XRPL transaction)
        bytes32 txHash = keccak256(
            abi.encodePacked(
                attestationProof.response.body.standardPaymentReference,
                attestationProof.response.body.sourceAddressHash,
                attestationProof.response.body.blockNumber,
                attestationProof.response.body.blockTimestamp,
                attestationProof.response.body.receivedAmount
            )
        );
        require(!processedTxHashes[txHash], "RelayPay: XRPL tx hash already processed");

        Invoice storage inv = invoices[invoiceId];
        require(inv.invoiceId != bytes32(0), "RelayPay: Invoice does not exist");
        require(
            inv.status == InvoiceStatus.PENDING || inv.status == InvoiceStatus.UNDERPAID,
            "RelayPay: Invoice not in payable state"
        );

        // 4. Creation Timestamp Bounds Check: Reject payments made BEFORE invoice creation
        uint64 txTimestamp = attestationProof.response.body.blockTimestamp;
        require(txTimestamp >= inv.creationTimestamp, "RelayPay: Payment occurred before invoice creation");

        // 5. Restricted Buyer Check
        if (inv.allowedBuyer != address(0)) {
            require(inv.allowedBuyer == msg.sender, "RelayPay: Caller not authorized buyer");
        }

        // 6. Destination address match
        require(
            attestationProof.response.body.receivingAddressHash == inv.receivingAddressHash,
            "RelayPay: Destination address mismatch"
        );

        // 7. Memo invoice ID match
        require(
            attestationProof.response.body.standardPaymentReference == invoiceId,
            "RelayPay: Memo invoice ID mismatch"
        );

        // Mark txHash processed to prevent replay attacks
        processedTxHashes[txHash] = true;

        require(attestationProof.response.body.receivedAmount > 0, "RelayPay: Received amount must be > 0");
        uint256 receivedDrops = uint256(attestationProof.response.body.receivedAmount);
        inv.paidAmountDrops += receivedDrops;

        // 8. State Machine Evaluation
        if (txTimestamp > inv.expirationTimestamp) {
            inv.status = InvoiceStatus.EXPIRED_PAID;
            inv.allowedBuyer = msg.sender; // Persist buyer address for late payment manual release
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

        // 9. Mint Proof-of-Purchase Receipt NFT
        uint256 receiptId = receiptContract.mintReceipt(
            msg.sender,
            invoiceId,
            inv.merchant,
            inv.paidAmountDrops,
            txHash
        );
        inv.receiptTokenId = receiptId;

        emit PaymentFulfilled(invoiceId, inv.merchant, msg.sender, txHash, inv.paidAmountDrops, inv.status, receiptId);

        // 10. Execute Merchant Custom Callback
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
    function forceFulfillExpired(bytes32 invoiceId) external override onlyMerchant(invoiceId) nonReentrant {
        Invoice storage inv = invoices[invoiceId];
        require(inv.status == InvoiceStatus.EXPIRED_PAID, "RelayPay: Invoice not in EXPIRED_PAID state");
        inv.status = InvoiceStatus.FULFILLED;

        // Mint receipt NFT to buyer if recorded, or merchant
        address recipient = inv.allowedBuyer != address(0) ? inv.allowedBuyer : msg.sender;

        uint256 receiptId = receiptContract.mintReceipt(
            recipient,
            invoiceId,
            inv.merchant,
            inv.paidAmountDrops,
            bytes32(0)
        );
        inv.receiptTokenId = receiptId;

        emit PaymentFulfilled(invoiceId, inv.merchant, recipient, bytes32(0), inv.paidAmountDrops, inv.status, receiptId);

        address merchantContract = merchantFulfillmentContracts[inv.merchant];
        if (merchantContract != address(0)) {
            IRelayPayFulfillment(merchantContract).onRelayPayFulfill(
                invoiceId,
                recipient,
                inv.paidAmountDrops,
                inv.fulfillmentPayloadHash
            );
        }
    }

    /**
     * @notice Cancel pending invoice
     */
    function cancelInvoice(bytes32 invoiceId) external override onlyMerchant(invoiceId) nonReentrant {
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
     * @notice Helper utility to format standard crypto feed IDs (e.g. "XRP/USD" -> 0x01 + XRP/USD)
     */
    function formatCryptoFeedId(string memory symbol) public pure returns (bytes21) {
        bytes memory b = bytes(symbol);
        require(b.length > 0 && b.length <= 20, "RelayPay: Invalid feed symbol");
        bytes21 feedId = bytes21(uint168(0x01) << 160); // Set category byte to 0x01 (Crypto)
        for (uint256 i = 0; i < b.length; i++) {
            feedId |= bytes21(bytes21(b[i]) >> (8 * (i + 1)));
        }
        return feedId;
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
