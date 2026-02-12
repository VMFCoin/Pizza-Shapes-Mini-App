// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaShapesSettlementV4.sol";

/**
 * @title PizzaShapesSettlementV5
 * @notice V5 upgrade: adds tied-match settlement path
 * @dev When a match ends in a tie, the 77% winner portion is split equally
 *      among all co-winners. All other distributions (weekly 10%, burn 7%,
 *      free roll 3%, charity 3%) remain unchanged.
 *
 *      No new storage variables — only constants and a new function,
 *      making it safe for UUPS upgrade without a new initializer.
 */
contract PizzaShapesSettlementV5 is PizzaShapesSettlementV4 {
    // Events
    event TiedMatchSettled(
        bytes32 indexed matchId,
        address[] winners,
        uint256 perWinnerPrize,
        uint256 totalPool
    );

    /**
     * @notice Settle a match that ended in a tie
     * @dev The 77% winner portion is split equally among all co-winners.
     *      Weekly, burn, free roll, and charity distributions proceed normally.
     * @param matchId Match to settle
     * @param winners Array of co-winner addresses (must have >= 2 entries)
     * @param players All players in match order
     * @param slices Slices captured by each player (same order as players)
     */
    function settleTiedMatch(
        bytes32 matchId,
        address[] calldata winners,
        address[] calldata players,
        uint256[] calldata slices
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Match storage m = matches[matchId];
        if (m.createdAt == 0) revert MatchNotFound();
        if (m.settled) revert MatchAlreadySettled();
        if (players.length != slices.length) revert PlayerLengthMismatch();
        require(winners.length >= 2, "Need >= 2 winners for tie");

        uint256 totalPool = m.totalPool;

        // Calculate all distributions
        uint256 winnerAmt = (totalPool * WINNER_BPS) / TOTAL_BPS;
        uint256 weeklyAmt = (totalPool * WEEKLY_BPS) / TOTAL_BPS;
        uint256 burnAmt = (totalPool * BURN_BPS) / TOTAL_BPS;
        uint256 freeRollAmt = (totalPool * FREE_ROLL_BPS) / TOTAL_BPS;
        uint256 charityAmt = (totalPool * CHARITY_BPS) / TOTAL_BPS;

        // 1. Split winner portion equally among co-winners
        uint256 perWinner = winnerAmt / winners.length;
        uint256 remainder = winnerAmt - (perWinner * winners.length);

        for (uint256 i = 0; i < winners.length; i++) {
            // Give any dust wei to the first winner
            uint256 amt = i == 0 ? perWinner + remainder : perWinner;
            if (!pizza.transfer(winners[i], amt)) revert TransferFailed();
        }

        // 2. Weekly pool (10%)
        if (!pizza.transfer(weeklyVault, weeklyAmt)) revert TransferFailed();
        weeklyPool += weeklyAmt;

        // 3. Burn (7%)
        if (!pizza.transfer(BURN_ADDRESS, burnAmt)) revert TransferFailed();
        totalBurned += burnAmt;
        emit TokensBurned(matchId, burnAmt);

        // 4. Free roll (3%)
        if (!pizza.transfer(freeRollVault, freeRollAmt)) revert TransferFailed();
        freeRollPool += freeRollAmt;

        // 5. Charity (3%)
        _distributeToCharities(matchId, charityAmt);

        // Record stats — co-winners get isWinner=true with their split earnings
        for (uint256 i = 0; i < players.length; i++) {
            // Skip bot address in stats
            if (players[i] == BOT_ADDRESS) continue;

            bool isWinner = _isInArray(players[i], winners);
            uint256 earnings = isWinner ? perWinner : 0;

            statsContract.recordGame(
                players[i],
                isWinner,
                slices[i],
                earnings
            );

            playerSlices[matchId][players[i]] = slices[i];
        }

        m.settled = true;

        emit TiedMatchSettled(matchId, winners, perWinner, totalPool);
        emit FundsDistributed(
            matchId,
            winnerAmt,
            weeklyAmt,
            burnAmt,
            freeRollAmt,
            charityAmt
        );
        // Emit MatchSettled with first winner for backward compat with indexers
        emit MatchSettled(matchId, winners[0], winnerAmt, totalPool);
    }

    /**
     * @dev Check if an address is in an array
     */
    function _isInArray(address addr, address[] calldata arr) internal pure returns (bool) {
        for (uint256 i = 0; i < arr.length; i++) {
            if (arr[i] == addr) return true;
        }
        return false;
    }
}
