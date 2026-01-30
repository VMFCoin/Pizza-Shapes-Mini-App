'use client';

import { useCallback, useState, useEffect } from 'react';
import { FarcasterContext, PIZZA_TOKEN_ADDRESS } from '@/types';

interface UseFarcasterReturn {
  context: FarcasterContext | null;
  isLoading: boolean;
  isFrameContext: boolean;
  viewToken: (tokenAddress?: string) => void;
  composeCast: (text: string) => void;
  viewProfile: (fid: number) => void;
  shareMatchWin: (matchId: string, slicesWon: number, prize: bigint) => void;
  shareFreeRollWin: (prize: bigint) => void;
  shareCaptureStreak: (streak: number) => void;
  shareLeaderboardRank: (rank: number) => void;
}

// Farcaster Frame SDK integration
// In production, this would use the actual Farcaster Frame SDK

export function useFarcaster(): UseFarcasterReturn {
  const [context, setContext] = useState<FarcasterContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFrameContext, setIsFrameContext] = useState(false);

  // Initialize Farcaster context
  useEffect(() => {
    const initFarcaster = async () => {
      setIsLoading(true);
      try {
        // Check if running in Farcaster frame context
        // In production: const frameContext = await sdk.context;

        // Simulated context for development
        if (typeof window !== 'undefined') {
          // Check for frame SDK
          const urlParams = new URLSearchParams(window.location.search);
          const fid = urlParams.get('fid');

          if (fid) {
            setIsFrameContext(true);
            setContext({
              fid: parseInt(fid),
              displayName: 'Demo User',
              pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=demo',
              custody: '0x' + '0'.repeat(40),
            });
          } else {
            // Demo mode
            setContext({
              fid: 12345,
              displayName: 'Pizza Fan',
              pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=pizzafan',
              custody: '0x' + '1'.repeat(40),
            });
          }
        }
      } catch (error) {
        console.error('Failed to initialize Farcaster context:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initFarcaster();
  }, []);

  // View $PIZZA token on Farcaster
  const viewToken = useCallback((tokenAddress: string = PIZZA_TOKEN_ADDRESS) => {
    if (isFrameContext) {
      // In production: sdk.actions.viewToken(tokenAddress);
      console.log('Viewing token:', tokenAddress);
    } else {
      // Fallback: Open in new tab
      window.open(`https://basescan.org/token/${tokenAddress}`, '_blank');
    }
  }, [isFrameContext]);

  // Compose a cast
  const composeCast = useCallback((text: string) => {
    if (isFrameContext) {
      // In production: sdk.actions.composeCast({ text });
      console.log('Composing cast:', text);
    } else {
      // Fallback: Open Warpcast compose
      const encodedText = encodeURIComponent(text);
      window.open(`https://warpcast.com/~/compose?text=${encodedText}`, '_blank');
    }
  }, [isFrameContext]);

  // View a user profile
  const viewProfile = useCallback((fid: number) => {
    if (isFrameContext) {
      // In production: sdk.actions.viewProfile({ fid });
      console.log('Viewing profile:', fid);
    } else {
      // Fallback: Open Warpcast profile
      window.open(`https://warpcast.com/~/profiles/${fid}`, '_blank');
    }
  }, [isFrameContext]);

  // Share match win
  const shareMatchWin = useCallback((matchId: string, slicesWon: number, prize: bigint) => {
    const text = `🍕 I just won a Pizza Shapes match!\n\n` +
      `📊 Slices captured: ${slicesWon}\n` +
      `💰 Prize: ${formatTokenAmount(prize)} $PIZZA\n\n` +
      `Play now and earn $PIZZA! 🎮`;

    composeCast(text);
  }, [composeCast]);

  // Share free roll win
  const shareFreeRollWin = useCallback((prize: bigint) => {
    const text = `🎲 I just won the Pizza Shapes Daily Free Roll!\n\n` +
      `💰 Won: ${formatTokenAmount(prize)} $PIZZA\n\n` +
      `Try your luck - it's free! 🍕`;

    composeCast(text);
  }, [composeCast]);

  // Share capture streak
  const shareCaptureStreak = useCallback((streak: number) => {
    const text = `🔥 ${streak} slice capture streak in Pizza Shapes!\n\n` +
      `Can you beat my streak? Play now! 🍕`;

    composeCast(text);
  }, [composeCast]);

  // Share leaderboard rank
  const shareLeaderboardRank = useCallback((rank: number) => {
    const text = `🏆 I'm ranked #${rank} on the Pizza Shapes leaderboard!\n\n` +
      `Think you can beat me? 🍕`;

    composeCast(text);
  }, [composeCast]);

  return {
    context,
    isLoading,
    isFrameContext,
    viewToken,
    composeCast,
    viewProfile,
    shareMatchWin,
    shareFreeRollWin,
    shareCaptureStreak,
    shareLeaderboardRank,
  };
}

// Helper to format token amounts
function formatTokenAmount(amount: bigint): string {
  const value = Number(amount) / 10 ** 18;
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  }
  return value.toFixed(2);
}

// Interface for external use
export interface UseFarcaster {
  viewToken: (tokenAddress: string) => void;
  composeCast: (text: string) => void;
  viewProfile: (fid: number) => void;
}
