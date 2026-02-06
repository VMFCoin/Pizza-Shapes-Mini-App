import { PIZZA_TOKEN_ADDRESS } from '@/types';
import { usdToPizzaAmount } from '@/lib/priceService';

// Contract addresses (to be deployed)
export const PIZZA_DOTS_CONTRACT_ADDRESS = '0x0000000000000000000000000000000000000000'; // Update after deployment

// ERC20 ABI for $PIZZA token
export const ERC20_ABI = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_spender', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'approve',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [
      { name: '_owner', type: 'address' },
      { name: '_spender', type: 'address' },
    ],
    name: 'allowance',
    outputs: [{ name: '', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const;

// Pizza Dots contract ABI
export const PIZZA_DOTS_ABI = [
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
  // Enter match
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
  // Get player stats
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
          { name: 'winner', type: 'address' },
          { name: 'settled', type: 'bool' },
          { name: 'createdAt', type: 'uint256' },
        ],
        type: 'tuple',
      },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Get weekly top 3
  {
    inputs: [],
    name: 'getWeeklyTop3',
    outputs: [
      { name: '', type: 'address[3]' },
      { name: '', type: 'uint256[3]' },
    ],
    stateMutability: 'view',
    type: 'function',
  },
  // Pool balances
  {
    inputs: [],
    name: 'dailyFreeRollPool',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'weeklyJackpotPool',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  {
    inputs: [],
    name: 'weeklyTop3Pool',
    outputs: [{ type: 'uint256' }],
    stateMutability: 'view',
    type: 'function',
  },
  // Events
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: false, name: 'players', type: 'address[]' },
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
    name: 'MatchEntered',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'matchId', type: 'bytes32' },
      { indexed: true, name: 'winner', type: 'address' },
      { indexed: false, name: 'prize', type: 'uint256' },
    ],
    name: 'MatchSettled',
    type: 'event',
  },
  {
    anonymous: false,
    inputs: [
      { indexed: true, name: 'fid', type: 'uint256' },
      { indexed: false, name: 'selection', type: 'uint8' },
      { indexed: false, name: 'result', type: 'uint8' },
      { indexed: false, name: 'won', type: 'bool' },
      { indexed: false, name: 'prize', type: 'uint256' },
    ],
    name: 'FreeRollPlayed',
    type: 'event',
  },
] as const;

// USD amounts per tier
const TIER_USD: Record<number, number> = {
  1: 0.25,
  2: 0.50,
  3: 1.00,
};

/**
 * Convert entry tier to PIZZA token amount using live USD price.
 * If no priceUsd provided, returns null (price required for V3 contract).
 */
export function tierToAmount(tier: number, priceUsd?: number): bigint {
  const usdAmount = TIER_USD[tier];
  if (!usdAmount) return BigInt(0);

  if (!priceUsd || priceUsd <= 0) {
    // Fallback: return 0 — caller must have a valid price
    return BigInt(0);
  }

  return usdToPizzaAmount(usdAmount, priceUsd);
}

/**
 * Get the USD amount for a tier (for display purposes)
 */
export function tierToUsdAmount(tier: number): number {
  return TIER_USD[tier] || 0;
}

// Generate match ID from parameters
export function generateMatchId(tier: number, timestamp: number): string {
  const data = `pizza_dots_${tier}_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;
  // In production, use proper keccak256 hashing
  return '0x' + Array.from(data).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('').padEnd(64, '0');
}
