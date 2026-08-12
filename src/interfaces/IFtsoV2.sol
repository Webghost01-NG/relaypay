// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title IFtsoV2
 * @notice Official Flare Time Series Oracle v2 (FTSO v2) interface for fetching decentralized price feeds
 */
interface IFtsoV2 {
    /**
     * @notice Fetch feed value by 21-byte Feed ID (e.g., XRP/USD: 0x014152502f55534400000000000000000000000000)
     * @param feedId The 21-byte Feed ID
     * @return value The price value
     * @return decimals The decimal exponent (e.g. 4 for 10^4)
     * @return timestamp The timestamp when feed value was published
     */
    function getFeedValue(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint256 timestamp);

    /**
     * @notice Alternative FTSO v2 selector used on certain Flare testnets
     */
    function getFeedById(bytes21 feedId) external view returns (uint256 value, int8 decimals, uint64 timestamp);
}
