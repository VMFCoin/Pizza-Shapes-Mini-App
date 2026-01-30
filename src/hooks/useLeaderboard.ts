'use client';

import { useState, useCallback, useEffect } from 'react';
import { PlayerStats, LeaderboardEntry, Player } from '@/types';

interface UseLeaderboardReturn {
  weekly: LeaderboardEntry[];
  lifetime: LeaderboardEntry[];
  isLoading: boolean;
  error: string | null;
  refreshLeaderboard: () => Promise<void>;
  getPlayerRank: (playerId: string, type: 'weekly' | 'lifetime') => number | null;
}

// Generate mock leaderboard data for demo
function generateMockStats(index: number, isWeekly: boolean): PlayerStats {
  const baseSlices = isWeekly ? 50 : 500;
  const baseWins = isWeekly ? 10 : 100;
  const baseGames = isWeekly ? 20 : 200;

  return {
    playerId: `player_${index}`,
    fid: 10000 + index,
    displayName: `PizzaMaster${index}`,
    pfpUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=player${index}`,
    gamesPlayed: Math.floor(baseGames * (1 - index * 0.05)),
    wins: Math.floor(baseWins * (1 - index * 0.08)),
    slicesCaptured: Math.floor(baseSlices * (1 - index * 0.07)),
    lifetimeEarnings: BigInt(Math.floor(1000000 * (1 - index * 0.1)) * 10 ** 18),
    weeklySlices: Math.floor(baseSlices * (1 - index * 0.1)),
  };
}

function createMockLeaderboard(count: number, isWeekly: boolean): LeaderboardEntry[] {
  const entries: LeaderboardEntry[] = [];

  for (let i = 0; i < count; i++) {
    const stats = generateMockStats(i, isWeekly);
    entries.push({
      rank: i + 1,
      player: {
        id: stats.playerId,
        fid: stats.fid,
        displayName: stats.displayName,
        pfpUrl: stats.pfpUrl,
        address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
        color: '',
      },
      stats,
    });
  }

  return entries;
}

export function useLeaderboard(): UseLeaderboardReturn {
  const [weekly, setWeekly] = useState<LeaderboardEntry[]>([]);
  const [lifetime, setLifetime] = useState<LeaderboardEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshLeaderboard = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // In production, fetch from API/blockchain
      // const response = await fetch('/api/leaderboard');
      // const data = await response.json();

      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Generate mock data
      setWeekly(createMockLeaderboard(20, true));
      setLifetime(createMockLeaderboard(20, false));
    } catch (err) {
      setError('Failed to load leaderboard');
      console.error('Leaderboard error:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const getPlayerRank = useCallback((playerId: string, type: 'weekly' | 'lifetime'): number | null => {
    const list = type === 'weekly' ? weekly : lifetime;
    const entry = list.find(e => e.player.id === playerId);
    return entry?.rank ?? null;
  }, [weekly, lifetime]);

  // Initial load
  useEffect(() => {
    refreshLeaderboard();
  }, [refreshLeaderboard]);

  return {
    weekly,
    lifetime,
    isLoading,
    error,
    refreshLeaderboard,
    getPlayerRank,
  };
}

// Player stats hook
export function usePlayerStats(playerId: string | null): {
  stats: PlayerStats | null;
  isLoading: boolean;
} {
  const [stats, setStats] = useState<PlayerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!playerId) {
      setStats(null);
      return;
    }

    const fetchStats = async () => {
      setIsLoading(true);
      try {
        // In production, fetch from API
        await new Promise(resolve => setTimeout(resolve, 300));

        setStats({
          playerId,
          fid: 12345,
          displayName: 'Current Player',
          pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=current',
          gamesPlayed: 42,
          wins: 15,
          slicesCaptured: 156,
          lifetimeEarnings: BigInt(25000) * BigInt(10 ** 18),
          weeklySlices: 28,
        });
      } catch (err) {
        console.error('Failed to fetch player stats:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchStats();
  }, [playerId]);

  return { stats, isLoading };
}

// Interface for external use
export interface UseLeaderboard {
  weekly: PlayerStats[];
  lifetime: PlayerStats[];
}
