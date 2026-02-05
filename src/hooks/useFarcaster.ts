'use client';

import { useCallback, useState, useEffect } from 'react';
import { FarcasterContext } from '@/types';
import { PIZZA_TOKEN } from '@/lib/constants';
import sdk from '@farcaster/miniapp-sdk';

interface UseFarcasterReturn {
  context: FarcasterContext | null;
  isLoading: boolean;
  isFrameContext: boolean;
  isReady: boolean;
  isAppAdded: boolean;
  viewToken: (tokenAddress?: string) => void;
  composeCast: (text: string, embeds?: string[]) => void;
  viewProfile: (fid: number) => void;
  addMiniApp: () => Promise<boolean>;
  promptAddMiniAppIfNeeded: () => Promise<void>;
  shareInvite: () => void;
  shareMatchWin: (matchId: string, slicesWon: number, prize: bigint) => void;
  shareFreeRollWin: (prize: bigint) => void;
  shareCaptureStreak: (streak: number) => void;
  shareLeaderboardRank: (rank: number) => void;
}

/**
 * Farcaster Mini App SDK Hook
 *
 * Uses @farcaster/miniapp-sdk for:
 * - Quick Auth (primary wallet only)
 * - viewToken, composeCast, viewProfile actions
 * - No Frames v1 syntax
 */
