// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IPizzaDotsStats
 * @notice Interface for Pizza Dots Stats contract
 */
interface IPizzaDotsStats {
    struct Stats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 slicesCaptured;
        uint256 weeklySlices;
        uint256 lifetimeEarnings;
        uint256 lastGameTimestamp;
    }

    function recordGame(
        address player,
        bool won,
        uint256 slices,
        uint256 earnings
    ) external;

    function getStats(address player) external view returns (Stats memory);

    function getWeeklyTopPlayers(uint256 limit)
        external
        view
        returns (address[] memory, uint256[] memory);

    function resetWeeklySlices() external;
}
