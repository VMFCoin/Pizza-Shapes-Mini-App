'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase, MatchQueueRow, PlayerRow } from '@/lib/supabase';
import { Player, MatchID, ENTRY_TIERS } from '@/types';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeMatchmakingReturn {
  isInQueue: boolean;
  queuePlayers: Player[];
  matchId: MatchID | undefined;
  isMatchReady: boolean;
  countdown: number | null;
  selectedTier: number;
  queuePosition: number | null;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  joinQueue: (tier: number, player: Player) => Promise<void>;
  leaveQueue: () => Promise<void>;
  setSelectedTier: (tier: number) => void;
}

const COUNTDOWN_SECONDS = 5;
const MIN_PLAYERS = 2;

export function useRealtimeMatchmaking(currentPlayer: Player | null): UseRealtimeMatchmakingReturn {
  const [isInQueue, setIsInQueue] = useState(false);
  const [queuePlayers, setQueuePlayers] = useState<Player[]>([]);
  const [matchId, setMatchId] = useState<MatchID | undefined>();
  const [isMatchReady, setIsMatchReady] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [selectedTier, setSelectedTier] = useState(1);
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');

  const channelRef = useRef<RealtimeChannel | null>(null);
  const queueEntryIdRef = useRef<string | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const currentPlayerRef = useRef<Player | null>(currentPlayer);

  // Keep currentPlayer ref updated
  useEffect(() => {
    currentPlayerRef.current = currentPlayer;
  }, [currentPlayer]);

  // Fetch queue players from database
  const refreshQueuePlayers = useCallback(async (tier: number) => {
    const { data, error: fetchError } = await supabase
      .from('match_queue')
      .select(`
        id,
        player_fid,
        joined_at,
        status,
        match_id,
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

    const players: Player[] = (data || []).map((entry: any, index: number) => ({
      id: `player_${entry.player_fid}`,
      fid: entry.player_fid,
      displayName: entry.players?.display_name || `Player ${entry.player_fid}`,
      pfpUrl: entry.players?.pfp_url || '',
      address: entry.players?.address || '',
      color: '',
    }));

    setQueuePlayers(players);

    // Update queue position for current player
    if (currentPlayerRef.current) {
      const position = players.findIndex(p => p.fid === currentPlayerRef.current?.fid);
      setQueuePosition(position >= 0 ? position + 1 : null);
    }

    // Check if we have enough players for a match
    if (players.length >= MIN_PLAYERS) {
      await triggerMatchmaking(tier, players.slice(0, getMaxPlayers(tier)));
    }
  }, []);

  // Get max players for tier
  const getMaxPlayers = (tier: number): number => {
    const tierConfig = ENTRY_TIERS.find(t => t.id === tier);
    return tierConfig?.maxPlayers || 2;
  };

  // Trigger server-side matchmaking
  const triggerMatchmaking = async (tier: number, players: Player[]) => {
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-match', {
        body: {
          tier,
          playerFids: players.map(p => p.fid),
        },
      });

      if (invokeError) {
        console.error('Matchmaking error:', invokeError);
      }
    } catch (err) {
      console.error('Failed to trigger matchmaking:', err);
    }
  };

  // Start countdown when match is ready
  const startCountdown = useCallback(() => {
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

  // Subscribe to queue changes for the selected tier
  const subscribeToQueue = useCallback(async (tier: number) => {
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
            startCountdown();
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
  }, [refreshQueuePlayers, startCountdown]);

  // Join the matchmaking queue
  const joinQueue = useCallback(async (tier: number, player: Player) => {
    if (isInQueue || !player) return;

    setError(null);
    setSelectedTier(tier);

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
  }, [isInQueue, subscribeToQueue, refreshQueuePlayers]);

  // Leave the matchmaking queue
  const leaveQueue = useCallback(async () => {
    if (!isInQueue) return;

    try {
      if (queueEntryIdRef.current) {
        await (supabase as any)
          .from('match_queue')
          .update({ status: 'cancelled' })
          .eq('id', queueEntryIdRef.current);
      }

      // Clean up
      if (channelRef.current) {
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
      queueEntryIdRef.current = null;
    } catch (err) {
      console.error('Leave queue error:', err);
    }
  }, [isInQueue]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
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
    queuePosition,
    error,
    connectionStatus,
    joinQueue,
    leaveQueue,
    setSelectedTier,
  };
}
