// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaShapesSettlementV3.sol";

/**
 * @title PizzaShapesSettlementV4
 * @notice V4 upgrade: adds bot-aware settlement path
 * @dev When the bot wins, the 77% winner portion is split:
 *   - 50% → Free Roll Vault (daily free roll pool)
 *   - 50% → PIZZA token address (burn via transfer to token contract)
 *
 * All other distributions (weekly 10%, burn 7%, free roll 3%, charity 3%)
 * remain unchanged regardless of whether the winner is a bot or human.
 *
 * Bot stats are NOT recorded (bot address is skipped in recordGame calls).
 */
contract PizzaShapesSettlementV4 is PizzaShapesSettlementV3 {
    // PIZZA token address used as burn destination (tokens sent here are irrecoverable)
    address public constant PIZZA_BURN_ADDRESS = 0xa821f2ee19F4f62e404C934D43eB6E5763fbdb07;

    // Bot wallet address (zero address — bot has no real wallet)
    address public constant BOT_ADDRESS = 0x0000000000000000000000000000000000000000;

    // Events
    event BotMatchSettled(
        bytes32 indexed matchId,
        uint256 freeRollAmount,
        uint256 burnedToPizza,
        uint256 totalPool
    );

    /**
     * @notice Settle a match where the bot won
     * @dev The 77% winner portion is split 50/50 between free roll vault and PIZZA burn.
     *      Weekly, burn, free roll, and charity distributions proceed normally.
     *      Bot address is excluded from stats recording.
     * @param matchId Match to settle
     * @param players All players in match order (includes bot address)
     * @param slices Slices captured by each player (same order as players)
     */
    function settleBotMatch(
        bytes32 matchId,
        address[] calldata players,
        uint256[] calldata slices
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Match storage m = matches[matchId];
        if (m.createdAt == 0) revert MatchNotFound();
        if (m.settled) revert MatchAlreadySettled();
        if (players.length != slices.length) revert PlayerLengthMismatch();

        uint256 totalPool = m.totalPool;

        // Calculate standard distributions
        uint256 winnerAmt = (totalPool * WINNER_BPS) / TOTAL_BPS;
        uint256 weeklyAmt = (totalPool * WEEKLY_BPS) / TOTAL_BPS;
        uint256 burnAmt = (totalPool * BURN_BPS) / TOTAL_BPS;
        uint256 freeRollAmt = (totalPool * FREE_ROLL_BPS) / TOTAL_BPS;
        uint256 charityAmt = (totalPool * CHARITY_BPS) / TOTAL_BPS;

        // === Bot winner: split 77% winner portion 50/50 ===
        uint256 halfWinner = winnerAmt / 2;
        uint256 botBurnAmt = winnerAmt - halfWinner; // Handles odd wei

        // 1a. Half of winner portion → free roll vault
        if (!pizza.transfer(freeRollVault, halfWinner)) revert TransferFailed();
        freeRollPool += halfWinner;

        // 1b. Other half → PIZZA token address (burn)
        if (!pizza.transfer(PIZZA_BURN_ADDRESS, botBurnAmt)) revert TransferFailed();
        totalBurned += botBurnAmt;

        // 2. Standard weekly pool (10%)
        if (!pizza.transfer(weeklyVault, weeklyAmt)) revert TransferFailed();
        weeklyPool += weeklyAmt;

        // 3. Standard burn (7%) — goes to 0xdead as before
        if (!pizza.transfer(BURN_ADDRESS, burnAmt)) revert TransferFailed();
        totalBurned += burnAmt;
        emit TokensBurned(matchId, burnAmt);

        // 4. Standard free roll (3%)
        if (!pizza.transfer(freeRollVault, freeRollAmt)) revert TransferFailed();
        freeRollPool += freeRollAmt;

        // 5. Standard charity (3%)
        _distributeToCharities(matchId, charityAmt);

        // Record stats for human players ONLY (skip bot)
        for (uint256 i = 0; i < players.length; i++) {
            if (players[i] == BOT_ADDRESS) continue;

            // Human lost to bot — record loss with 0 earnings
            statsContract.recordGame(
                players[i],
                false,
                slices[i],
                0
            );

            playerSlices[matchId][players[i]] = slices[i];
        }

        m.settled = true;

        emit BotMatchSettled(matchId, halfWinner, botBurnAmt, totalPool);
        emit FundsDistributed(
            matchId,
            winnerAmt,
            weeklyAmt,
            burnAmt,
            freeRollAmt,
            charityAmt
        );
        emit MatchSettled(matchId, BOT_ADDRESS, winnerAmt, totalPool);
    }
}
