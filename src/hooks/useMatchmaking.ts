'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { Player, QueueEntry, MatchID, ENTRY_TIERS } from '@/types';

interface UseMatchmakingReturn {
  isInQueue: boolean;
  queuePlayers: Player[];
  matchId: MatchID | undefined;
  isMatchReady: boolean;
  countdown: number | null;
  selectedTier: number;
  joinQueue: (tier: number, player: Player) => Promise<void>;
  leaveQueue: () => void;
  setSelectedTier: (tier: number) => void;
}

// Simulated matchmaking for demo purposes
// In production, this would connect to a WebSocket or real-time database

const QUEUE_TIMEOUT = 60000; // 60 seconds
const MATCH_START_COUNTDOWN = 5; // 5 second countdown when match is found
const MIN_PLAYERS = 2;
const MAX_PLAYERS = 6;

export function useMatchmaking(currentPlayer: Player | null): UseMatchmakingReturn {
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePlayers, setQueuePlayers] = useState<Player[]>([]);
  const [matchId, setMatchId] = useState<MatchID | undefined>(undefined);
  const [isMatchReady, setIsMatchReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState(1);

  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const matchCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Simulated bot players for demo
  const generateBotPlayer = useCallback((index: number): Player => ({
    id: `bot_${index}_${Date.now()}`,
    fid: 100000 + index,
    displayName: `Player ${index + 1}`,
    pfpUrl: `https://api.dicebear.com/7.x/pixel-art/svg?seed=player${index}`,
    address: '0x' + Array(40).fill(0).map(() => Math.floor(Math.random() * 16).toString(16)).join(''),
    color: '',
  }), []);

  const joinQueue = useCallback(async (tier: number, player: Player) => {
    if (isInQueue) return;

    setSelectedTier(tier);
    setIsInQueue(true);
    setQueuePlayers([player]);

    // Simulate finding other players
    // In production, this would be handled by a matchmaking server
    const addPlayersInterval = setInterval(() => {
      setQueuePlayers(prev => {
        if (prev.length >= MIN_PLAYERS) {
          clearInterval(addPlayersInterval);
          return prev;
        }

        const newBot = generateBotPlayer(prev.length);
        return [...prev, newBot];
      });
    }, 1500 + Math.random() * 2000);

    matchCheckIntervalRef.current = addPlayersInterval;
  }, [isInQueue, generateBotPlayer]);

  const leaveQueue = useCallback(() => {
    setIsInQueue(false);
    setQueuePlayers([]);
    setMatchId(undefined);
    setIsMatchReady(false);
    setCountdown(null);

    if (matchCheckIntervalRef.current) {
      clearInterval(matchCheckIntervalRef.current);
      matchCheckIntervalRef.current = null;
    }

    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
  }, []);

  // Check if match is ready
  useEffect(() => {
    if (isInQueue && queuePlayers.length >= MIN_PLAYERS && !isMatchReady) {
      // Generate match ID
      const newMatchId = `match_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      setMatchId(newMatchId);
      setIsMatchReady(true);
      setCountdown(MATCH_START_COUNTDOWN);

      // Start countdown
      countdownIntervalRef.current = setInterval(() => {
        setCountdown(prev => {
          if (prev === null || prev <= 1) {
            if (countdownIntervalRef.current) {
              clearInterval(countdownIntervalRef.current);
              countdownIntervalRef.current = null;
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
  }, [isInQueue, queuePlayers.length, isMatchReady]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (matchCheckIntervalRef.current) {
        clearInterval(matchCheckIntervalRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  return {
    isInQueue,
    queuePlayers,
    matchId,
    isMatchReady,
    countdown,
    selectedTier,
    joinQueue,
    leaveQueue,
    setSelectedTier,
  };
}

// Interface for external use
export interface UseMatchmaking {
  joinQueue: (tier: number) => Promise<void>;
  leaveQueue: () => void;
  matchId?: string;
}
