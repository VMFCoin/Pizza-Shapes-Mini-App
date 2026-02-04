// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaUUPSBase.sol";
import "./interfaces/IPizzaToken.sol";
import "./interfaces/IPizzaDotsStats.sol";

/**
 * @title PizzaShapesSettlement
 * @notice Handles match entry fees and prize distribution
 * @dev UUPS upgradeable - authoritative settlement logic
 *
 * Prize Distribution:
 * - 77% → Match winner
 * - 10% → Weekly Top 3 pool
 * - 7%  → Burned permanently
 * - 3%  → Daily Free Roll pool
 * - 3%  → Veteran charities
 */
contract PizzaShapesSettlement is PizzaUUPSBase {
    // $PIZZA token on Base mainnet
    IPizzaToken public pizza;

    // Stats contract for recording games
    IPizzaDotsStats public statsContract;

    // Distribution percentages (basis points, 100 = 1%)
    uint256 public constant WINNER_BPS = 7700;      // 77%
    uint256 public constant WEEKLY_BPS = 1000;      // 10%
    uint256 public constant BURN_BPS = 700;         // 7%
    uint256 public constant FREE_ROLL_BPS = 300;    // 3%
    uint256 public constant CHARITY_BPS = 300;      // 3%

    // Entry tiers (in PIZZA tokens, 18 decimals)
    uint256 public constant TIER_1 = 0.25 ether;
    uint256 public constant TIER_2 = 0.50 ether;
    uint256 public constant TIER_3 = 1.00 ether;

    // Vault addresses
    address public weeklyVault;
    address public freeRollVault;
    address public charityWallet;
    address public constant BURN_ADDRESS = address(0xdead);

    // Match tracking
    struct Match {
        bytes32 matchId;
        address[] players;
        uint256 entryAmount;
        uint256 totalPool;
        bool settled;
        uint256 createdAt;
    }

    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => mapping(address => uint256)) public playerSlices;

    // Events
    event MatchCreated(bytes32 indexed matchId, uint256 entryAmount);
    event PlayerEntered(bytes32 indexed matchId, address indexed player);
    event MatchSettled(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 winnerPrize,
        uint256 totalPool
    );

    function initialize(
        address pizzaToken,
        address _statsContract,
        address _weeklyVault,
        address _freeRollVault,
        address _charityWallet,
        address admin
    ) external initializer {
        __PizzaUUPSBase_init(admin);

        pizza = IPizzaToken(pizzaToken);
        statsContract = IPizzaDotsStats(_statsContract);
        weeklyVault = _weeklyVault;
        freeRollVault = _freeRollVault;
        charityWallet = _charityWallet;
    }

    /**
     * @notice Enter a match with entry fee
     * @param matchId Unique match identifier
     * @param tier Entry tier (1, 2, or 3)
     */
    function enterMatch(bytes32 matchId, uint8 tier) external whenNotPaused {
        uint256 amount = _getTierAmount(tier);
        require(amount > 0, "Invalid tier");

        Match storage m = matches[matchId];

        // Create new match if doesn't exist
        if (m.createdAt == 0) {
            m.matchId = matchId;
            m.entryAmount = amount;
            m.createdAt = block.timestamp;
            emit MatchCreated(matchId, amount);
        } else {
            require(!m.settled, "Match settled");
            require(m.entryAmount == amount, "Tier mismatch");
            require(m.players.length < 6, "Match full");
        }

        // Check not already entered
        for (uint256 i = 0; i < m.players.length; i++) {
            require(m.players[i] != msg.sender, "Already entered");
        }

        // Transfer entry fee
        pizza.transferFrom(msg.sender, address(this), amount);

        m.players.push(msg.sender);
        m.totalPool += amount;

        emit PlayerEntered(matchId, msg.sender);
    }

    /**
     * @notice Settle a completed match
     * @param matchId Match to settle
     * @param winner Winner's address
     * @param players All players in order
     * @param slices Slices captured by each player (same order)
     */
    function settleMatch(
        bytes32 matchId,
        address winner,
        address[] calldata players,
        uint256[] calldata slices
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Match storage m = matches[matchId];
        require(m.createdAt > 0, "Match not found");
        require(!m.settled, "Already settled");
        require(players.length == slices.length, "Length mismatch");

        uint256 totalPool = m.totalPool;

        // Calculate distributions
        uint256 winnerAmt = (totalPool * WINNER_BPS) / 10000;
        uint256 weeklyAmt = (totalPool * WEEKLY_BPS) / 10000;
        uint256 burnAmt = (totalPool * BURN_BPS) / 10000;
        uint256 freeRollAmt = (totalPool * FREE_ROLL_BPS) / 10000;
        uint256 charityAmt = (totalPool * CHARITY_BPS) / 10000;

        // Distribute funds
        pizza.transfer(winner, winnerAmt);
        pizza.transfer(weeklyVault, weeklyAmt);
        pizza.transfer(BURN_ADDRESS, burnAmt);
        pizza.transfer(freeRollVault, freeRollAmt);
        pizza.transfer(charityWallet, charityAmt);

        // Record stats for all players
        for (uint256 i = 0; i < players.length; i++) {
            bool isWinner = players[i] == winner;
            uint256 earnings = isWinner ? winnerAmt : 0;

            statsContract.recordGame(
                players[i],
                isWinner,
                slices[i],
                earnings
            );

            playerSlices[matchId][players[i]] = slices[i];
        }

        m.settled = true;

        emit MatchSettled(matchId, winner, winnerAmt, totalPool);
    }

    /**
     * @notice Get tier amount in PIZZA tokens
     */
    function _getTierAmount(uint8 tier) internal pure returns (uint256) {
        if (tier == 1) return TIER_1;
        if (tier == 2) return TIER_2;
        if (tier == 3) return TIER_3;
        return 0;
    }

    /**
     * @notice Get match details
     */
    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /**
     * @notice Update vault addresses
     */
    function setVaults(
        address _weeklyVault,
        address _freeRollVault,
        address _charityWallet
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        weeklyVault = _weeklyVault;
        freeRollVault = _freeRollVault;
        charityWallet = _charityWallet;
    }

    /**
     * @notice Emergency token recovery
     */
    function emergencyWithdraw(address token, uint256 amount)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        IPizzaToken(token).transfer(msg.sender, amount);
    }
}
