'use client';

import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { supabase, MatchRow, GameStateRow } from '@/lib/supabase';
import {
  GameState,
  Player,
  Edge,
  PizzaSlice,
  PlayerID,
  EdgeID,
  MatchID,
  GamePhase,
  Node,
  PLAYER_COLORS,
} from '@/types';
import {
  createGrid,
  generateAllPossibleEdges,
  findAllPossibleSlices,
} from '@/lib/gridUtils';
import { RealtimeChannel } from '@supabase/supabase-js';

interface UseRealtimeGameReturn {
  gameState: GameState | null;
  gamePhase: GamePhase;
  currentPlayer: Player | null;
  isMyTurn: boolean;
  isLoading: boolean;
  error: string | null;
  connectionStatus: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  rollDice: () => Promise<number>;
  drawEdge: (edgeId: EdgeID) => Promise<{ captured: PizzaSlice[]; extraTurn: boolean }>;
  endTurn: () => Promise<void>;
  getScores: () => Record<PlayerID, number>;
  canDrawEdge: (edgeId: EdgeID) => boolean;
  isGameOver: boolean;
  winner: Player | null;
}

const CELL_SIZE = 60;
const PADDING = 40;
const RECONNECT_TIMEOUT = 30000; // 30 seconds

export function useRealtimeGame(
  matchId: MatchID | null,
  currentPlayerFid: number | null
): UseRealtimeGameReturn {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [gamePhase, setGamePhase] = useState<GamePhase>('waiting');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'reconnecting'>('connecting');

  // Optimistic state for instant UI feedback
  const [optimisticEdges, setOptimisticEdges] = useState<Map<EdgeID, PlayerID>>(new Map());

  const gameChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Derive current player from game state
  const currentPlayer = useMemo(() => {
    if (!gameState) return null;
    return gameState.players[gameState.currentPlayerIndex];
  }, [gameState]);

  // Check if it's this player's turn
  const isMyTurn = useMemo(() => {
    return currentPlayer?.fid === currentPlayerFid;
  }, [currentPlayer, currentPlayerFid]);

  const isGameOver = gameState?.gameOver ?? false;

  // Get winner
  const winner = useMemo(() => {
    if (!gameState || !gameState.winner) return null;
    return gameState.players.find(p => p.id === gameState.winner) ?? null;
  }, [gameState]);

  // Determine game phase from state
  const determinePhase = useCallback((state: GameState | null, matchStatus: string): GamePhase => {
    if (!state) return 'waiting';
    if (matchStatus === 'completed' || state.gameOver) return 'gameOver';
    if (matchStatus === 'waiting' || matchStatus === 'countdown') return 'waiting';
    if (state.movesRemaining > 0) return 'drawing';
    return 'rolling';
  }, []);

  // Fetch initial game state from database
  const fetchGameState = useCallback(async () => {
    if (!matchId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Fetch match data with related tables
      const { data, error: matchError } = await supabase
        .from('matches')
        .select(`
          *,
          match_players (
            player_fid,
            color,
            player_index,
            is_bot,
            is_connected,
            score,
            players (
              fid,
              display_name,
              pfp_url,
              address
            )
          ),
          game_states (*)
        `)
        .eq('id', matchId)
        .single();

      if (matchError) {
        throw new Error(`Failed to load match: ${matchError.message}`);
      }

      if (!data) {
        throw new Error('Match not found');
      }

      // Cast to any to work around TypeScript's limitation with nested Supabase joins
      const matchData = data as any;

      // Build players array from match_players
      const players: Player[] = (matchData.match_players || [])
        .sort((a: any, b: any) => a.player_index - b.player_index)
        .map((mp: any) => ({
          id: `player_${mp.player_fid}`,
          fid: mp.player_fid,
          displayName: mp.players?.display_name || `Player ${mp.player_fid}`,
          pfpUrl: mp.players?.pfp_url || '',
          address: mp.players?.address || '',
          color: mp.color || PLAYER_COLORS[mp.player_index % PLAYER_COLORS.length],
          isBot: mp.is_bot,
          isConnected: mp.is_connected,
        }));

      // Get or initialize game state
      const gs = matchData.game_states;
      let nodes: Node[];
      let edges: Edge[];
      let possibleSlices: PizzaSlice[];

      if (gs && gs.nodes) {
        // Use existing game state from database
        nodes = gs.nodes as Node[];
        edges = gs.edges as Edge[];
        possibleSlices = gs.possible_slices as PizzaSlice[];
      } else {
        // Initialize new game state (shouldn't happen in normal flow)
        nodes = createGrid(matchData.grid_size, CELL_SIZE, PADDING);
        edges = generateAllPossibleEdges(nodes, CELL_SIZE);
        possibleSlices = findAllPossibleSlices(nodes, edges);
      }

      const newGameState: GameState = {
        matchId,
        players,
        currentPlayerIndex: matchData.current_player_index || 0,
        nodes,
        edges,
        possibleSlices,
        capturedSlices: (gs?.captured_slices as PizzaSlice[]) || [],
        diceRoll: gs?.dice_roll || null,
        movesRemaining: gs?.moves_remaining || 0,
        turnNumber: matchData.turn_number || 1,
        gameOver: matchData.status === 'completed',
        winner: matchData.winner_fid ? `player_${matchData.winner_fid}` : null,
      };

      setGameState(newGameState);
      setGamePhase(determinePhase(newGameState, matchData.status));
      setConnectionStatus('connected');
    } catch (err: any) {
      setError(err.message || 'Failed to load game');
      console.error('Fetch game error:', err);
    } finally {
      setIsLoading(false);
    }
  }, [matchId, determinePhase]);

  // Handle game state updates from realtime subscription
  const handleGameStateUpdate = useCallback((payload: any) => {
    const newState = payload.new as GameStateRow;

    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        edges: newState.edges as Edge[],
        possibleSlices: newState.possible_slices as PizzaSlice[],
        capturedSlices: newState.captured_slices as PizzaSlice[],
        diceRoll: newState.dice_roll,
        movesRemaining: newState.moves_remaining,
      };
    });

    // Clear optimistic state as server state is now authoritative
    setOptimisticEdges(new Map());
  }, []);

  // Handle match updates (turn changes, game end)
  const handleMatchUpdate = useCallback((payload: any) => {
    const match = payload.new as MatchRow;

    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentPlayerIndex: match.current_player_index,
        turnNumber: match.turn_number,
        gameOver: match.status === 'completed',
        winner: match.winner_fid ? `player_${match.winner_fid}` : null,
      };
    });

    setGamePhase(determinePhase(gameState, match.status));
  }, [gameState, determinePhase]);

  // Handle player connection status updates
  const handleMatchPlayerUpdate = useCallback((payload: any) => {
    const mp = payload.new;

    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        players: prev.players.map(p =>
          p.fid === mp.player_fid
            ? { ...p, isConnected: mp.is_connected, isBot: mp.is_bot }
            : p
        ),
      };
    });
  }, []);

  // Subscribe to game changes
  const subscribeToGame = useCallback(async () => {
    if (!matchId) return;

    // Clean up existing subscriptions
    if (gameChannelRef.current) {
      await supabase.removeChannel(gameChannelRef.current);
    }

    setConnectionStatus('connecting');

    // Subscribe to game state and match changes
    const gameChannel = supabase
      .channel(`game-${matchId}-${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'game_states',
          filter: `match_id=eq.${matchId}`,
        },
        handleGameStateUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'matches',
          filter: `id=eq.${matchId}`,
        },
        handleMatchUpdate
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'match_players',
          filter: `match_id=eq.${matchId}`,
        },
        handleMatchPlayerUpdate
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          setConnectionStatus('connected');
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          setConnectionStatus('disconnected');
        }
      });

    gameChannelRef.current = gameChannel;

    // Set up presence channel for player connectivity
    if (currentPlayerFid) {
      const presenceChannel = supabase
        .channel(`presence-${matchId}`)
        .on('presence', { event: 'sync' }, () => {
          // Could update player online status here
        })
        .on('presence', { event: 'leave' }, async ({ leftPresences }) => {
          // Mark disconnected players
          for (const presence of leftPresences) {
            if ((presence as any).fid !== currentPlayerFid) {
              await (supabase as any)
                .from('match_players')
                .update({
                  is_connected: false,
                  disconnected_at: new Date().toISOString(),
                })
                .eq('match_id', matchId)
                .eq('player_fid', (presence as any).fid);
            }
          }
        })
        .subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            await presenceChannel.track({
              fid: currentPlayerFid,
              online_at: new Date().toISOString(),
            });
          }
        });

      presenceChannelRef.current = presenceChannel;
    }
  }, [matchId, currentPlayerFid, handleGameStateUpdate, handleMatchUpdate, handleMatchPlayerUpdate]);

  // Roll dice (server-authoritative)
  const rollDice = useCallback(async (): Promise<number> => {
    if (!matchId || !gameState || !isMyTurn || gameState.gameOver) {
      return 0;
    }

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('validate-move', {
        body: {
          matchId,
          playerFid: currentPlayerFid,
          moveType: 'roll_dice',
          moveData: {},
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      // Update local phase based on result
      if (data.turnSkipped) {
        setGamePhase('rolling');
      } else {
        setGamePhase('drawing');
      }

      return data.diceRoll;
    } catch (err: any) {
      setError(err.message || 'Failed to roll dice');
      return 0;
    }
  }, [matchId, gameState, isMyTurn, currentPlayerFid]);

  // Draw edge (server-authoritative with optimistic update)
  const drawEdge = useCallback(async (edgeId: EdgeID): Promise<{ captured: PizzaSlice[]; extraTurn: boolean }> => {
    if (!matchId || !gameState || !isMyTurn || gameState.gameOver) {
      return { captured: [], extraTurn: false };
    }

    // Check if edge can be drawn
    const edge = gameState.edges.find(e => e.id === edgeId);
    if (!edge || edge.claimedBy !== null || gameState.movesRemaining <= 0) {
      return { captured: [], extraTurn: false };
    }

    // Optimistic update for instant feedback
    const playerId = `player_${currentPlayerFid}`;
    setOptimisticEdges(prev => new Map(prev).set(edgeId, playerId));

    try {
      const { data, error: invokeError } = await supabase.functions.invoke('validate-move', {
        body: {
          matchId,
          playerFid: currentPlayerFid,
          moveType: 'draw_edge',
          moveData: { edgeId },
        },
      });

      if (invokeError) {
        // Rollback optimistic update
        setOptimisticEdges(prev => {
          const next = new Map(prev);
          next.delete(edgeId);
          return next;
        });
        throw new Error(invokeError.message);
      }

      const captured = data.capturedSlices || [];
      const extraTurn = captured.length > 0;

      if (captured.length > 0) {
        setGamePhase('capturing');
        setTimeout(() => {
          if (data.gameOver) {
            setGamePhase('gameOver');
          } else {
            setGamePhase('drawing');
          }
        }, 1000);
      }

      return { captured, extraTurn };
    } catch (err: any) {
      setError(err.message || 'Failed to draw edge');
      return { captured: [], extraTurn: false };
    }
  }, [matchId, gameState, isMyTurn, currentPlayerFid]);

  // End turn
  const endTurn = useCallback(async (): Promise<void> => {
    if (!matchId || !isMyTurn || gameState?.gameOver) return;

    try {
      const { error: invokeError } = await supabase.functions.invoke('validate-move', {
        body: {
          matchId,
          playerFid: currentPlayerFid,
          moveType: 'end_turn',
          moveData: {},
        },
      });

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      setGamePhase('rolling');
    } catch (err: any) {
      setError(err.message || 'Failed to end turn');
    }
  }, [matchId, isMyTurn, gameState, currentPlayerFid]);

  // Check if edge can be drawn
  const canDrawEdge = useCallback((edgeId: EdgeID): boolean => {
    if (!gameState || gameState.gameOver) return false;
    if (gameState.movesRemaining <= 0) return false;
    if (!isMyTurn) return false;

    const edge = gameState.edges.find(e => e.id === edgeId);
    if (!edge) return false;

    // Check both server state and optimistic state
    if (edge.claimedBy !== null) return false;
    if (optimisticEdges.has(edgeId)) return false;

    return true;
  }, [gameState, isMyTurn, optimisticEdges]);

  // Get scores
  const getScores = useCallback((): Record<PlayerID, number> => {
    if (!gameState) return {};

    const scores: Record<PlayerID, number> = {};
    for (const player of gameState.players) {
      scores[player.id] = gameState.capturedSlices.filter(s => s.capturedBy === player.id).length;
    }
    return scores;
  }, [gameState]);

  // Merge optimistic state with server state for rendering
  const mergedGameState = useMemo(() => {
    if (!gameState) return null;

    // Apply optimistic edge claims
    const mergedEdges = gameState.edges.map(edge => {
      const optimisticClaim = optimisticEdges.get(edge.id);
      if (optimisticClaim) {
        return { ...edge, claimedBy: optimisticClaim };
      }
      return edge;
    });

    return {
      ...gameState,
      edges: mergedEdges,
    };
  }, [gameState, optimisticEdges]);

  // Initialize on mount
  useEffect(() => {
    if (matchId) {
      fetchGameState();
      subscribeToGame();
    }

    return () => {
      if (gameChannelRef.current) {
        supabase.removeChannel(gameChannelRef.current);
      }
      if (presenceChannelRef.current) {
        supabase.removeChannel(presenceChannelRef.current);
      }
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
    };
  }, [matchId, fetchGameState, subscribeToGame]);

  // Update player connection status on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!matchId || !currentPlayerFid) return;

      if (document.visibilityState === 'hidden') {
        // Mark as disconnected
        await (supabase as any)
          .from('match_players')
          .update({
            is_connected: false,
            disconnected_at: new Date().toISOString(),
          })
          .eq('match_id', matchId)
          .eq('player_fid', currentPlayerFid);
      } else {
        // Mark as connected
        await (supabase as any)
          .from('match_players')
          .update({
            is_connected: true,
            disconnected_at: null,
          })
          .eq('match_id', matchId)
          .eq('player_fid', currentPlayerFid);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [matchId, currentPlayerFid]);

  // Auto-trigger bot turns when current player is a bot
  const botTurnTriggeredRef = useRef(false);
  useEffect(() => {
    if (!gameState || gameState.gameOver || !matchId) {
      botTurnTriggeredRef.current = false;
      return;
    }

    const currentP = gameState.players[gameState.currentPlayerIndex];
    if (!currentP?.isBot) {
      botTurnTriggeredRef.current = false;
      return;
    }

    // Avoid double-triggering for the same turn
    if (botTurnTriggeredRef.current) return;
    botTurnTriggeredRef.current = true;

    const timer = setTimeout(async () => {
      try {
        await supabase.functions.invoke('trigger-bot-turn', {
          body: { matchId },
        });
      } catch (err) {
        console.error('Failed to trigger bot turn:', err);
        botTurnTriggeredRef.current = false;
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState?.currentPlayerIndex, gameState?.turnNumber, gameState?.gameOver, matchId]);

  return {
    gameState: mergedGameState,
    gamePhase,
    currentPlayer,
    isMyTurn,
    isLoading,
    error,
    connectionStatus,
    rollDice,
    drawEdge,
    endTurn,
    getScores,
    canDrawEdge,
    isGameOver,
    winner,
  };
}
