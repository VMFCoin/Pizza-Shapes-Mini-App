// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaUUPSBase.sol";
import "./interfaces/IPizzaToken.sol";

/**
 * @title WeeklyVault
 * @notice Holds 10% of entry fees for weekly top 3 leaderboard payouts
 * @dev UUPS upgradeable - funds accumulate here until weekly distribution
 *
 * Weekly Distribution (of total accumulated):
 * - 1st Place: 50%
 * - 2nd Place: 30%
 * - 3rd Place: 20%
 */
contract WeeklyVault is PizzaUUPSBase {
    IPizzaToken public pizza;
    address public settlementContract;

    // Tracking
    uint256 public totalDeposited;
    uint256 public totalDistributed;
    uint256 public weekNumber;
    uint256 public lastDistributionTime;

    // Weekly distribution record
    struct WeeklyDistribution {
        uint256 weekNumber;
        address[3] winners;
        uint256[3] amounts;
        uint256 timestamp;
        uint256 totalDistributed;
    }

    mapping(uint256 => WeeklyDistribution) public distributions;

    // Events
    event FundsReceived(address indexed from, uint256 amount);
    event WeeklyDistributionCompleted(
        uint256 indexed weekNumber,
        address[3] winners,
        uint256[3] amounts,
        uint256 total
    );
    event SettlementContractUpdated(address indexed newSettlement);

    // Errors
    error OnlySettlement();
    error InsufficientBalance();
    error InvalidWinners();

    modifier onlySettlement() {
        if (msg.sender != settlementContract) revert OnlySettlement();
        _;
    }

    function initialize(
        address pizzaToken,
        address _settlementContract,
        address admin
    ) external initializer {
        __PizzaUUPSBase_init(admin);
        pizza = IPizzaToken(pizzaToken);
        settlementContract = _settlementContract;
        weekNumber = 1;
    }

    /**
     * @notice Receive $PIZZA tokens from settlement contract
     * @dev Called automatically when settlement distributes weekly portion
     */
    receive() external payable {
        // For native ETH (shouldn't happen but handle gracefully)
    }

    /**
     * @notice Record deposit from settlement
     * @dev Settlement contract calls this after transferring tokens
     */
    function recordDeposit(uint256 amount) external onlySettlement {
        totalDeposited += amount;
        emit FundsReceived(msg.sender, amount);
    }

    /**
     * @notice Distribute weekly rewards to top 3 players
     * @param winners Array of top 3 player addresses [1st, 2nd, 3rd]
     * @param percentages Distribution percentages [50, 30, 20]
     */
    function distributeWeeklyRewards(
        address[3] calldata winners,
        uint256[3] calldata percentages
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        uint256 poolBalance = pizza.balanceOf(address(this));
        if (poolBalance == 0) revert InsufficientBalance();

        // Validate at least one winner
        if (winners[0] == address(0)) revert InvalidWinners();

        uint256[3] memory amounts;
        uint256 totalPaid;

        // Calculate and transfer to each winner
        for (uint256 i = 0; i < 3; i++) {
            if (winners[i] != address(0) && percentages[i] > 0) {
                amounts[i] = (poolBalance * percentages[i]) / 100;
                pizza.transfer(winners[i], amounts[i]);
                totalPaid += amounts[i];
            }
        }

        // Record distribution
        distributions[weekNumber] = WeeklyDistribution({
            weekNumber: weekNumber,
            winners: winners,
            amounts: amounts,
            timestamp: block.timestamp,
            totalDistributed: totalPaid
        });

        totalDistributed += totalPaid;
        lastDistributionTime = block.timestamp;

        emit WeeklyDistributionCompleted(weekNumber, winners, amounts, totalPaid);

        // Increment week number
        weekNumber++;
    }

    /**
     * @notice Get current vault balance
     */
    function getBalance() external view returns (uint256) {
        return pizza.balanceOf(address(this));
    }

    /**
     * @notice Get distribution record for a specific week
     */
    function getDistribution(uint256 _weekNumber) external view returns (WeeklyDistribution memory) {
        return distributions[_weekNumber];
    }

    /**
     * @notice Update settlement contract address
     */
    function setSettlementContract(address _settlement) external onlyRole(DEFAULT_ADMIN_ROLE) {
        settlementContract = _settlement;
        emit SettlementContractUpdated(_settlement);
    }

    /**
     * @notice Approve settlement contract to transfer tokens
     * @dev Needed for settlement contract to pull funds
     */
    function approveSettlement(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pizza.approve(settlementContract, amount);
    }

    /**
     * @notice Emergency withdrawal (admin only)
     */
    function emergencyWithdraw(uint256 amount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        pizza.transfer(msg.sender, amount);
    }
}
