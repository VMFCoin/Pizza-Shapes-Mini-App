// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/AccessControlUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title PizzaShapes
 * @notice A multiplayer turn-based strategy game on Base mainnet
 * @dev UUPS Upgradeable contract for managing Pizza Shapes matches and rewards
 */
contract PizzaShapes is
    Initializable,
    UUPSUpgradeable,
    AccessControlUpgradeable,
    ReentrancyGuardUpgradeable
{
    using SafeERC20 for IERC20;

    // Roles
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    // $PIZZA token address on Base mainnet
    IERC20 public pizzaToken;

    // Prize distribution percentages (basis points, 100 = 1%)
    uint256 public constant CHARITY_PERCENTAGE = 300;      // 3%
    uint256 public constant BURN_PERCENTAGE = 700;          // 7%
    uint256 public constant FREE_ROLL_PERCENTAGE = 300;     // 3%
    uint256 public constant WEEKLY_TOP3_PERCENTAGE = 1000;  // 10%
    uint256 public constant WINNER_PERCENTAGE = 6700;       // 67%
    // Remainder goes to weekly jackpot                     // 10%

    // Entry tiers (in PIZZA tokens, 18 decimals)
    uint256 public constant TIER_1 = 0.25 ether;  // $0.25 equivalent
    uint256 public constant TIER_2 = 0.50 ether;  // $0.50 equivalent
    uint256 public constant TIER_3 = 1.00 ether;  // $1.00 equivalent

    // Addresses for fund distribution
    address public charityWallet;
    address public burnAddress;

    // Pool tracking
    uint256 public dailyFreeRollPool;
    uint256 public weeklyJackpotPool;
    uint256 public weeklyTop3Pool;

    // Match data
    struct Match {
        bytes32 matchId;
        address[] players;
        uint256 entryAmount;
        uint256 totalPool;
        address winner;
        bool settled;
        uint256 createdAt;
    }

    // Player statistics
    struct PlayerStats {
        uint256 gamesPlayed;
        uint256 wins;
        uint256 slicesCaptured;
        uint256 lifetimeEarnings;
        uint256 weeklySlices;
        uint256 lastWeekReset;
    }

    // Free roll data
    struct FreeRoll {
        uint256 fid;
        uint8 selection;
        uint8 rolledNumber;
        bool won;
        uint256 prizeAmount;
        uint256 timestamp;
    }

    // Storage
    mapping(bytes32 => Match) public matches;
    mapping(address => PlayerStats) public playerStats;
    mapping(uint256 => mapping(uint256 => bool)) public dailyFreeRollUsed; // fid => day => used
    mapping(uint256 => FreeRoll) public freeRollResults; // fid => result

    // Weekly tracking
    uint256 public currentWeekStart;
    address[3] public weeklyTop3;
    uint256[3] public weeklyTop3Scores;

    // Events
    event MatchCreated(bytes32 indexed matchId, address[] players, uint256 entryAmount);
    event MatchEntered(bytes32 indexed matchId, address indexed player, uint256 amount);
    event MatchSettled(bytes32 indexed matchId, address indexed winner, uint256 prize);
    event FreeRollPlayed(uint256 indexed fid, uint8 selection, uint8 result, bool won, uint256 prize);
    event WeeklyPrizesDistributed(address[3] winners, uint256[3] prizes);
    event DailyFreeRollSettled(uint256 totalWinners, uint256 totalPrize);
    event SlicesCaptured(address indexed player, uint256 matchId, uint256 slices);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    /**
     * @notice Initialize the contract
     * @param _pizzaToken Address of the $PIZZA token
     * @param _charityWallet Address for charity donations
     * @param _admin Initial admin address
     */
    function initialize(
        address _pizzaToken,
        address _charityWallet,
        address _admin
    ) public initializer {
        __AccessControl_init();
        __UUPSUpgradeable_init();
        __ReentrancyGuard_init();

        pizzaToken = IERC20(_pizzaToken);
        charityWallet = _charityWallet;
        burnAddress = address(0xdead);

        _grantRole(DEFAULT_ADMIN_ROLE, _admin);
        _grantRole(ADMIN_ROLE, _admin);
        _grantRole(OPERATOR_ROLE, _admin);

        currentWeekStart = block.timestamp;
    }

    /**
     * @notice Enter a match with entry fee
     * @param matchId Unique match identifier
     * @param amount Entry amount (must match tier)
     */
    function enterMatch(
        bytes32 matchId,
        uint256 amount
    ) external nonReentrant {
        require(
            amount == TIER_1 || amount == TIER_2 || amount == TIER_3,
            "Invalid entry amount"
        );

        Match storage matchData = matches[matchId];

        // Create new match if doesn't exist
        if (matchData.createdAt == 0) {
            matchData.matchId = matchId;
            matchData.entryAmount = amount;
            matchData.createdAt = block.timestamp;
        } else {
            require(!matchData.settled, "Match already settled");
            require(matchData.entryAmount == amount, "Entry amount mismatch");
            require(matchData.players.length < 6, "Match full");
        }

        // Transfer tokens from player
        pizzaToken.safeTransferFrom(msg.sender, address(this), amount);

        matchData.players.push(msg.sender);
        matchData.totalPool += amount;

        // Update player stats
        playerStats[msg.sender].gamesPlayed++;

        emit MatchEntered(matchId, msg.sender, amount);
    }

    /**
     * @notice Settle a completed match
     * @param matchId Match to settle
     * @param winner Winner's address
     * @param slicesCaptured Mapping of player addresses to slices captured
     */
    function settleMatch(
        bytes32 matchId,
        address winner,
        address[] calldata players,
        uint256[] calldata slicesCaptured
    ) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Match storage matchData = matches[matchId];
        require(matchData.createdAt > 0, "Match not found");
        require(!matchData.settled, "Already settled");

        uint256 totalPool = matchData.totalPool;

        // Calculate distributions
        uint256 charityAmount = (totalPool * CHARITY_PERCENTAGE) / 10000;
        uint256 burnAmount = (totalPool * BURN_PERCENTAGE) / 10000;
        uint256 freeRollAmount = (totalPool * FREE_ROLL_PERCENTAGE) / 10000;
        uint256 weeklyTop3Amount = (totalPool * WEEKLY_TOP3_PERCENTAGE) / 10000;
        uint256 winnerAmount = (totalPool * WINNER_PERCENTAGE) / 10000;
        uint256 jackpotAmount = totalPool - charityAmount - burnAmount - freeRollAmount - weeklyTop3Amount - winnerAmount;

        // Distribute funds
        pizzaToken.safeTransfer(charityWallet, charityAmount);
        pizzaToken.safeTransfer(burnAddress, burnAmount);

        dailyFreeRollPool += freeRollAmount;
        weeklyTop3Pool += weeklyTop3Amount;
        weeklyJackpotPool += jackpotAmount;

        // Pay winner
        pizzaToken.safeTransfer(winner, winnerAmount);

        // Update match
        matchData.winner = winner;
        matchData.settled = true;

        // Update player stats
        playerStats[winner].wins++;
        playerStats[winner].lifetimeEarnings += winnerAmount;

        // Update slices captured for all players
        for (uint256 i = 0; i < players.length; i++) {
            playerStats[players[i]].slicesCaptured += slicesCaptured[i];
            playerStats[players[i]].weeklySlices += slicesCaptured[i];
            _updateWeeklyTop3(players[i], playerStats[players[i]].weeklySlices);
        }

        emit MatchSettled(matchId, winner, winnerAmount);
    }

    /**
     * @notice Record a free roll attempt
     * @param fid Farcaster ID
     * @param selection Player's number selection (1-6)
     * @param rolledNumber The random number rolled (1-6)
     */
    function recordFreeRoll(
        uint256 fid,
        uint8 selection,
        uint8 rolledNumber
    ) external onlyRole(OPERATOR_ROLE) {
        uint256 today = block.timestamp / 1 days;
        require(!dailyFreeRollUsed[fid][today], "Already used free roll today");
        require(selection >= 1 && selection <= 6, "Invalid selection");
        require(rolledNumber >= 1 && rolledNumber <= 6, "Invalid roll");

        dailyFreeRollUsed[fid][today] = true;

        bool won = selection == rolledNumber;
        uint256 prizeAmount = 0;

        if (won && dailyFreeRollPool > 0) {
            // Winner gets a share of the daily pool
            prizeAmount = dailyFreeRollPool / 10; // 10% of pool per winner
            if (prizeAmount > dailyFreeRollPool) {
                prizeAmount = dailyFreeRollPool;
            }
            dailyFreeRollPool -= prizeAmount;
        }

        freeRollResults[fid] = FreeRoll({
            fid: fid,
            selection: selection,
            rolledNumber: rolledNumber,
            won: won,
            prizeAmount: prizeAmount,
            timestamp: block.timestamp
        });

        emit FreeRollPlayed(fid, selection, rolledNumber, won, prizeAmount);
    }

    /**
     * @notice Distribute weekly prizes to top 3 players
     */
    function distributeWeeklyPrizes() external onlyRole(OPERATOR_ROLE) {
        require(block.timestamp >= currentWeekStart + 7 days, "Week not complete");

        uint256 totalPrize = weeklyTop3Pool + weeklyJackpotPool;
        uint256[3] memory prizes;

        if (totalPrize > 0) {
            // 50% to 1st, 30% to 2nd, 20% to 3rd
            prizes[0] = (totalPrize * 50) / 100;
            prizes[1] = (totalPrize * 30) / 100;
            prizes[2] = totalPrize - prizes[0] - prizes[1];

            for (uint256 i = 0; i < 3; i++) {
                if (weeklyTop3[i] != address(0) && prizes[i] > 0) {
                    pizzaToken.safeTransfer(weeklyTop3[i], prizes[i]);
                    playerStats[weeklyTop3[i]].lifetimeEarnings += prizes[i];
                }
            }
        }

        emit WeeklyPrizesDistributed(weeklyTop3, prizes);

        // Reset weekly tracking
        weeklyTop3Pool = 0;
        weeklyJackpotPool = 0;
        currentWeekStart = block.timestamp;
        delete weeklyTop3;
        delete weeklyTop3Scores;
    }

    /**
     * @notice Update weekly top 3 leaderboard
     */
    function _updateWeeklyTop3(address player, uint256 score) internal {
        // Check if player should be in top 3
        for (uint256 i = 0; i < 3; i++) {
            if (score > weeklyTop3Scores[i]) {
                // Shift lower scores down
                for (uint256 j = 2; j > i; j--) {
                    weeklyTop3[j] = weeklyTop3[j-1];
                    weeklyTop3Scores[j] = weeklyTop3Scores[j-1];
                }
                weeklyTop3[i] = player;
                weeklyTop3Scores[i] = score;
                break;
            }
        }
    }

    /**
     * @notice Get player statistics
     */
    function getPlayerStats(address player) external view returns (PlayerStats memory) {
        return playerStats[player];
    }

    /**
     * @notice Get match details
     */
    function getMatch(bytes32 matchId) external view returns (Match memory) {
        return matches[matchId];
    }

    /**
     * @notice Get current weekly top 3
     */
    function getWeeklyTop3() external view returns (address[3] memory, uint256[3] memory) {
        return (weeklyTop3, weeklyTop3Scores);
    }

    /**
     * @notice Update charity wallet address
     */
    function setCharityWallet(address _charityWallet) external onlyRole(ADMIN_ROLE) {
        charityWallet = _charityWallet;
    }

    /**
     * @notice Required for UUPS upgrades
     */
    function _authorizeUpgrade(address newImplementation) internal override onlyRole(ADMIN_ROLE) {}

    /**
     * @notice Emergency withdraw (admin only)
     */
    function emergencyWithdraw(address token, uint256 amount) external onlyRole(ADMIN_ROLE) {
        IERC20(token).safeTransfer(msg.sender, amount);
    }
}
