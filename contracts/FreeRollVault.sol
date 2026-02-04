// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaUUPSBase.sol";
import "./interfaces/IPizzaToken.sol";

/**
 * @title FreeRollVault
 * @notice Holds 3% of entry fees for daily free roll prizes
 * @dev UUPS upgradeable - manages daily free roll payouts
 *
 * Free Roll Mechanics:
 * - Each Farcaster FID can roll once per UTC day
 * - Player picks a number 1-6
 * - If it matches the VRF result, they win 1/6 of the daily pool
 * - Unclaimed daily pool rolls over to weekly vault at UTC midnight
 */
contract FreeRollVault is PizzaUUPSBase {
    IPizzaToken public pizza;
    address public settlementContract;
    address public weeklyVault; // For overflow transfers

    // Daily tracking
    uint256 public currentDayPool;
    uint256 public lastDayResetTimestamp;
    uint256 public totalPaidOut;
    uint256 public totalDaysRun;

    // Roll records by FID
    struct RollRecord {
        uint256 dayNumber;
        uint8 selection;     // 1-6
        uint8 result;        // 1-6
        bool won;
        uint256 prize;
        uint256 timestamp;
    }

    // FID => their last roll record
    mapping(uint256 => RollRecord) public lastRolls;

    // Track daily winners
    struct DailyWinner {
        uint256 fid;
        address wallet;
        uint256 prize;
        uint256 timestamp;
    }

    // Day number => array of winners that day
    mapping(uint256 => DailyWinner[]) public dailyWinners;

    // Events
    event FundsReceived(address indexed from, uint256 amount);
    event FreeRollWin(
        uint256 indexed fid,
        address indexed wallet,
        uint8 selection,
        uint8 result,
        uint256 prize
    );
    event FreeRollLoss(
        uint256 indexed fid,
        uint8 selection,
        uint8 result
    );
    event DayReset(
        uint256 dayNumber,
        uint256 previousPool,
        uint256 transferredToWeekly
    );

    // Errors
    error OnlySettlement();
    error AlreadyRolledToday();
    error InvalidSelection();
    error InvalidResult();
    error InsufficientPool();

    modifier onlySettlement() {
        if (msg.sender != settlementContract) revert OnlySettlement();
        _;
    }

    function initialize(
        address pizzaToken,
        address _settlementContract,
        address _weeklyVault,
        address admin
    ) external initializer {
        __PizzaUUPSBase_init(admin);
        pizza = IPizzaToken(pizzaToken);
        settlementContract = _settlementContract;
        weeklyVault = _weeklyVault;
        lastDayResetTimestamp = block.timestamp;
    }

    /**
     * @notice Check if an FID has rolled today
     */
    function hasRolledToday(uint256 fid) public view returns (bool) {
        RollRecord memory lastRoll = lastRolls[fid];
        if (lastRoll.timestamp == 0) return false;

        // Check if last roll was on the current UTC day
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastRollDay = lastRoll.timestamp / 1 days;

        return currentDay == lastRollDay;
    }

    /**
     * @notice Process a free roll
     * @dev Called by operator with VRF-generated result
     * @param fid Farcaster ID of the player
     * @param playerAddress Player's wallet address for prize payment
     * @param selection Player's chosen number (1-6)
     * @param result VRF-generated result (1-6)
     */
    function processRoll(
        uint256 fid,
        address playerAddress,
        uint8 selection,
        uint8 result
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (hasRolledToday(fid)) revert AlreadyRolledToday();
        if (selection < 1 || selection > 6) revert InvalidSelection();
        if (result < 1 || result > 6) revert InvalidResult();

        bool won = selection == result;
        uint256 prize = 0;

        if (won) {
            // Winner gets 1/6 of the daily pool
            uint256 poolBalance = pizza.balanceOf(address(this));
            prize = poolBalance / 6;

            if (prize > 0) {
                pizza.transfer(playerAddress, prize);
                currentDayPool -= prize;
                totalPaidOut += prize;

                // Record daily winner
                uint256 dayNumber = block.timestamp / 1 days;
                dailyWinners[dayNumber].push(DailyWinner({
                    fid: fid,
                    wallet: playerAddress,
                    prize: prize,
                    timestamp: block.timestamp
                }));

                emit FreeRollWin(fid, playerAddress, selection, result, prize);
            }
        } else {
            emit FreeRollLoss(fid, selection, result);
        }

        // Record the roll
        lastRolls[fid] = RollRecord({
            dayNumber: block.timestamp / 1 days,
            selection: selection,
            result: result,
            won: won,
            prize: prize,
            timestamp: block.timestamp
        });
    }

    /**
     * @notice Reset daily pool (called at UTC midnight by cron)
     * @dev Transfers remaining pool to weekly vault
     */
    function resetDailyPool() external onlyRole(OPERATOR_ROLE) {
        uint256 currentDay = block.timestamp / 1 days;
        uint256 lastResetDay = lastDayResetTimestamp / 1 days;

        // Only reset if it's a new day
        require(currentDay > lastResetDay, "Already reset today");

        uint256 remainingPool = pizza.balanceOf(address(this));
        uint256 transferAmount = 0;

        // Transfer remaining to weekly vault (if any)
        if (remainingPool > 0 && weeklyVault != address(0)) {
            transferAmount = remainingPool;
            pizza.transfer(weeklyVault, transferAmount);
        }

        emit DayReset(currentDay, remainingPool, transferAmount);

        currentDayPool = 0;
        lastDayResetTimestamp = block.timestamp;
        totalDaysRun++;
    }

    /**
     * @notice Record deposit from settlement
     */
    function recordDeposit(uint256 amount) external onlySettlement {
        currentDayPool += amount;
        emit FundsReceived(msg.sender, amount);
    }

    /**
     * @notice Get current pool balance
     */
    function getPoolBalance() external view returns (uint256) {
        return pizza.balanceOf(address(this));
    }

    /**
     * @notice Get last roll for an FID
     */
    function getLastRoll(uint256 fid) external view returns (RollRecord memory) {
        return lastRolls[fid];
    }

    /**
     * @notice Get daily winners for a specific day
     */
    function getDailyWinners(uint256 dayNumber) external view returns (DailyWinner[] memory) {
        return dailyWinners[dayNumber];
    }

    /**
     * @notice Update settlement contract
     */
    function setSettlementContract(address _settlement) external onlyRole(DEFAULT_ADMIN_ROLE) {
        settlementContract = _settlement;
    }

    /**
     * @notice Update weekly vault for overflow
     */
    function setWeeklyVault(address _weeklyVault) external onlyRole(DEFAULT_ADMIN_ROLE) {
        weeklyVault = _weeklyVault;
    }

    /**
     * @notice Approve settlement contract
     */
    function approveSettlement(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pizza.approve(settlementContract, amount);
    }

    /**
     * @notice Emergency withdrawal
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pizza.transfer(msg.sender, amount);
    }
}
