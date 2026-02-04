// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaUUPSBase.sol";

/**
 * @title PizzaDotsStats
 * @notice Authoritative onchain statistics for Pizza Dots players
 * @dev UUPS upgradeable - stats are the source of truth
 */
contract PizzaDotsStats is PizzaUUPSBase {
    struct Stats {
        uint256 gamesPlayed;
        uint256 gamesWon;
        uint256 slicesCaptured;
        uint256 weeklySlices;
        uint256 lifetimeEarnings;
        uint256 lastGameTimestamp;
    }

    // Player address => Stats
    mapping(address => Stats) public playerStats;

    // Weekly leaderboard tracking
    address[] public weeklyPlayers;
    mapping(address => bool) public isWeeklyPlayer;
    uint256 public weekStartTimestamp;

    // Events
    event GameRecorded(
        address indexed player,
        bool won,
        uint256 slices,
        uint256 earnings
    );
    event WeeklyReset(uint256 timestamp, uint256 playersReset);

    function initialize(address admin) external initializer {
        __PizzaUUPSBase_init(admin);
        weekStartTimestamp = block.timestamp;
    }

    /**
     * @notice Record a completed game for a player
     * @param player Player's wallet address
     * @param won Whether the player won the match
     * @param slices Number of slices captured
     * @param earnings Amount of $PIZZA earned
     */
    function recordGame(
        address player,
        bool won,
        uint256 slices,
        uint256 earnings
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Stats storage s = playerStats[player];

        s.gamesPlayed++;
        if (won) s.gamesWon++;
        s.slicesCaptured += slices;
        s.weeklySlices += slices;
        s.lifetimeEarnings += earnings;
        s.lastGameTimestamp = block.timestamp;

        // Track for weekly leaderboard
        if (!isWeeklyPlayer[player]) {
            weeklyPlayers.push(player);
            isWeeklyPlayer[player] = true;
        }

        emit GameRecorded(player, won, slices, earnings);
    }

    /**
     * @notice Reset weekly slices for all tracked players
     * @dev Called by weekly cron job
     */
    function resetWeeklySlices() external onlyRole(OPERATOR_ROLE) {
        uint256 count = weeklyPlayers.length;

        for (uint256 i = 0; i < count; i++) {
            address player = weeklyPlayers[i];
            playerStats[player].weeklySlices = 0;
            isWeeklyPlayer[player] = false;
        }

        delete weeklyPlayers;
        weekStartTimestamp = block.timestamp;

        emit WeeklyReset(block.timestamp, count);
    }

    /**
     * @notice Get player statistics
     */
    function getStats(address player) external view returns (Stats memory) {
        return playerStats[player];
    }

    /**
     * @notice Get top players by weekly slices
     * @param limit Maximum number of players to return
     */
    function getWeeklyTopPlayers(uint256 limit)
        external
        view
        returns (address[] memory, uint256[] memory)
    {
        uint256 count = weeklyPlayers.length;
        if (limit > count) limit = count;

        address[] memory topAddresses = new address[](limit);
        uint256[] memory topScores = new uint256[](limit);

        // Simple selection sort for top N (gas efficient for small N)
        for (uint256 i = 0; i < limit; i++) {
            uint256 maxScore = 0;
            uint256 maxIndex = 0;

            for (uint256 j = 0; j < count; j++) {
                address player = weeklyPlayers[j];
                uint256 score = playerStats[player].weeklySlices;

                // Check if already selected
                bool alreadySelected = false;
                for (uint256 k = 0; k < i; k++) {
                    if (topAddresses[k] == player) {
                        alreadySelected = true;
                        break;
                    }
                }

                if (!alreadySelected && score > maxScore) {
                    maxScore = score;
                    maxIndex = j;
                }
            }

            if (maxScore > 0) {
                topAddresses[i] = weeklyPlayers[maxIndex];
                topScores[i] = maxScore;
            }
        }

        return (topAddresses, topScores);
    }

    /**
     * @notice Get total number of weekly players
     */
    function getWeeklyPlayerCount() external view returns (uint256) {
        return weeklyPlayers.length;
    }
}
