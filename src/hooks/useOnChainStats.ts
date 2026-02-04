'use client';

import { useState, useCallback, useEffect } from 'react';
import { usePublicClient } from 'wagmi';
import { type Address } from 'viem';
import { CONTRACTS } from '@/lib/constants';
import { STATS_ABI } from '@/lib/contractAbis';

export interface OnChainPlayerStats {
  gamesPlayed: number;
  wins: number;
  slicesCaptured: number;
  lifetimeEarnings: bigint;
  weeklySlices: number;
  lastWeekReset: number;
}

interface UseOnChainStatsReturn {
  stats: OnChainPlayerStats | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function useOnChainStats(address: Address | undefined): UseOnChainStatsReturn {
  const publicClient = usePublicClient();

  const [stats, setStats] = useState<OnChainPlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!address || !publicClient) {
      setStats(null);
      return;
    }

    // Check if stats contract is configured
    if (!CONTRACTS.stats || CONTRACTS.stats === '0x0000000000000000000000000000000000000000') {
      setError('Stats contract not configured');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await publicClient.readContract({
        address: CONTRACTS.stats as Address,
        abi: STATS_ABI,
        functionName: 'getPlayerStats',
        args: [address],
      }) as {
        gamesPlayed: bigint;
        wins: bigint;
        slicesCaptured: bigint;
        lifetimeEarnings: bigint;
        weeklySlices: bigint;
        lastWeekReset: bigint;
      };

      setStats({
        gamesPlayed: Number(result.gamesPlayed),
        wins: Number(result.wins),
        slicesCaptured: Number(result.slicesCaptured),
        lifetimeEarnings: result.lifetimeEarnings,
        weeklySlices: Number(result.weeklySlices),
        lastWeekReset: Number(result.lastWeekReset),
      });
    } catch (err) {
      console.error('Failed to fetch on-chain stats:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch stats');
      setStats(null);
    } finally {
      setIsLoading(false);
    }
  }, [address, publicClient]);

  // Fetch stats when address changes
  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return {
    stats,
    isLoading,
    error,
    refetch: fetchStats,
  };
}