export function useFarcaster(): UseFarcasterReturn {
  const [context, setContext] = useState<FarcasterContext | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFrameContext, setIsFrameContext] = useState(false);
  const [isReady, setIsReady] = useState(false);
  const [isAppAdded, setIsAppAdded] = useState(false);

  // Initialize Farcaster SDK
  useEffect(() => {
    const initFarcaster = async () => {
      setIsLoading(true);

      try {
        // Check if running in Farcaster Mini App context
        if (typeof window !== 'undefined') {
          // Get context from SDK
          const ctx = await sdk.context;

          if (ctx && ctx.user) {
            setIsFrameContext(true);
            setContext({
              fid: ctx.user.fid,
              displayName: ctx.user.displayName || ctx.user.username || 'User',
              pfpUrl: ctx.user.pfpUrl || '',
              username: ctx.user.username,
            });

            // Check if app is already added via client.added
            const clientAdded = (ctx as any).client?.added;
            setIsAppAdded(!!clientAdded);

            // Signal ready to Farcaster - this dismisses the splash screen
            sdk.actions.ready();
            setIsReady(true);
          } else {
            // Development fallback - no Farcaster context available
            console.log('Farcaster context not available - using demo mode');
            setContext({
              fid: 12345,
              displayName: 'Pizza Fan',
              pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=pizzafan',
              username: 'pizzafan',
            });
            // Still call ready in demo mode to prevent stuck splash
            try {
              sdk.actions.ready();
            } catch {
              // Ignore if not in frame context
            }
            setIsReady(true);
          }
        }
      } catch (error) {
        console.error('Failed to initialize Farcaster context:', error);
        // Fallback to demo mode
        setContext({
          fid: 12345,
          displayName: 'Pizza Fan',
          pfpUrl: 'https://api.dicebear.com/7.x/pixel-art/svg?seed=pizzafan',
          username: 'pizzafan',
        });
        // Still call ready to prevent stuck splash
        try {
          sdk.actions.ready();
        } catch {
          // Ignore if not in frame context
        }
        setIsReady(true);
      } finally {
        setIsLoading(false);
      }
    };

    initFarcaster();
  }, []);

  // View $PIZZA token using CAIP-19 format
  // Base chainId is 8453, so CAIP-19 format is: eip155:8453/erc20:{address}
  const viewToken = useCallback((tokenAddress: string = PIZZA_TOKEN) => {
    const caip19Token = `eip155:8453/erc20:${tokenAddress}`;
    if (isFrameContext) {
      sdk.actions.viewToken({ token: caip19Token });
    } else {
      // Fallback for non-Farcaster context
      window.open(`https://basescan.org/token/${tokenAddress}`, '_blank');
    }
  }, [isFrameContext]);

  // Compose a cast using SDK composeCast action
  const composeCast = useCallback((text: string, embeds?: string[]) => {
    if (isFrameContext) {
      // Use proper SDK method with embeds support
      const castOptions: { text: string; embeds?: [] | [string] | [string, string] } = { text };
      if (embeds && embeds.length > 0) {
        // SDK only supports up to 2 embeds
        castOptions.embeds = embeds.slice(0, 2) as [] | [string] | [string, string];
      }
      sdk.actions.composeCast(castOptions);
    } else {
      // Fallback for non-Farcaster context
      const encodedText = encodeURIComponent(text);
      window.open(`https://warpcast.com/~/compose?text=${encodedText}`, '_blank');
    }
  }, [isFrameContext]);

  // View a user profile using SDK viewProfile action
  const viewProfile = useCallback((fid: number) => {
    if (isFrameContext) {
      sdk.actions.viewProfile({ fid });
    } else {
      // Fallback for non-Farcaster context
      window.open(`https://warpcast.com/~/profiles/${fid}`, '_blank');
    }
  }, [isFrameContext]);

  // Prompt user to add the mini app
  const addMiniApp = useCallback(async (): Promise<boolean> => {
    if (!isFrameContext) return false;

    try {
      await sdk.actions.addMiniApp();
      setIsAppAdded(true);
      return true;
    } catch (error: any) {
      // User rejected or domain mismatch
      if (error?.message?.includes('RejectedByUser')) {
        console.log('User declined to add mini app');
      } else if (error?.message?.includes('InvalidDomainManifestJson')) {
        console.error('Domain mismatch or invalid manifest:', error);
      } else {
        console.error('Failed to add mini app:', error);
      }
      return false;
    }
  }, [isFrameContext]);

  // Prompt to add mini app if not already added (call on first meaningful interaction)
  const promptAddMiniAppIfNeeded = useCallback(async () => {
    if (!isFrameContext || isAppAdded) return;

    // Small delay to not interrupt the initial experience
    setTimeout(async () => {
      await addMiniApp();
    }, 500);
  }, [isFrameContext, isAppAdded, addMiniApp]);

  // Share invite to get others to play
  const shareInvite = useCallback(() => {
    const text = `Connect the dots. Capture the slices. Win $PIZZA!`;
    const shareImage = 'https://i.postimg.cc/MGj6qZHc/share-image.png';
    composeCast(text, [shareImage]);
  }, [composeCast]);

  // Share match win
  const shareMatchWin = useCallback((_matchId: string, slicesWon: number, prize: bigint) => {
    const text = `🍕 I just won a Pizza Dots match!\n\n` +
      `📊 Slices captured: ${slicesWon}\n` +
      `💰 Prize: ${formatTokenAmount(prize)} $PIZZA\n\n` +
      `Play now and earn $PIZZA! 🎮`;

    composeCast(text);
  }, [composeCast]);

  // Share free roll win
  const shareFreeRollWin = useCallback((prize: bigint) => {
    const text = `🎲 I just won the Pizza Dots Daily Free Roll!\n\n` +
      `💰 Won: ${formatTokenAmount(prize)} $PIZZA\n\n` +
      `Try your luck - it's free! 🍕`;

    composeCast(text);
  }, [composeCast]);

  // Share capture streak
  const shareCaptureStreak = useCallback((streak: number) => {
    const text = `🔥 ${streak} slice capture streak in Pizza Dots!\n\n` +
      `Can you beat my streak? Play now! 🍕`;

    composeCast(text);
  }, [composeCast]);

  // Share leaderboard rank
  const shareLeaderboardRank = useCallback((rank: number) => {
    const text = `🏆 I'm ranked #${rank} on the Pizza Dots leaderboard!\n\n` +
      `Think you can beat me? 🍕`;

    composeCast(text);
  }, [composeCast]);

  return {
    context,
    isLoading,
    isFrameContext,
    isReady,
    isAppAdded,
    viewToken,
    composeCast,
    viewProfile,
    addMiniApp,
    promptAddMiniAppIfNeeded,
    shareInvite,
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
