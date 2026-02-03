// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PizzaUUPSBase.sol";
import "./interfaces/IPizzaToken.sol";

/**
 * @title DailyFreeRoll
 * @notice Daily free roll game for Pizza Dots
 * @dev One roll per Farcaster FID per UTC day
 *
 * Mechanics:
 * - Player picks a number 1-6
 * - Roll is verified onchain
 * - Match = win share of daily pool
 * - Pool funded from match settlements (3%)
 */
contract DailyFreeRoll is PizzaUUPSBase {
    IPizzaToken public pizza;

    // Daily pool balance
    uint256 public dailyPool;

    // Tracking: fid => day => rolled
    mapping(uint256 => mapping(uint256 => bool)) public hasRolledToday;

    // Roll results for verification
    struct RollResult {
        uint256 fid;
        address wallet;
        uint8 selection;
        uint8 result;
        bool won;
        uint256 prize;
        uint256 timestamp;
    }

    mapping(uint256 => RollResult) public lastRoll; // fid => last roll

    // Weekly vault for leftover funds
    address public weeklyVault;

    // Events
    event PoolFunded(address indexed funder, uint256 amount);
    event FreeRollPlayed(
        uint256 indexed fid,
        address indexed wallet,
        uint8 selection,
        uint8 result,
        bool won,
        uint256 prize
    );
    event DailyReset(uint256 leftoverToWeekly, uint256 timestamp);

    function initialize(
        address pizzaToken,
        address _weeklyVault,
        address admin
    ) external initializer {
        __PizzaUUPSBase_init(admin);
        pizza = IPizzaToken(pizzaToken);
        weeklyVault = _weeklyVault;
    }

    /**
     * @notice Fund the daily pool
     * @param amount Amount of PIZZA to add
     */
    function fund(uint256 amount) external {
        pizza.transferFrom(msg.sender, address(this), amount);
        dailyPool += amount;
        emit PoolFunded(msg.sender, amount);
    }

    /**
     * @notice Execute a free roll
     * @param fid Farcaster ID of the player
     * @param selection Player's number selection (1-6)
     * @param result The rolled number (1-6) - provided by backend with VRF
     * @param wallet Player's primary wallet address
     */
    function roll(
        uint256 fid,
        uint8 selection,
        uint8 result,
        address wallet
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        uint256 today = block.timestamp / 1 days;

        require(!hasRolledToday[fid][today], "Already rolled today");
        require(selection >= 1 && selection <= 6, "Invalid selection");
        require(result >= 1 && result <= 6, "Invalid result");

        hasRolledToday[fid][today] = true;

        bool won = selection == result;
        uint256 prize = 0;

        if (won && dailyPool > 0) {
            // Winner gets 1/6 of pool (fair distribution)
            prize = dailyPool / 6;
            if (prize > dailyPool) prize = dailyPool;

            dailyPool -= prize;
            pizza.transfer(wallet, prize);
        }

        lastRoll[fid] = RollResult({
            fid: fid,
            wallet: wallet,
            selection: selection,
            result: result,
            won: won,
            prize: prize,
            timestamp: block.timestamp
        });

        emit FreeRollPlayed(fid, wallet, selection, result, won, prize);
    }

    /**
     * @notice Reset daily pool - send leftovers to weekly vault
     * @dev Called by daily cron at UTC midnight
     */
    function resetDaily() external onlyRole(OPERATOR_ROLE) {
        uint256 leftover = dailyPool;

        if (leftover > 0) {
            dailyPool = 0;
            pizza.transfer(weeklyVault, leftover);
        }

        emit DailyReset(leftover, block.timestamp);
    }

    /**
     * @notice Check if FID has rolled today
     */
    function hasRolled(uint256 fid) external view returns (bool) {
        uint256 today = block.timestamp / 1 days;
        return hasRolledToday[fid][today];
    }

    /**
     * @notice Get last roll result for FID
     */
    function getLastRoll(uint256 fid) external view returns (RollResult memory) {
        return lastRoll[fid];
    }

    /**
     * @notice Get current pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return dailyPool;
    }

    /**
     * @notice Update weekly vault address
     */
    function setWeeklyVault(address _weeklyVault)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        weeklyVault = _weeklyVault;
    }

    /**
     * @notice Emergency withdraw
     */
    function emergencyWithdraw(uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        pizza.transfer(msg.sender, amount);
        if (amount <= dailyPool) {
            dailyPool -= amount;
        } else {
            dailyPool = 0;
        }
    }
}
