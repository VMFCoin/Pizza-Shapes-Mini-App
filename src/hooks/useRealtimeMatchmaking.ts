'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, isSupabaseAvailable, MatchQueueRow, PlayerRow } from '@/lib/supabase';
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

  // Keep currentPlayer ref updated
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Start or restart countdown (resets to 60s when new player joins)
  const startCountdown = useCallback(() => {
    // Clear any existing countdown
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }

    // Start fresh countdown at 60 seconds
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

  // Fetch queue players from database
  const refreshQueuePlayers = useCallback(async (tier: number, shouldRestartCountdown: boolean = false) => {
    if (!isSupabaseAvailable()) {
      console.warn('Supabase client not initialized');
      return;
    }
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
      .order('joined_at', { ascending: true });

    if (fetchError) {
      console.error('Error fetching queue:', fetchError);
      return;
    }

    const players: QueuePlayer[] = (data || []).map((entry: any) => ({
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

    // Reset countdown if a new player joined (count increased)
    if (newCount > previousCount && previousCount > 0) {
      startCountdown();
    }

    // Update the previous count
    previousPlayerCountRef.current = newCount;

    setQueuePlayers(players);

    // Update current player's ready status
    if (currentPlayerRef.current) {
      const currentPlayerEntry = players.find(p => p.fid === currentPlayerRef.current?.fid);
      if (currentPlayerEntry) {
        setIsCurrentPlayerReady(currentPlayerEntry.isReady);
      }
    }

    // Update queue position for current player
    if (currentPlayerRef.current) {
      const position = players.findIndex(p => p.fid === currentPlayerRef.current?.fid);
      setQueuePosition(position >= 0 ? position + 1 : null);
    }
  }, [startCountdown]);

  // Get max players for tier
  const getMaxPlayers = (tier: number): number => {
    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    return tierConfig?.maxPlayers || 2;
  };

  // Trigger server-side matchmaking with only ready players
  const triggerMatchmaking = async (tier: number, readyPlayers: QueuePlayer[]) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-match', {
        body: {
          tier,
          playerFids: readyPlayers.map(p => p.fid),
        },
      });

      if (invokeError) {
        console.error('Matchmaking error:', invokeError);
      }
    } catch (err) {
      console.error('Failed to trigger matchmaking:', err);
    }
  };

  // Mark current player as ready (after payment)
  const markPlayerReady = useCallback(async () => {
    if (!isSupabaseAvailable() || !queueEntryIdRef.current || !currentPlayerRef.current) return;

    try {
      const { error: updateError } = await (supabase as any)
        .from('match_queue')
        .update({ is_ready: true })
        .eq('id', queueEntryIdRef.current);

      if (updateError) {
        console.error('Error marking player ready:', updateError);
        return;
      }

      setIsCurrentPlayerReady(true);
    } catch (err) {
      console.error('Failed to mark player ready:', err);
    }
  }, []);

  // Subscribe to queue changes for the selected tier
  const subscribeToQueue = useCallback(async (tier: number) => {
    if (!isSupabaseAvailable()) {
      console.warn('Supabase client not initialized');
      setError('Connection not ready. Please refresh the page.');
      return;
    }

    // Clean up existing subscription
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
          // Refresh queue players when changes occur
          await refreshQueuePlayers(tier);

          // Check if current player was matched
          if (
            payload.eventType === 'UPDATE' &&
            payload.new &&
            (payload.new as MatchQueueRow).player_fid === currentPlayerRef.current?.fid &&
            (payload.new as MatchQueueRow).status === 'matched' &&
            (payload.new as MatchQueueRow).match_id
          ) {
            const newMatchId = (payload.new as MatchQueueRow).match_id as string;
            setMatchId(newMatchId);
            setIsMatchReady(true);
          }
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
    if (isInQueue || !player) return;

    setError(null);
    setSelectedTier(tier);

    // Start countdown immediately (don't wait for database)
    // This ensures countdown shows even if Supabase connection fails
    startCountdown();

    if (!isSupabaseAvailable()) {
      setError('Connection not ready. Please refresh the page.');
      return;
    }

    try {
      // Ensure player exists in players table (upsert)
      // Cast to any to work around TypeScript's strict typing with Supabase
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

      // Cancel any existing queue entries for this player
      await (supabase as any)
        .from('match_queue')
        .update({ status: 'cancelled' })
        .eq('player_fid', player.fid)
        .eq('status', 'waiting');

      // Join queue
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
      console.error('Join queue error:', err);
    }
  }, [isInQueue, subscribeToQueue, refreshQueuePlayers, startCountdown]);

  // Leave the matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!isInQueue) return;

    try {
      if (isSupabaseAvailable() && queueEntryIdRef.current) {
        await (supabase as any)
          .from('match_queue')
          .update({ status: 'cancelled' })
          .eq('id', queueEntryIdRef.current);
      }

      // Clean up
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
    } catch (err) {
      console.error('Leave queue error:', err);
    }
  }, [isInQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
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
