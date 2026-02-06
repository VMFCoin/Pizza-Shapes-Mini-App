// Contract ABIs for Pizza Shapes

// Standard ERC20 ABI for $PIZZA token
export const ERC20_ABI = [
  {
    inputs: [{ name: 'owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'owner', type: 'address' },
      { name: 'spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [
      { name: 'from', type: 'address' },
      { name: 'to', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'transferFrom',
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  {
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'totalSupply',
    outputs: [{ name: '', type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// PizzaShapesSettlement ABI
export const SETTLEMENT_ABI = [
  // Entry tiers
  {
    inputs: [],
    name: 'TIER_1',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'TIER_2',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'TIER_3',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Distribution constants
  {
    inputs: [],
    name: 'WINNER_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'WEEKLY_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'BURN_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'FREE_ROLL_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'CHARITY_BPS',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'BURN_ADDRESS',
    outputs: [{ type: 'address' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Enter match (V3: dynamic amount instead of tier)
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'enterMatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Settle match (operator only)
  {
    inputs: [
      { name: 'matchId', type: 'bytes32' },
      { name: 'winner', type: 'address' },
      { name: 'players', type: 'address[]' },
      { name: 'slices', type: 'uint256[]' },
    ],
    name: 'settleMatch',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Get tier amount
  {
    inputs: [{ name: 'tier', type: 'uint8' }],
    name: 'getTierAmount',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get match
  {
    inputs: [{ name: 'matchId', type: 'bytes32' }],
    name: 'getMatch',
    outputs: [
      {
        components: [
          { name: 'matchId', type: 'bytes32' },
          { name: 'players', type: 'address[]' },
          { name: 'entryAmount', type: 'uint256' },
          { name: 'totalPool', type: 'uint256' },
          { name: 'settled', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
          { name: 'tier', type: 'uint8' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get charity wallets
  {
    inputs: [],
    name: 'getCharityWallets',
    outputs: [{ type: 'address[9]' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Get pool balances
  {
    inputs: [],
    name: 'getPoolBalances',
    outputs: [
      { name: 'weekly', type: 'uint256' },
      { name: 'freeRoll', type: 'uint256' },
      { name: 'burned', type: 'uint256' },
      { name: 'charity', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Calculate prize breakdown
  {
    inputs: [{ name: 'totalPool', type: 'uint256' }],
    name: 'calculatePrizeBreakdown',
    outputs: [
      { name: 'winnerAmt', type: 'uint256' },
      { name: 'weeklyAmt', type: 'uint256' },
      { name: 'burnAmt', type: 'uint256' },
      { name: 'freeRollAmt', type: 'uint256' },
      { name: 'charityAmt', type: 'uint256' },
    ],
    stateMutability: 'pure',
    type: 'function',
  },
  // Weekly payout (operator only)
  {
    inputs: [
      { name: 'winners', type: 'address[3]' },
      { name: 'percentages', type: 'uint256[3]' },
    ],
    name: 'distributeWeeklyTop3',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Free roll payout (operator only)
  {
    inputs: [
      { name: 'winner', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    name: 'payFreeRollWinner',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: false, name: 'tier', type: 'uint8' },
      { indexed: false, name: 'entryAmount', type: 'uint256' },
    ],
    name: 'MatchCreated',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'player', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'PlayerEntered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'winnerPrize', type: 'uint256' },
      { indexed: false, name: 'totalPool', type: 'uint256' },
    ],
    name: 'MatchSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: false, name: 'winnerAmount', type: 'uint256' },
      { indexed: false, name: 'weeklyAmount', type: 'uint256' },
      { indexed: false, name: 'burnedAmount', type: 'uint256' },
      { indexed: false, name: 'freeRollAmount', type: 'uint256' },
      { indexed: false, name: 'charityAmount', type: 'uint256' },
    ],
    name: 'FundsDistributed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'charity', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'CharityDistribution',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'TokensBurned',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: false, name: 'winners', type: 'address[3]' },
      { indexed: false, name: 'amounts', type: 'uint256[3]' },
    ],
    name: 'WeeklyPayoutDistributed',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'amount', type: 'uint256' },
    ],
    name: 'FreeRollWinner',
    type: 'event',
  },
] as const;

// PizzaShapesStats ABI
export const STATS_ABI = [
  {
    inputs: [{ name: 'player', type: 'address' }],
    name: 'getPlayerStats',
    outputs: [
      {
        components: [
          { name: 'gamesPlayed', type: 'uint256' },
          { name: 'wins', type: 'uint256' },
          { name: 'slicesCaptured', type: 'uint256' },
          { name: 'lifetimeEarnings', type: 'uint256' },
          { name: 'weeklySlices', type: 'uint256' },
          { name: 'lastWeekReset', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'count', type: 'uint256' }],
    name: 'getWeeklyTopPlayers',
    outputs: [
      { name: 'addresses', type: 'address[]' },
      { name: 'slices', type: 'uint256[]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
] as const;

// Daily Free Roll ABI
export const FREE_ROLL_ABI = [
  {
    inputs: [{ name: 'fid', type: 'uint256' }],
    name: 'hasRolledToday',
    outputs: [{ type: 'bool' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [{ name: 'fid', type: 'uint256' }],
    name: 'getLastRoll',
    outputs: [
      { name: 'selection', type: 'uint8' },
      { name: 'result', type: 'uint8' },
      { name: 'won', type: 'bool' },
      { name: 'prize', type: 'uint256' },
      { name: 'timestamp', type: 'uint256' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'getDailyPool',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Roll is called by operator after VRF
  {
    inputs: [
      { name: 'fid', type: 'uint256' },
      { name: 'playerAddress', type: 'address' },
      { name: 'selection', type: 'uint8' },
      { name: 'result', type: 'uint8' },
    ],
    name: 'roll',
    outputs: [],
    stateMutability: 'nonpayable',
    type: 'function',
  },
] as const;
