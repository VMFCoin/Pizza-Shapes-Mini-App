'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';
import { Player, MatchID, ENTRY_TIERS } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

// Extended player info with ready status
export interface QueuePlayer extends Player {
  isReady: boolean;
}

interface UseRealtimeMatchmakingReturn {
  isInQueue: boolean;
  queuePlayers: QueuePlayer[];
  matchId: MatchID | undefined;
  isMatchReady: boolean;
  countdown: number | null;
  selectedTier: number;
  queuePosition: number | null;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  isCurrentPlayerReady: boolean;
  readyPlayerCount: number;
  joinQueue: (tier: number, player: Player) => Promise<void>;
  leaveQueue: () => Promise<void>;
  setSelectedTier: (tier: number) => void;
  markPlayerReady: () => Promise<void>;
}

const COUNTDOWN_SECONDS = 60;
const MIN_PLAYERS_TO_START = 2;
// Queue entries older than 5 minutes are considered stale
const STALE_ENTRY_MS = 5 * 60 * 1000;

export function useRealtimeMatchmaking(currentPlayer: Player | null): UseRealtimeMatchmakingReturn {
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePlayers, setQueuePlayers] = useState<QueuePlayer[]>([]);
  const [matchId, setMatchId] = useState<MatchID | undefined>();
  const [isMatchReady, setIsMatchReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState(1);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const [isCurrentPlayerReady, setIsCurrentPlayerReady] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const queueEntryIdRef = useRef<string | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPlayerRef = useRef<Player | null>(currentPlayer);
  const previousPlayerCountRef = useRef<number>(0);
  const isJoiningRef = useRef(false);
  const matchmakingTriggeredRef = useRef(false);
  // Track when this client joined to filter out stale entries
  const joinedAtRef = useRef<string | null>(null);

  // Keep currentPlayer ref updated
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Start or restart countdown (resets to 60s when new player joins)
  const startCountdown = useCallback(() => {
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    setCountdown(COUNTDOWN_SECONDS);
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
  }, []);

  // Fetch queue players — only show entries from recent sessions (not stale)
  const refreshQueuePlayers = useCallback(async (tier: number) => {
    if (!isSupabaseAvailable()) return;

    // Only show entries from the last 5 minutes to filter out ghost players
    const staleThreshold = new Date(Date.now() - STALE_ENTRY_MS).toISOString();

    const { data, error: fetchError } = await supabase
      .from('match_queue')
      .select(`
        id,
        player_fid,
        joined_at,
        status,
        match_id,
        is_ready,
        players (
          fid,
          display_name,
          pfp_url,
          address
        )
      `)
      .eq('tier', tier)
      .eq('status', 'waiting')
      .gte('joined_at', staleThreshold)
      .order('joined_at', { ascending: true });

    if (fetchError) {
      console.error('[matchmaking] Error fetching queue:', fetchError);
      return;
    }

    // Deduplicate by player_fid — keep only the latest entry per player
    const seenFids = new Set<number>();
    const uniqueEntries = (data || []).filter((entry: any) => {
      if (seenFids.has(entry.player_fid)) return false;
      seenFids.add(entry.player_fid);
      return true;
    });

    const players: QueuePlayer[] = uniqueEntries.map((entry: any) => ({
      id: `player_${entry.player_fid}`,
      fid: entry.player_fid,
      displayName: entry.players?.display_name || `Player ${entry.player_fid}`,
      pfpUrl: entry.players?.pfp_url || '',
      address: entry.players?.address || '',
      color: '',
      isReady: entry.is_ready || false,
    }));

    // Check if a new player joined (player count increased)
    const previousCount = previousPlayerCountRef.current;
    const newCount = players.length;
    if (newCount > previousCount && previousCount > 0) {
      startCountdown();
    }
    previousPlayerCountRef.current = newCount;

    setQueuePlayers(players);

    // Update current player's ready status
    if (currentPlayerRef.current) {
      const currentPlayerEntry = players.find(p => p.fid === currentPlayerRef.current?.fid);
      if (currentPlayerEntry) {
        setIsCurrentPlayerReady(currentPlayerEntry.isReady);
      }
    }

    // Update queue position
    if (currentPlayerRef.current) {
      const position = players.findIndex(p => p.fid === currentPlayerRef.current?.fid);
      setQueuePosition(position >= 0 ? position + 1 : null);
    }
  }, [startCountdown]);

  // Trigger server-side matchmaking
  const triggerMatchmaking = useCallback(async (tier: number, readyPlayers: QueuePlayer[]) => {
    try {
      const playerFids = readyPlayers.map(p => p.fid);
      console.log('[matchmaking] Calling create-match:', { tier, playerFids });

      const { data, error: invokeError } = await supabase.functions.invoke('create-match', {
        body: { tier, playerFids },
      });

      console.log('[matchmaking] create-match response:', JSON.stringify({ data, error: invokeError }));

      if (invokeError) {
        console.error('[matchmaking] create-match error:', invokeError);
        matchmakingTriggeredRef.current = false;
        return;
      }

      if (data?.matchId) {
        console.log('[matchmaking] Match ready, navigating:', data.matchId);
        setMatchId(data.matchId);
        setIsMatchReady(true);
      } else {
        console.error('[matchmaking] No matchId in response:', data);
        matchmakingTriggeredRef.current = false;
      }
    } catch (err) {
      console.error('[matchmaking] Exception in triggerMatchmaking:', err);
      matchmakingTriggeredRef.current = false;
    }
  }, []);

  // Mark current player as ready (after payment)
  const markPlayerReady = useCallback(async () => {
    if (!isSupabaseAvailable() || !queueEntryIdRef.current || !currentPlayerRef.current) {
      console.warn('[matchmaking] Cannot mark ready:', {
        supabase: isSupabaseAvailable(),
        queueEntry: queueEntryIdRef.current,
        player: currentPlayerRef.current?.fid,
      });
      return;
    }

    try {
      console.log('[matchmaking] Marking player ready:', { queueEntryId: queueEntryIdRef.current });
      const { error: updateError } = await (supabase as any)
        .from('match_queue')
        .update({ is_ready: true })
        .eq('id', queueEntryIdRef.current);

      if (updateError) {
        console.error('[matchmaking] Error marking player ready:', updateError);
        return;
      }

      console.log('[matchmaking] Player marked ready successfully');
      setIsCurrentPlayerReady(true);

      // Also trigger a queue refresh so we see the latest ready states
      await refreshQueuePlayers(selectedTier);
    } catch (err) {
      console.error('[matchmaking] Failed to mark player ready:', err);
    }
  }, [refreshQueuePlayers, selectedTier]);

  // Subscribe to queue changes for the selected tier
  const subscribeToQueue = useCallback(async (tier: number) => {
    if (!isSupabaseAvailable()) {
      setError('Connection not ready. Please refresh the page.');
      return;
    }

    if (channelRef.current) {
      await supabase.removeChannel(channelRef.current);
    }

    setConnectionStatus('connecting');

    const channel = supabase
      .channel(`queue-tier-${tier}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_queue',
          filter: `tier=eq.${tier}`,
        },
        async (payload) => {
          console.log('[matchmaking] Realtime event:', payload.eventType, (payload.new as any)?.status, (payload.new as any)?.player_fid);

          // Check if current player was matched BEFORE refreshing
          if (
            payload.eventType === 'UPDATE' &&
            payload.new &&
            (payload.new as any).status === 'matched' &&
            (payload.new as any).match_id
          ) {
            const matchedFid = (payload.new as any).player_fid;
            const newMatchId = (payload.new as any).match_id as string;

            if (matchedFid === currentPlayerRef.current?.fid) {
              console.log('[matchmaking] Current player matched via realtime:', newMatchId);
              setMatchId(newMatchId);
              setIsMatchReady(true);
              return;
            }
          }

          // Refresh queue for other changes (new joins, ready status)
          await refreshQueuePlayers(tier);
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    channelRef.current = channel;
  }, [refreshQueuePlayers]);

  // Join the matchmaking queue
  const joinQueue = useCallback(async (tier: number, player: Player) => {
    if (isInQueue || isJoiningRef.current || !player) return;
    isJoiningRef.current = true;

    setError(null);
    setSelectedTier(tier);
    startCountdown();

    if (!isSupabaseAvailable()) {
      setError('Connection not ready. Please refresh the page.');
      isJoiningRef.current = false;
      return;
    }

    try {
      // Ensure player exists in players table
      const { error: playerError } = await (supabase as any)
        .from('players')
        .upsert({
          fid: player.fid,
          display_name: player.displayName,
          pfp_url: player.pfpUrl,
          address: player.address,
        }, {
          onConflict: 'fid',
        });

      if (playerError) {
        throw new Error(`Failed to register player: ${playerError.message}`);
      }

      // Cancel ALL old queue entries for this player (waiting AND matched)
      // This prevents stale entries from causing redirect to dead games
      console.log('[matchmaking] Cleaning up old queue entries for fid:', player.fid);
      await (supabase as any)
        .from('match_queue')
        .update({ status: 'cancelled' })
        .eq('player_fid', player.fid)
        .in('status', ['waiting', 'matched']);

      // Insert fresh queue entry
      const { data, error: queueError } = await (supabase as any)
        .from('match_queue')
        .insert({
          player_fid: player.fid,
          tier,
          status: 'waiting',
        })
        .select()
        .single();

      if (queueError) {
        throw new Error(`Failed to join queue: ${queueError.message}`);
      }

      queueEntryIdRef.current = data.id;
      joinedAtRef.current = data.joined_at;
      setIsInQueue(true);

      // Subscribe to queue updates
      await subscribeToQueue(tier);
      await refreshQueuePlayers(tier);
    } catch (err: any) {
      setError(err.message || 'Failed to join queue');
      console.error('[matchmaking] Join queue error:', err);
      isJoiningRef.current = false;
    }
  }, [isInQueue, subscribeToQueue, refreshQueuePlayers, startCountdown]);

  // Leave the matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!isInQueue) return;

    try {
      // Cancel queue entry in database
      if (isSupabaseAvailable() && queueEntryIdRef.current) {
        await (supabase as any)
          .from('match_queue')
          .update({ status: 'cancelled' })
          .eq('id', queueEntryIdRef.current);
      }

      // Clean up subscriptions and timers
      if (isSupabaseAvailable() && channelRef.current) {
        await supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      setIsInQueue(false);
      setQueuePlayers([]);
      setMatchId(undefined);
      setIsMatchReady(false);
      setCountdown(null);
      setQueuePosition(null);
      setConnectionStatus('disconnected');
      setIsCurrentPlayerReady(false);
      queueEntryIdRef.current = null;
      joinedAtRef.current = null;
      previousPlayerCountRef.current = 0;
      isJoiningRef.current = false;
      matchmakingTriggeredRef.current = false;
    } catch (err) {
      console.error('[matchmaking] Leave queue error:', err);
    }
  }, [isInQueue]);

  // Cleanup on unmount — cancel queue entry so we don't ghost
  useEffect(() => {
    return () => {
      // Cancel queue entry in DB on unmount (best-effort)
      if (isSupabaseAvailable() && queueEntryIdRef.current) {
        (supabase as any)
          .from('match_queue')
          .update({ status: 'cancelled' })
          .eq('id', queueEntryIdRef.current)
          .then(() => console.log('[matchmaking] Queue entry cancelled on unmount'))
          .catch(() => {}); // Best effort
      }
      if (isSupabaseAvailable() && channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, []);

  // Count ready players
  const readyPlayerCount = queuePlayers.filter(p => p.isReady).length;

  // Polling fallback — check if THIS SESSION's queue entry was matched
  // Only look at entries created AFTER we joined (not old stale matches)
  useEffect(() => {
    if (!isInQueue || isMatchReady || !currentPlayerRef.current || !isSupabaseAvailable()) return;
    if (!queueEntryIdRef.current) return;

    const entryId = queueEntryIdRef.current;

    const pollInterval = setInterval(async () => {
      if (isMatchReady) return;

      // Check THIS specific queue entry (by ID) — not just any matched entry for this player
      const { data, error: pollError } = await (supabase as any)
        .from('match_queue')
        .select('match_id, status')
        .eq('id', entryId)
        .single();

      if (pollError) return;

      if (data?.status === 'matched' && data?.match_id) {
        console.log('[matchmaking] Match found via polling:', data.match_id);
        setMatchId(data.match_id);
        setIsMatchReady(true);
      }
    }, 3000);

    return () => clearInterval(pollInterval);
  }, [isInQueue, isMatchReady]);

  // Trigger matchmaking when enough human players are ready
  useEffect(() => {
    if (
      readyPlayerCount >= MIN_PLAYERS_TO_START &&
      isCurrentPlayerReady &&
      !matchmakingTriggeredRef.current &&
      !isMatchReady
    ) {
      console.log('[matchmaking] Triggering matchmaking (primary):', { readyPlayerCount });
      matchmakingTriggeredRef.current = true;
      const readyPlayers = queuePlayers.filter(p => p.isReady);
      triggerMatchmaking(selectedTier, readyPlayers);
    }
  }, [readyPlayerCount, isCurrentPlayerReady, isMatchReady, queuePlayers, selectedTier, triggerMatchmaking]);

  // Fallback: if countdown reaches 0 with 2+ ready players but no match, force retry
  useEffect(() => {
    if (
      countdown === 0 &&
      readyPlayerCount >= MIN_PLAYERS_TO_START &&
      isCurrentPlayerReady &&
      !isMatchReady
    ) {
      console.log('[matchmaking] Triggering matchmaking (countdown fallback)');
      matchmakingTriggeredRef.current = false;
      const readyPlayers = queuePlayers.filter(p => p.isReady);
      matchmakingTriggeredRef.current = true;
      triggerMatchmaking(selectedTier, readyPlayers);
    }
  }, [countdown, readyPlayerCount, isCurrentPlayerReady, isMatchReady, queuePlayers, selectedTier, triggerMatchmaking]);

  // Periodic retry: every 5s while waiting with ready players, retry matchmaking
  useEffect(() => {
    if (!isCurrentPlayerReady || isMatchReady || readyPlayerCount < MIN_PLAYERS_TO_START) return;

    const retryInterval = setInterval(() => {
      if (isMatchReady) return;
      console.log('[matchmaking] Periodic retry matchmaking');
      matchmakingTriggeredRef.current = false;
      const readyPlayers = queuePlayers.filter(p => p.isReady);
      matchmakingTriggeredRef.current = true;
      triggerMatchmaking(selectedTier, readyPlayers);
    }, 5000);

    return () => clearInterval(retryInterval);
  }, [isCurrentPlayerReady, isMatchReady, readyPlayerCount, queuePlayers, selectedTier, triggerMatchmaking]);

  return {
    isInQueue,
    queuePlayers,
    matchId,
    isMatchReady,
    countdown,
    selectedTier,
    queuePosition,
    error,
    connectionStatus,
    isCurrentPlayerReady,
    readyPlayerCount,
    joinQueue,
    leaveQueue,
    setSelectedTier,
    markPlayerReady,
  };
}
