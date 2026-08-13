// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFlareDataConnector
 * @notice Official Flare Data Connector (FDC) data structures and verification interface for XRPL/UTXO payments
 */
library Payment {
    struct RequestBody {
        bytes32 transactionId;
        uint256 inUtxo;
        uint256 utxo;
    }

    struct Request {
        bytes32 attestationType;
        bytes32 sourceId;
        bytes32 messageIntegrityCode;
        RequestBody body;
    }

    struct ResponseBody {
        uint64 blockNumber;
        uint64 blockTimestamp;
        bytes32 sourceAddressHash;
        bytes32 receivingAddressHash;
        int256 spentAmount;
        int256 receivedAmount;
        bytes32 standardPaymentReference; // Encoded 32-byte Invoice ID from XRPL Memo
        bool status; // Success status on source ledger
    }

    struct Response {
        bytes32 attestationType;
        bytes32 sourceId;
        uint64 votingRound;
        uint64 lowestUsedTimestamp;
        ResponseBody body;
    }

    struct Proof {
        bytes32[] merkleProof;
        Response response;
    }
}

interface IFdcVerification {
    /**
     * @notice Verifies an FDC Payment attestation proof against consensus Merkle roots on Flare
     * @param _proof The complete Merkle proof and response body from Flare FDC attestation provider
     * @return _proven True if proof is cryptographically valid and verified on-chain
     */
    function verifyPayment(Payment.Proof calldata _proof) external view returns (bool _proven);
}
