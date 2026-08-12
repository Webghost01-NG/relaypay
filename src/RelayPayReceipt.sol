// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RelayPayReceipt
 * @notice ERC-721 compliant On-Chain Proof-of-Purchase Receipt NFT for RelayPay
 */
contract RelayPayReceipt {

    string public name = "RelayPay XRP Commerce Receipt";
    string public symbol = "RPR-XRP";

    address public immutable registry;
    uint256 private _tokenCounter;

    struct ReceiptData {
        bytes32 invoiceId;
        address merchant;
        address buyer;
        uint256 paidAmountDrops;
        bytes32 xrplTxHash;
        uint64 timestamp;
    }

    mapping(uint256 => ReceiptData) public receipts;
    mapping(uint256 => address) private _owners;
    mapping(address => uint256) private _balances;

    event Transfer(address indexed from, address indexed to, uint256 indexed tokenId);

    modifier onlyRegistry() {
        require(msg.sender == registry, "RelayPayReceipt: Only registry can mint");
        _;
    }

    constructor(address _registry) {
        require(_registry != address(0), "RelayPayReceipt: Invalid registry address");
        registry = _registry;
    }

    function mintReceipt(
        address to,
        bytes32 invoiceId,
        address merchant,
        uint256 paidAmountDrops,
        bytes32 xrplTxHash
    ) external onlyRegistry returns (uint256 tokenId) {
        _tokenCounter++;
        tokenId = _tokenCounter;

        _owners[tokenId] = to;
        _balances[to] += 1;

        receipts[tokenId] = ReceiptData({
            invoiceId: invoiceId,
            merchant: merchant,
            buyer: to,
            paidAmountDrops: paidAmountDrops,
            xrplTxHash: xrplTxHash,
            timestamp: uint64(block.timestamp)
        });

        emit Transfer(address(0), to, tokenId);
    }

    function ownerOf(uint256 tokenId) external view returns (address) {
        address owner = _owners[tokenId];
        require(owner != address(0), "RelayPayReceipt: Nonexistent token");
        return owner;
    }

    function balanceOf(address owner) external view returns (uint256) {
        require(owner != address(0), "RelayPayReceipt: Zero address");
        return _balances[owner];
    }

    function getReceipt(uint256 tokenId) external view returns (ReceiptData memory) {
        require(_owners[tokenId] != address(0), "RelayPayReceipt: Nonexistent token");
        return receipts[tokenId];
    }

    function totalSupply() external view returns (uint256) {
        return _tokenCounter;
    }
}
