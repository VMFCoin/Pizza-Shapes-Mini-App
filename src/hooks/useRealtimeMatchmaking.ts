'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseAvailable } from '@/lib/supabase';
import { Player, MatchID, ENTRY_TIERS } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';
import { mpDebugger as debug } from '@/lib/debug';

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

const COUNTDOWN_SECONDS = 5;
const MIN_PLAYERS_TO_START = 2;
// Queue entries older than 5 minutes are considered stale
const STALE_ENTRY_MS = 5 * 60 * 1000;
// How often to ask the server to try matchmaking (ms)
const MATCHMAKING_POLL_MS = 5000;

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
  const matchmakingInFlightRef = useRef(false);
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
      debug.error('matchmaking', 'Error fetching queue:', fetchError);
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

  // Ask the server to try matchmaking for this player
  // Server does FIFO grouping — client just sends its own FID
  const triggerMatchmaking = useCallback(async (tier: number) => {
    if (!currentPlayerRef.current || matchmakingInFlightRef.current) return;
    matchmakingInFlightRef.current = true;

    try {
      const fid = currentPlayerRef.current.fid;
      debug.info('matchmaking', 'Requesting server matchmaking:', { tier, playerFid: fid });

      // Explicitly check if supabase client is initialized
      if (!isSupabaseAvailable()) {
        debug.error('matchmaking', 'Supabase client not available', { hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL, hasKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY });
        matchmakingInFlightRef.current = false;
        return;
      }

      debug.info('matchmaking', 'Calling create-match edge function', {
        supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
        hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
        anonKeyPrefix: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 20),
      });

      const { data, error: invokeError } = await supabase.functions.invoke('create-match', {
        body: { tier, playerFid: fid },
      });

      debug.info('matchmaking', 'Server response', { data: JSON.stringify(data), error: invokeError ? JSON.stringify(invokeError) : 'none' });

      if (invokeError) {
        debug.error('matchmaking', 'create-match error:', invokeError);
        // Even on error, check if the player was already matched (race condition)
        // The server may have matched us but returned an error on a duplicate call
        if (queueEntryIdRef.current) {
          const { data: entry } = await (supabase as any)
            .from('match_queue')
            .select('match_id, status')
            .eq('id', queueEntryIdRef.current)
            .single();
          if (entry?.status === 'matched' && entry?.match_id) {
            debug.info('matchmaking', 'Found match via fallback check:', entry.match_id);
            setMatchId(entry.match_id);
            setIsMatchReady(true);
          }
        }
        return;
      }

      if (data?.matchId) {
        debug.info('matchmaking', 'Match created:', data.matchId);
        setMatchId(data.matchId);
        setIsMatchReady(true);
      } else if (data?.waiting) {
        debug.info('matchmaking', 'Server says keep waiting', { readyCount: data.readyCount, needed: data.needed });
      }
    } catch (err) {
      debug.error('matchmaking', 'Exception in triggerMatchmaking:', err);
    } finally {
      matchmakingInFlightRef.current = false;
    }
  }, []);

  // Mark current player as ready (after payment)
  const markPlayerReady = useCallback(async () => {
    if (!isSupabaseAvailable() || !queueEntryIdRef.current || !currentPlayerRef.current) {
      debug.warn('matchmaking', 'Cannot mark ready:', {
        supabase: isSupabaseAvailable(),
        queueEntry: queueEntryIdRef.current,
        player: currentPlayerRef.current?.fid,
      });
      return;
    }

    try {
      debug.info('matchmaking', 'Marking player ready:', { queueEntryId: queueEntryIdRef.current });
      const { error: updateError } = await (supabase as any)
        .from('match_queue')
        .update({ is_ready: true })
        .eq('id', queueEntryIdRef.current);

      if (updateError) {
        debug.error('matchmaking', 'Error marking player ready:', updateError);
        return;
      }

      debug.info('matchmaking', 'Player marked ready successfully');
      setIsCurrentPlayerReady(true);

      // Refresh queue so everyone sees the update
      await refreshQueuePlayers(selectedTier);

      // Matchmaking will be triggered by the MATCHMAKING TRIGGER effect
      // after a 5s delay to give more players a chance to join
    } catch (err) {
      debug.error('matchmaking', 'Failed to mark player ready:', err);
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
      .channel(`queue-tier-${tier}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'match_queue',
          filter: `tier=eq.${tier}`,
        },
        async (payload) => {
          debug.info('matchmaking', 'Realtime event', { eventType: payload.eventType, status: (payload.new as any)?.status, playerFid: (payload.new as any)?.player_fid });

          // Check if current player was matched via realtime
          if (
            payload.eventType === 'UPDATE' &&
            payload.new &&
            (payload.new as any).status === 'matched' &&
            (payload.new as any).match_id
          ) {
            const matchedFid = (payload.new as any).player_fid;
            const newMatchId = (payload.new as any).match_id as string;

            if (matchedFid === currentPlayerRef.current?.fid) {
              debug.info('matchmaking', 'Current player matched via realtime:', newMatchId);
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
        debug.info('matchmaking', `Queue channel status: ${status}`);
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Don't auto-reconnect — Supabase client handles transport-level reconnection.
          // Manual reconnect was creating duplicate channels that loop-errored.
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
      debug.info('matchmaking', 'Cleaning up old queue entries for fid:', player.fid);
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
      setIsInQueue(true);

      // Subscribe to queue updates
      await subscribeToQueue(tier);
      await refreshQueuePlayers(tier);
    } catch (err: any) {
      setError(err.message || 'Failed to join queue');
      debug.error('matchmaking', 'Join queue error:', err);
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
      previousPlayerCountRef.current = 0;
      isJoiningRef.current = false;
      matchmakingInFlightRef.current = false;
    } catch (err) {
      debug.error('matchmaking', 'Leave queue error:', err);
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
          .then(() => debug.info('matchmaking', 'Queue entry cancelled on unmount'))
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

  // === PRIMARY MATCH DETECTION ===
  // Poll: check if THIS queue entry was matched by the server (or another player's create-match call)
  // Polls every 1s for fast detection
  useEffect(() => {
    if (!isInQueue || isMatchReady || !currentPlayerRef.current || !isSupabaseAvailable()) return;
    if (!queueEntryIdRef.current) return;

    const entryId = queueEntryIdRef.current;

    const pollInterval = setInterval(async () => {
      if (isMatchReady) return;

      const { data, error: pollError } = await (supabase as any)
        .from('match_queue')
        .select('match_id, status')
        .eq('id', entryId)
        .single();

      if (pollError) return;

      if (data?.status === 'matched' && data?.match_id) {
        debug.info('matchmaking', 'Match found via polling:', data.match_id);
        setMatchId(data.match_id);
        setIsMatchReady(true);
      }
    }, 1000); // Poll every 1s for fast match detection

    return () => clearInterval(pollInterval);
  }, [isInQueue, isMatchReady]);

  // === MATCHMAKING TRIGGER ===
  // When this player is ready, wait 5s before first attempt to give more players
  // a chance to join, then retry every 3s.
  useEffect(() => {
    if (!isCurrentPlayerReady || isMatchReady || !isInQueue) return;

    // Wait 5 seconds before first matchmaking attempt
    const initialDelay = setTimeout(() => {
      if (isMatchReady) return;
      triggerMatchmaking(selectedTier);
    }, 5000);

    // Then retry every few seconds in case more players became ready
    const retryInterval = setInterval(() => {
      if (isMatchReady) return;
      triggerMatchmaking(selectedTier);
    }, MATCHMAKING_POLL_MS);

    return () => {
      clearTimeout(initialDelay);
      clearInterval(retryInterval);
    };
  }, [isCurrentPlayerReady, isMatchReady, isInQueue, selectedTier, triggerMatchmaking]);

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
