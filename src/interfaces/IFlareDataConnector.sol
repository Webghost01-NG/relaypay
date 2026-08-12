// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlareDataConnector
 * @notice Standard interface and attestation data types for Flare Data Connector (FDC)
 */
interface IFlareDataConnector {

    // FDC Attestation Types
    struct PaymentResponse {
        bytes32 transactionHash;
        uint64 blockNumber;
        uint64 blockTimestamp;
        string sourceAddress;
        string destinationAddress;
        uint256 amountDrops; // Amount in XRP drops (1 XRP = 1,000,000 drops)
        bytes32 memoHash;    // Encoded Invoice ID from XRPL memo
        bool status;         // Success status on XRPL
    }

    struct PaymentAttestation {
        bytes32[] merkleProof;
        PaymentResponse response;
    }

    function verifyPayment(PaymentAttestation calldata attestation) external view returns (bool);
}
