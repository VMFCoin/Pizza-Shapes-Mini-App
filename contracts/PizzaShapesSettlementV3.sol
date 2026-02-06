// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./PizzaUUPSBase.sol";
import "./interfaces/IPizzaToken.sol";
import "./interfaces/IPizzaDotsStats.sol";

/**
 * @title PizzaShapesSettlementV3
 * @notice V3 upgrade: accepts dynamic PIZZA amounts instead of fixed tiers
 * @dev Frontend calculates USD-equivalent PIZZA amount via DexScreener/CoinGecko
 *
 * Prize Distribution:
 * - 77% → Match winner (paid directly to their wallet)
 * - 10% → Weekly Top 3 pool (held in contract vault)
 * - 7%  → Burned permanently (sent to burn address)
 * - 3%  → Daily Free Roll pool (held in contract vault)
 * - 3%  → Veteran charities (split 9 ways)
 */
contract PizzaShapesSettlementV3 is PizzaUUPSBase {
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
    uint256 public constant TOTAL_BPS = 10000;      // 100%

    // Burn address - tokens sent here are permanently removed from circulation
    address public constant BURN_ADDRESS = 0x000000000000000000000000000000000000dEaD;

    // Minimum entry amount to prevent dust entries (admin-configurable)
    uint256 public minEntryAmount;

    // Vault addresses for pool accumulation
    address public weeklyVault;      // Holds 10% for weekly top 3
    address public freeRollVault;    // Holds 3% for daily free roll

    // 9 Veteran charity addresses (3% split evenly)
    address[9] public charityWallets;
    uint256 public constant CHARITY_COUNT = 9;

    // Pool tracking (in-contract accounting)
    uint256 public weeklyPool;
    uint256 public freeRollPool;
    uint256 public totalBurned;
    uint256 public totalCharityDistributed;

    // Match tracking
    struct Match {
        bytes32 matchId;
        address[] players;
        uint256 entryAmount;
        uint256 totalPool;
        bool settled;
        uint256 createdAt;
        uint8 tier; // kept for storage layout compatibility (unused in V3)
    }

    mapping(bytes32 => Match) public matches;
    mapping(bytes32 => mapping(address => uint256)) public playerSlices;
    mapping(bytes32 => mapping(address => bool)) public playerEntered;

    // Events
    event MatchCreated(bytes32 indexed matchId, uint256 entryAmount);
    event PlayerEntered(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchSettled(
        bytes32 indexed matchId,
        address indexed winner,
        uint256 winnerPrize,
        uint256 totalPool
    );
    event FundsDistributed(
        bytes32 indexed matchId,
        uint256 winnerAmount,
        uint256 weeklyAmount,
        uint256 burnedAmount,
        uint256 freeRollAmount,
        uint256 charityAmount
    );
    event CharityDistribution(
        bytes32 indexed matchId,
        address indexed charity,
        uint256 amount
    );
    event TokensBurned(bytes32 indexed matchId, uint256 amount);
    event WeeklyPayoutDistributed(address[3] winners, uint256[3] amounts);
    event FreeRollWinner(address indexed winner, uint256 amount);
    event MinEntryAmountUpdated(uint256 newAmount);

    // Custom errors
    error AmountTooLow();
    error MatchAlreadySettled();
    error AmountMismatch();
    error MatchFull();
    error AlreadyEntered();
    error MatchNotFound();
    error PlayerLengthMismatch();
    error TransferFailed();
    error InsufficientPoolBalance();

    // Note: No new initialize() — this is a UUPS upgrade, state is preserved from V2

    /**
     * @notice Set minimum entry amount (admin only)
     * @param _minEntryAmount Minimum PIZZA tokens (18 decimals) required to enter
     */
    function setMinEntryAmount(uint256 _minEntryAmount) external onlyRole(DEFAULT_ADMIN_ROLE) {
        minEntryAmount = _minEntryAmount;
        emit MinEntryAmountUpdated(_minEntryAmount);
    }

    /**
     * @notice Enter a match with a dynamic PIZZA amount
     * @dev Player must have approved this contract to spend their PIZZA tokens.
     *      First player sets the match entry amount; subsequent players must match it.
     * @param matchId Unique match identifier
     * @param amount PIZZA token amount (18 decimals) — calculated by frontend as USD equivalent
     */
    function enterMatch(bytes32 matchId, uint256 amount) external whenNotPaused {
        if (amount < minEntryAmount) revert AmountTooLow();

        Match storage m = matches[matchId];

        // Create new match if doesn't exist
        if (m.createdAt == 0) {
            m.matchId = matchId;
            m.entryAmount = amount;
            m.createdAt = block.timestamp;
            emit MatchCreated(matchId, amount);
        } else {
            if (m.settled) revert MatchAlreadySettled();
            if (m.entryAmount != amount) revert AmountMismatch();
            if (m.players.length >= 6) revert MatchFull();
        }

        // Check not already entered
        if (playerEntered[matchId][msg.sender]) revert AlreadyEntered();

        // Transfer entry fee from player to this contract
        bool success = pizza.transferFrom(msg.sender, address(this), amount);
        if (!success) revert TransferFailed();

        m.players.push(msg.sender);
        m.totalPool += amount;
        playerEntered[matchId][msg.sender] = true;

        emit PlayerEntered(matchId, msg.sender, amount);
    }

    /**
     * @notice Settle a completed match and distribute prizes
     * @dev Only callable by OPERATOR_ROLE (backend settlement service)
     * @param matchId Match to settle
     * @param winner Winner's address
     * @param players All players in match order
     * @param slices Slices captured by each player (same order as players)
     */
    function settleMatch(
        bytes32 matchId,
        address winner,
        address[] calldata players,
        uint256[] calldata slices
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        Match storage m = matches[matchId];
        if (m.createdAt == 0) revert MatchNotFound();
        if (m.settled) revert MatchAlreadySettled();
        if (players.length != slices.length) revert PlayerLengthMismatch();

        uint256 totalPool = m.totalPool;

        // Calculate all distributions
        uint256 winnerAmt = (totalPool * WINNER_BPS) / TOTAL_BPS;
        uint256 weeklyAmt = (totalPool * WEEKLY_BPS) / TOTAL_BPS;
        uint256 burnAmt = (totalPool * BURN_BPS) / TOTAL_BPS;
        uint256 freeRollAmt = (totalPool * FREE_ROLL_BPS) / TOTAL_BPS;
        uint256 charityAmt = (totalPool * CHARITY_BPS) / TOTAL_BPS;

        // 1. Pay winner directly to their wallet (77%)
        if (!pizza.transfer(winner, winnerAmt)) revert TransferFailed();

        // 2. Add to weekly pool vault (10%)
        if (!pizza.transfer(weeklyVault, weeklyAmt)) revert TransferFailed();
        weeklyPool += weeklyAmt;

        // 3. BURN tokens permanently (7%)
        if (!pizza.transfer(BURN_ADDRESS, burnAmt)) revert TransferFailed();
        totalBurned += burnAmt;
        emit TokensBurned(matchId, burnAmt);

        // 4. Add to free roll pool vault (3%)
        if (!pizza.transfer(freeRollVault, freeRollAmt)) revert TransferFailed();
        freeRollPool += freeRollAmt;

        // 5. Distribute to charities (3% split 9 ways)
        _distributeToCharities(matchId, charityAmt);

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

        emit FundsDistributed(
            matchId,
            winnerAmt,
            weeklyAmt,
            burnAmt,
            freeRollAmt,
            charityAmt
        );
        emit MatchSettled(matchId, winner, winnerAmt, totalPool);
    }

    /**
     * @notice Distribute charity allocation to all 9 charities
     */
    function _distributeToCharities(bytes32 matchId, uint256 totalCharityAmt) internal {
        uint256 perCharity = totalCharityAmt / CHARITY_COUNT;

        for (uint256 i = 0; i < CHARITY_COUNT; i++) {
            if (!pizza.transfer(charityWallets[i], perCharity)) revert TransferFailed();
            emit CharityDistribution(matchId, charityWallets[i], perCharity);
        }

        totalCharityDistributed += totalCharityAmt;
    }

    /**
     * @notice Distribute weekly top 3 rewards
     */
    function distributeWeeklyTop3(
        address[3] calldata winners,
        uint256[3] calldata percentages
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        uint256 poolBalance = pizza.balanceOf(weeklyVault);
        if (poolBalance == 0) revert InsufficientPoolBalance();

        uint256[3] memory amounts;

        for (uint256 i = 0; i < 3; i++) {
            if (winners[i] != address(0)) {
                amounts[i] = (poolBalance * percentages[i]) / 100;
                if (!pizza.transferFrom(weeklyVault, winners[i], amounts[i])) {
                    revert TransferFailed();
                }
            }
        }

        weeklyPool = 0;
        emit WeeklyPayoutDistributed(winners, amounts);
    }

    /**
     * @notice Pay out daily free roll winner
     */
    function payFreeRollWinner(
        address winner,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) whenNotPaused {
        if (amount > freeRollPool) revert InsufficientPoolBalance();

        if (!pizza.transferFrom(freeRollVault, winner, amount)) {
            revert TransferFailed();
        }

        freeRollPool -= amount;
        emit FreeRollWinner(winner, amount);
    }

    // ============ View Functions ============

    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    function getCharityWallets() external view returns (address[9] memory) {
        return charityWallets;
    }

    function getPoolBalances() external view returns (
        uint256 weekly,
        uint256 freeRoll,
        uint256 burned,
        uint256 charity
    ) {
        return (weeklyPool, freeRollPool, totalBurned, totalCharityDistributed);
    }

    function calculatePrizeBreakdown(uint256 totalPool) external pure returns (
        uint256 winnerAmt,
        uint256 weeklyAmt,
        uint256 burnAmt,
        uint256 freeRollAmt,
        uint256 charityAmt
    ) {
        winnerAmt = (totalPool * WINNER_BPS) / TOTAL_BPS;
        weeklyAmt = (totalPool * WEEKLY_BPS) / TOTAL_BPS;
        burnAmt = (totalPool * BURN_BPS) / TOTAL_BPS;
        freeRollAmt = (totalPool * FREE_ROLL_BPS) / TOTAL_BPS;
        charityAmt = (totalPool * CHARITY_BPS) / TOTAL_BPS;
    }

    // ============ Admin Functions ============

    function setVaults(
        address _weeklyVault,
        address _freeRollVault
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        weeklyVault = _weeklyVault;
        freeRollVault = _freeRollVault;
    }

    function setCharityWallets(
        address[9] calldata _charityWallets
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        charityWallets = _charityWallets;
    }

    function emergencyWithdraw(
        address token,
        uint256 amount
    ) external onlyRole(DEFAULT_ADMIN_ROLE) {
        IPizzaToken(token).transfer(msg.sender, amount);
    }
}
