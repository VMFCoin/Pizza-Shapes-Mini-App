'use client';

import { useState, useCallback } from 'react';
import { formatUnits, type Address } from 'viem';
import { usePublicClient } from 'wagmi';
import { CONTRACTS, PRIZE_DISTRIBUTION, CHARITY_WALLETS } from '@/lib/constants';
import { SETTLEMENT_ABI } from '@/lib/contractAbis';
import { tierToAmount } from '@/lib/contracts';

// Settlement result from backend
export interface SettlementResult {
  matchId: string;
  winner: Address;
  winnerPrize: bigint;
  totalPool: bigint;
  distribution: {
    winner: bigint;
    weeklyTop3: bigint;
    burned: bigint;
    dailyFreeRoll: bigint;
    charities: bigint;
    perCharity: bigint;
  };
  transactionHash?: `0x${string}`;
  timestamp: number;
}

export interface MatchSettlementInfo {
  matchId: string;
  players: Address[];
  scores: Record<Address, number>;
  tier: number;
  winner: Address;
  totalPool: bigint;
}

interface UseSettlementReturn {
  // Get settlement preview (what will be distributed)
  getSettlementPreview: (matchInfo: MatchSettlementInfo) => SettlementResult;

  // Fetch on-chain match data
  fetchMatchFromContract: (matchId: string) => Promise<OnChainMatch | null>;

  // Fetch pool balances
  fetchPoolBalances: () => Promise<PoolBalances | null>;

  // Format for display
  formatPrize: (amount: bigint) => string;
  formatPrizeUSD: (amount: bigint, pizzaPrice: number) => string;
}

interface OnChainMatch {
  matchId: string;
  players: Address[];
  entryAmount: bigint;
  totalPool: bigint;
  settled: boolean;
  createdAt: number;
  tier: number;
}

interface PoolBalances {
  weeklyPool: bigint;
  freeRollPool: bigint;
  totalBurned: bigint;
  totalCharityDistributed: bigint;
}

export function useSettlement(): UseSettlementReturn {
  const publicClient = usePublicClient();

  // Calculate settlement preview before on-chain execution
  const getSettlementPreview = useCallback((matchInfo: MatchSettlementInfo): SettlementResult => {
    const { matchId, winner, tier, players } = matchInfo;

    // Calculate total pool
    const entryAmount = tierToAmount(tier);
    const totalPool = entryAmount * BigInt(players.length);

    // Calculate distributions (basis points)
    const winnerAmt = (totalPool * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000);
    const weeklyAmt = (totalPool * BigInt(PRIZE_DISTRIBUTION.weekly)) / BigInt(10000);
    const burnAmt = (totalPool * BigInt(PRIZE_DISTRIBUTION.burn)) / BigInt(10000);
    const freeRollAmt = (totalPool * BigInt(PRIZE_DISTRIBUTION.freeRoll)) / BigInt(10000);
    const charityAmt = (totalPool * BigInt(PRIZE_DISTRIBUTION.charity)) / BigInt(10000);

    // Per-charity amount (9 charities)
    const perCharity = charityAmt / BigInt(9);

    return {
      matchId,
      winner,
      winnerPrize: winnerAmt,
      totalPool,
      distribution: {
        winner: winnerAmt,
        weeklyTop3: weeklyAmt,
        burned: burnAmt,
        dailyFreeRoll: freeRollAmt,
        charities: charityAmt,
        perCharity,
      },
      timestamp: Date.now(),
    };
  }, []);

  // Fetch match data from contract
  const fetchMatchFromContract = useCallback(async (
    matchId: string
  ): Promise<OnChainMatch | null> => {
    if (!publicClient) return null;

    try {
      const matchIdBytes = matchId.startsWith('0x')
        ? matchId as `0x${string}`
        : `0x${matchId.padEnd(64, '0')}` as `0x${string}`;

      const result = await publicClient.readContract({
        address: CONTRACTS.settlement as Address,
        abi: SETTLEMENT_ABI,
        functionName: 'getMatch',
        args: [matchIdBytes],
      }) as {
        matchId: `0x${string}`;
        players: Address[];
        entryAmount: bigint;
        totalPool: bigint;
        settled: boolean;
        createdAt: bigint;
        tier: number;
      };

      return {
        matchId: result.matchId,
        players: result.players,
        entryAmount: result.entryAmount,
        totalPool: result.totalPool,
        settled: result.settled,
        createdAt: Number(result.createdAt),
        tier: result.tier,
      };
    } catch (error) {
      console.error('Failed to fetch match from contract:', error);
      return null;
    }
  }, [publicClient]);

  // Fetch current pool balances
  const fetchPoolBalances = useCallback(async (): Promise<PoolBalances | null> => {
    if (!publicClient) return null;

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.settlement as Address,
        abi: SETTLEMENT_ABI,
        functionName: 'getPoolBalances',
      }) as [bigint, bigint, bigint, bigint];

      return {
        weeklyPool: result[0],
        freeRollPool: result[1],
        totalBurned: result[2],
        totalCharityDistributed: result[3],
      };
    } catch (error) {
      console.error('Failed to fetch pool balances:', error);
      return null;
    }
  }, [publicClient]);

  // Format prize amount
  const formatPrize = useCallback((amount: bigint): string => {
    const value = Number(formatUnits(amount, 18));
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    if (value >= 1) return value.toFixed(2);
    return value.toFixed(4);
  }, []);

  // Format prize in USD
  const formatPrizeUSD = useCallback((amount: bigint, pizzaPrice: number): string => {
    const pizzaValue = Number(formatUnits(amount, 18));
    const usdValue = pizzaValue * pizzaPrice;
    return `$${usdValue.toFixed(2)}`;
  }, []);

  return {
    getSettlementPreview,
    fetchMatchFromContract,
    fetchPoolBalances,
    formatPrize,
    formatPrizeUSD,
  };
}

// Helper: Get charity info for display
export function getCharityInfo() {
  return Object.entries(CHARITY_WALLETS).map(([key, address]) => {
    // Convert camelCase to readable name
    const name = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();

    return { name, address };
  });
}

// Helper: Calculate what a winner receives for a given entry
export function calculateWinnerPrize(tier: number, playerCount: number): bigint {
  const entryAmount = tierToAmount(tier);
  const totalPool = entryAmount * BigInt(playerCount);
  return (totalPool * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000);
}

// Helper: Get distribution breakdown for display
export function getDistributionBreakdown(totalPool: bigint): {
  label: string;
  percentage: string;
  amount: bigint;
  description: string;
}[] {
  return [
    {
      label: 'Winner',
      percentage: '77%',
      amount: (totalPool * BigInt(7700)) / BigInt(10000),
      description: 'Paid directly to winner\'s wallet',
    },
    {
      label: 'Weekly Top 3',
      percentage: '10%',
      amount: (totalPool * BigInt(1000)) / BigInt(10000),
      description: 'Accumulated for weekly leaderboard rewards',
    },
    {
      label: 'Burned',
      percentage: '7%',
      amount: (totalPool * BigInt(700)) / BigInt(10000),
      description: 'Permanently removed from circulation',
    },
    {
      label: 'Daily Free Roll',
      percentage: '3%',
      amount: (totalPool * BigInt(300)) / BigInt(10000),
      description: 'Prize pool for daily free roll winners',
    },
    {
      label: 'Veteran Charities',
      percentage: '3%',
      amount: (totalPool * BigInt(300)) / BigInt(10000),
      description: 'Split equally among 9 veteran charities',
    },
  ];
}
