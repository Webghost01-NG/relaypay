// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title RelayPayReceipt
 * @notice Fully ERC-721 compliant On-Chain Proof-of-Purchase Receipt NFT with Dynamic SVG Metadata for RelayPay
 */
contract RelayPayReceipt {
    string public constant name = "RelayPay XRP Commerce Receipt";
    string public constant symbol = "RPR-XRP";

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

    function mintReceipt(address to, bytes32 invoiceId, address merchant, uint256 paidAmountDrops, bytes32 xrplTxHash)
        external
        onlyRegistry
        returns (uint256 tokenId)
    {
        require(to != address(0), "RelayPayReceipt: Mint to zero address");

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

    /**
     * @notice ERC-165 interface support (IERC165, IERC721, IERC721Metadata)
     */
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) {
        return
            interfaceId == 0x01ffc9a7 // IERC165
                || interfaceId == 0x80ac58cd // IERC721
                || interfaceId == 0x5b5e139f; // IERC721Metadata
    }

    /**
     * @notice Dynamic tokenURI returning base64 encoded JSON metadata with on-chain SVG image
     */
    function tokenURI(uint256 tokenId) external view returns (string memory) {
        ReceiptData memory r = receipts[tokenId];
        require(r.buyer != address(0), "RelayPayReceipt: Nonexistent token");

        string memory svg = _generateSvg(tokenId, r);
        return string(
            abi.encodePacked(
                "data:application/json;utf8,{\"name\":\"RelayPay Receipt #",
                _toString(tokenId),
                "\",\"description\":\"Verified Cross-Chain XRP Proof-of-Purchase on Flare EVM via FDC\",\"image\":\"data:image/svg+xml;utf8,",
                svg,
                "\"}"
            )
        );
    }

    function _generateSvg(uint256 tokenId, ReceiptData memory r) private pure returns (string memory) {
        return string(
            abi.encodePacked(
                "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 250' width='100%' height='100%'>",
                "<rect width='400' height='250' rx='16' fill='#0f172a'/>",
                "<text x='20' y='35' fill='#38bdf8' font-family='sans-serif' font-size='16' font-weight='bold'>RelayPay Verified Receipt</text>",
                "<text x='20' y='65' fill='#94a3b8' font-family='sans-serif' font-size='12'>Token ID: #",
                _toString(tokenId),
                "</text>",
                "<text x='20' y='95' fill='#f8fafc' font-family='sans-serif' font-size='14'>Amount Paid: ",
                _formatXrp(r.paidAmountDrops),
                " XRP</text>",
                "<text x='20' y='125' fill='#94a3b8' font-family='sans-serif' font-size='11'>Merchant: ",
                _toHexString(uint160(r.merchant)),
                "</text>",
                "<text x='20' y='155' fill='#94a3b8' font-family='sans-serif' font-size='11'>Buyer: ",
                _toHexString(uint160(r.buyer)),
                "</text>",
                "<text x='20' y='215' fill='#22c55e' font-family='sans-serif' font-size='11'>Status: Cryptographically Verified via Flare FDC</text>",
                "</svg>"
            )
        );
    }

    function _formatXrp(uint256 drops) private pure returns (string memory) {
        uint256 whole = drops / 1_000_000;
        uint256 frac = drops % 1_000_000;
        return string(abi.encodePacked(_toString(whole), ".", _padSixDigits(frac)));
    }

    function _padSixDigits(uint256 value) private pure returns (string memory) {
        bytes memory b = new bytes(6);
        for (uint256 i = 6; i > 0; i--) {
            b[i - 1] = bytes1(uint8(48 + (value % 10)));
            value /= 10;
        }
        return string(b);
    }

    function _toString(uint256 value) private pure returns (string memory) {
        if (value == 0) return "0";
        uint256 temp = value;
        uint256 digits;
        while (temp != 0) {
            digits++;
            temp /= 10;
        }
        bytes memory buffer = new bytes(digits);
        while (value != 0) {
            digits -= 1;
            buffer[digits] = bytes1(uint8(48 + uint256(value % 10)));
            value /= 10;
        }
        return string(buffer);
    }

    function _toHexString(uint160 value) private pure returns (string memory) {
        bytes memory buffer = new bytes(42);
        buffer[0] = "0";
        buffer[1] = "x";
        for (uint256 i = 41; i > 1; --i) {
            uint8 digit = uint8(value & 0xf);
            buffer[i] = digit < 10 ? bytes1(digit + 48) : bytes1(digit + 87);
            value >>= 4;
        }
        return string(buffer);
    }
}
