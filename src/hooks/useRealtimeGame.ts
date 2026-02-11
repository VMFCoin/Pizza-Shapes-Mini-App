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
  turnTimeRemaining: number | null;
}

const CELL_SIZE = 60;
const PADDING = 40;
const RECONNECT_TIMEOUT = 30000; // 30 seconds
const TURN_TIME_LIMIT = 60; // 60 seconds per turn

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

  // Turn timer: counts down from TURN_TIME_LIMIT each turn
  const [turnTimeRemaining, setTurnTimeRemaining] = useState<number | null>(null);
  const turnTimerRef = useRef<NodeJS.Timeout | null>(null);

  const gameChannelRef = useRef<RealtimeChannel | null>(null);
  const presenceChannelRef = useRef<RealtimeChannel | null>(null);
  const reconnectTimerRef = useRef<NodeJS.Timeout | null>(null);
  const captureTimerRef = useRef<NodeJS.Timeout | null>(null);
  const botTurnTriggeredRef = useRef<string | null>(null);
  // Ref to always read latest game state in async callbacks (avoids stale closures)
  const gameStateRef = useRef<GameState | null>(null);
  gameStateRef.current = gameState;

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
        diceRoll: gs?.dice_roll ?? null,
        movesRemaining: gs?.moves_remaining ?? 0,
        turnNumber: matchData.turn_number ?? 1,
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
    console.log(`[RT game_states] dice_roll=${newState.dice_roll}, moves_remaining=${newState.moves_remaining}, captured=${(newState.captured_slices as any[])?.length || 0}`);

    setGameState(prev => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        edges: newState.edges as Edge[],
        possibleSlices: newState.possible_slices as PizzaSlice[],
        capturedSlices: newState.captured_slices as PizzaSlice[],
        diceRoll: newState.dice_roll,
        movesRemaining: newState.moves_remaining,
      };

      // Update phase based on moves remaining (rolling vs drawing).
      // Game-over and waiting phases are handled by handleMatchUpdate.
      // Don't overwrite 'capturing' phase — it has its own timer to transition.
      if (!updated.gameOver) {
        setGamePhase(prev => {
          if (prev === 'capturing') return prev; // protect capture animation
          if (newState.moves_remaining > 0) return 'drawing';
          if (newState.dice_roll === null) return 'rolling';
          return prev;
        });
      }

      return updated;
    });

    // Clear optimistic state as server state is now authoritative
    setOptimisticEdges(new Map());
  }, []);

  // Handle match updates (turn changes, game end)
  const handleMatchUpdate = useCallback((payload: any) => {
    const match = payload.new as MatchRow;
    console.log(`[RT matches] current_player_index=${match.current_player_index}, turn_number=${match.turn_number}, status=${match.status}`);

    setGameState(prev => {
      if (!prev) return prev;
      const playerAtIndex = prev.players[match.current_player_index];
      console.log(`[RT matches] Next player: ${playerAtIndex?.displayName} (fid=${playerAtIndex?.fid}, isBot=${playerAtIndex?.isBot})`);
      const updated = {
        ...prev,
        currentPlayerIndex: match.current_player_index,
        turnNumber: match.turn_number,
        gameOver: match.status === 'completed',
        winner: match.winner_fid ? `player_${match.winner_fid}` : null,
      };
      const newPhase = determinePhase(updated, match.status);
      console.log(`[RT matches] Phase: ${newPhase}`);
      setGamePhase(newPhase);
      return updated;
    });
  }, [determinePhase]);

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
  // Uses gameStateRef to avoid stale closure issues
  const rollDice = useCallback(async (): Promise<number> => {
    const currentState = gameStateRef.current;
    if (!matchId || !currentState || !currentPlayerFid || currentState.gameOver) {
      console.log(`[rollDice] BAIL: matchId=${matchId}, fid=${currentPlayerFid}, gameOver=${currentState?.gameOver}`);
      return -1;
    }

    // Check it's our turn using ref
    const currentP = currentState.players[currentState.currentPlayerIndex];
    if (currentP?.fid !== currentPlayerFid) {
      console.log(`[rollDice] BAIL: not my turn. currentP.fid=${currentP?.fid}, myFid=${currentPlayerFid}`);
      return -1;
    }

    // Prevent rolling if already rolled this turn (moves allocated or dice already shown)
    if (currentState.movesRemaining > 0 || currentState.diceRoll !== null) {
      console.log(`[rollDice] Already rolled: moves=${currentState.movesRemaining}, dice=${currentState.diceRoll}`);
      return currentState.diceRoll ?? -1;
    }

    try {
      console.log(`[rollDice] Calling validate-move roll_dice...`);
      const { data, error: invokeError } = await supabase.functions.invoke('validate-move', {
        body: {
          matchId,
          playerFid: currentPlayerFid,
          moveType: 'roll_dice',
          moveData: {},
        },
      });

      console.log(`[rollDice] Response:`, JSON.stringify(data), `error:`, invokeError);

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      // Handle game-over detected during roll (no remaining slices)
      if (data.gameOver) {
        setGameState(prev => {
          if (!prev) return prev;
          return { ...prev, gameOver: true };
        });
        setGamePhase('gameOver');
        return -1;
      }

      // Optimistically update diceRoll so the dice animation shows the final value.
      // Always set diceRoll even on turnSkipped — the animation needs to display it.
      setGameState(prev => {
        if (!prev) return prev;
        return { ...prev, diceRoll: data.diceRoll, movesRemaining: data.movesRemaining };
      });

      // Set phase to 'drawing' immediately when roll grants moves, so the UI
      // doesn't get stuck waiting for realtime if it's delayed or dropped.
      if (!data.turnSkipped && data.movesRemaining > 0) {
        setGamePhase('drawing');
      }

      return data.diceRoll;
    } catch (err: any) {
      setError(err.message || 'Failed to roll dice');
      return -1;
    }
  }, [matchId, currentPlayerFid]);

  // Draw edge (server-authoritative with optimistic update)
  // Uses gameStateRef to read the LATEST state, avoiding stale closure issues
  // when multiple edges are drawn rapidly within the same turn.
  const drawEdge = useCallback(async (edgeId: EdgeID): Promise<{ captured: PizzaSlice[]; extraTurn: boolean }> => {
    const currentState = gameStateRef.current;
    if (!matchId || !currentState || !currentPlayerFid || currentState.gameOver) {
      return { captured: [], extraTurn: false };
    }

    // Check if it's actually our turn (using ref for latest state)
    const currentP = currentState.players[currentState.currentPlayerIndex];
    if (currentP?.fid !== currentPlayerFid) {
      return { captured: [], extraTurn: false };
    }

    // Check if edge can be drawn using latest state
    const edge = currentState.edges.find(e => e.id === edgeId);
    if (!edge || edge.claimedBy !== null || currentState.movesRemaining <= 0) {
      return { captured: [], extraTurn: false };
    }

    // Also block edges that are already optimistically claimed
    if (optimisticEdges.has(edgeId)) {
      return { captured: [], extraTurn: false };
    }

    // Optimistic update for instant feedback
    const playerId = `player_${currentPlayerFid}`;
    setOptimisticEdges(prev => new Map(prev).set(edgeId, playerId));

    // Optimistically decrement moves remaining so canDrawEdge stays accurate
    setGameState(prev => {
      if (!prev) return prev;
      return { ...prev, movesRemaining: prev.movesRemaining - 1 };
    });

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
        // Rollback optimistic updates
        setOptimisticEdges(prev => {
          const next = new Map(prev);
          next.delete(edgeId);
          return next;
        });
        setGameState(prev => {
          if (!prev) return prev;
          return { ...prev, movesRemaining: prev.movesRemaining + 1 };
        });
        throw new Error(invokeError.message);
      }

      const captured = data.capturedSlices || [];
      const extraTurn = captured.length > 0;

      // Optimistically update movesRemaining from server response and add captures
      // so the score counter updates immediately (instead of waiting for realtime).
      if (captured.length > 0) {
        const playerId = `player_${currentPlayerFid}`;
        setGameState(prev => {
          if (!prev) return prev;
          const newCaptured = [
            ...prev.capturedSlices,
            ...captured.map((s: PizzaSlice) => ({ ...s, capturedBy: playerId })),
          ];
          return {
            ...prev,
            capturedSlices: newCaptured,
            movesRemaining: data.movesRemaining ?? prev.movesRemaining,
          };
        });
        setGamePhase('capturing');
        // Clear any previous capture timer to prevent stale closures
        if (captureTimerRef.current) clearTimeout(captureTimerRef.current);
        const gameOver = data.gameOver;
        captureTimerRef.current = setTimeout(() => {
          captureTimerRef.current = null;
          if (gameOver) {
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
  }, [matchId, currentPlayerFid, optimisticEdges]);

  // End turn
  // Uses gameStateRef to avoid stale closure issues.
  // Optimistically advances currentPlayerIndex and resets dice/moves so the UI
  // immediately shows "Waiting for <opponent>" instead of relying on realtime.
  // After the server confirms, triggers the bot turn directly if the next player is a bot.
  const endTurn = useCallback(async (): Promise<void> => {
    const currentState = gameStateRef.current;
    if (!matchId || !currentPlayerFid || !currentState || currentState.gameOver) {
      console.log(`[endTurn] BAIL: matchId=${matchId}, fid=${currentPlayerFid}, gameOver=${currentState?.gameOver}`);
      return;
    }

    // Check it's our turn using ref
    const currentP = currentState.players[currentState.currentPlayerIndex];
    if (currentP?.fid !== currentPlayerFid) {
      console.log(`[endTurn] BAIL: not my turn. currentP.fid=${currentP?.fid}, myFid=${currentPlayerFid}`);
      return;
    }

    // Optimistically advance turn locally so the UI updates immediately
    const nextPlayerIndex = (currentState.currentPlayerIndex + 1) % currentState.players.length;
    const nextPlayer = currentState.players[nextPlayerIndex];
    console.log(`[endTurn] Advancing to player ${nextPlayerIndex} (${nextPlayer?.displayName}, isBot=${nextPlayer?.isBot}), turn ${currentState.turnNumber + 1}`);

    setGameState(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        currentPlayerIndex: nextPlayerIndex,
        turnNumber: prev.turnNumber + 1,
        diceRoll: null,
        movesRemaining: 0,
      };
    });
    setGamePhase('rolling');

    try {
      console.log(`[endTurn] Calling validate-move end_turn...`);
      const { data, error: invokeError } = await supabase.functions.invoke('validate-move', {
        body: {
          matchId,
          playerFid: currentPlayerFid,
          moveType: 'end_turn',
          moveData: {},
        },
      });

      console.log(`[endTurn] Response:`, JSON.stringify(data), `error:`, invokeError);

      if (invokeError) {
        throw new Error(invokeError.message);
      }

      // Check if the server detected game-over during end_turn
      if (data?.gameOver) {
        console.log(`[endTurn] Game over detected`);
        setGamePhase('gameOver');
        return;
      }

      // The server-side end_turn executes bot turn inline.
      // Pre-set the ref so the client-side useEffect fallback doesn't
      // double-trigger. Clear it after 5s as safety fallback.
      if (nextPlayer?.isBot) {
        const turnKey = `${nextPlayerIndex}-${currentState.turnNumber + 1}`;
        console.log(`[endTurn] Setting botTurnTriggeredRef=${turnKey}`);
        botTurnTriggeredRef.current = turnKey;
        setTimeout(() => {
          if (botTurnTriggeredRef.current === turnKey) {
            console.log(`[endTurn] Clearing stale botTurnTriggeredRef=${turnKey}`);
            botTurnTriggeredRef.current = null;
          }
        }, 5000);
      }
    } catch (err: any) {
      console.error(`[endTurn] ERROR:`, err);
      setError(err.message || 'Failed to end turn');
    }
  }, [matchId, currentPlayerFid]);

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

  // Fetch game state on mount / matchId change
  useEffect(() => {
    if (matchId) {
      fetchGameState();
    }
  }, [matchId, fetchGameState]);

  // Subscribe to realtime updates (separate effect to avoid re-subscribing on every state change)
  useEffect(() => {
    if (matchId) {
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
      if (captureTimerRef.current) {
        clearTimeout(captureTimerRef.current);
      }
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchId, currentPlayerFid]);

  // Update player connection status on visibility change
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (!matchId || !currentPlayerFid) return;
      // Don't update connection status for completed games
      if (gameState?.gameOver) return;

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

  // 60-second turn timer — visible to ALL players, resets on each turn change.
  // Only the active player's client auto-ends the turn when time expires.
  useEffect(() => {
    // Clear previous timer
    if (turnTimerRef.current) {
      clearInterval(turnTimerRef.current);
      turnTimerRef.current = null;
    }

    if (!gameState || gameState.gameOver || !matchId) {
      setTurnTimeRemaining(null);
      return;
    }

    // Don't show timer for bot turns
    const currentP = gameState.players[gameState.currentPlayerIndex];
    if (currentP?.isBot) {
      setTurnTimeRemaining(null);
      return;
    }

    // Start countdown — visible to everyone
    console.log(`[timer] Starting 60s countdown. isMyTurn=${isMyTurn}, playerIndex=${gameState.currentPlayerIndex}, turn=${gameState.turnNumber}`);
    setTurnTimeRemaining(TURN_TIME_LIMIT);

    turnTimerRef.current = setInterval(() => {
      setTurnTimeRemaining(prev => {
        if (prev === null || prev <= 1) {
          if (turnTimerRef.current) {
            clearInterval(turnTimerRef.current);
            turnTimerRef.current = null;
          }
          // Only the active player's client sends endTurn
          if (isMyTurn) {
            endTurn();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (turnTimerRef.current) {
        clearInterval(turnTimerRef.current);
        turnTimerRef.current = null;
      }
    };
  }, [isMyTurn, gameState?.currentPlayerIndex, gameState?.turnNumber, gameState?.gameOver, matchId, endTurn]);

  // Auto-trigger bot turns when current player is a bot (CLIENT FALLBACK).
  // The server-side inline bot in validate-move is the primary mechanism.
  // This is a backup in case the inline bot didn't run.
  useEffect(() => {
    if (!gameState || gameState.gameOver || !matchId) {
      botTurnTriggeredRef.current = null;
      return;
    }

    const currentP = gameState.players[gameState.currentPlayerIndex];
    if (!currentP?.isBot) {
      botTurnTriggeredRef.current = null;
      return;
    }

    const myIndex = gameState.players.findIndex(p => p.fid === currentPlayerFid);
    if (myIndex !== 0) {
      console.log(`[botEffect] SKIP: myIndex=${myIndex}, not player 0`);
      return;
    }

    const turnKey = `${gameState.currentPlayerIndex}-${gameState.turnNumber}`;
    if (botTurnTriggeredRef.current === turnKey) {
      console.log(`[botEffect] SKIP: already triggered for ${turnKey}`);
      return;
    }
    console.log(`[botEffect] Bot is current player (index=${gameState.currentPlayerIndex}, turn=${gameState.turnNumber}). Triggering fallback in 1s...`);
    botTurnTriggeredRef.current = turnKey;

    const timer = setTimeout(async () => {
      console.log(`[botEffect] Calling trigger-bot-turn (fallback)...`);
      try {
        const { data, error } = await supabase.functions.invoke('trigger-bot-turn', {
          body: { matchId },
        });
        console.log(`[botEffect] trigger-bot-turn result:`, JSON.stringify(data), `error:`, error);
      } catch (err) {
        console.error('[botEffect] Failed to trigger bot turn:', err);
        botTurnTriggeredRef.current = null;
      }
    }, 1000);

    return () => clearTimeout(timer);
  }, [gameState?.currentPlayerIndex, gameState?.turnNumber, gameState?.gameOver, matchId, currentPlayerFid]);

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
    turnTimeRemaining,
  };
}
