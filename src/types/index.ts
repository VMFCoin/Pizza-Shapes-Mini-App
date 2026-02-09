// Core game types
export type PlayerID = string;
export type EdgeID = string;
export type NodeID = string;
export type SliceID = string;
export type MatchID = string;

// Node represents a dot on the grid
export interface Node {
  id: NodeID;
  x: number;
  y: number;
}

// Edge represents a line between two nodes
export interface Edge {
  id: EdgeID;
  nodeA: NodeID;
  nodeB: NodeID;
  claimedBy: PlayerID | null;
}

// PizzaSlice represents a captured triangle
export interface PizzaSlice {
  id: SliceID;
  edgeIds: [EdgeID, EdgeID, EdgeID];
  nodeIds: [NodeID, NodeID, NodeID];
  capturedBy: PlayerID | null;
}

// Player information
export interface Player {
  id: PlayerID;
  fid: number;
  displayName: string;
  pfpUrl: string;
  address: string;
  color: string;
  isBot?: boolean;
  isConnected?: boolean;
}

// Player statistics
export interface PlayerStats {
  playerId: PlayerID;
  fid: number;
  displayName: string;
  pfpUrl: string;
  gamesPlayed: number;
  wins: number;
  slicesCaptured: number;
  lifetimeEarnings: bigint;
  weeklySlices: number;
}

// Game state
export interface GameState {
  matchId: MatchID;
  players: Player[];
  currentPlayerIndex: number;
  nodes: Node[];
  edges: Edge[];
  possibleSlices: PizzaSlice[];
  capturedSlices: PizzaSlice[];
  diceRoll: number | null;
  movesRemaining: number;
  turnNumber: number;
  gameOver: boolean;
  winner: PlayerID | null;
}

// Entry tier configuration
export interface EntryTier {
  id: number;
  amount: number;
  label: string;
  description: string;
  gridSize: number;
  minPlayers: number;
  maxPlayers: number;
}

export const ENTRY_TIERS: EntryTier[] = [
  { id: 1, amount: 0.25, label: '$0.25', description: '4x4 Beginner', gridSize: 4, minPlayers: 2, maxPlayers: 4 },
  { id: 2, amount: 0.50, label: '$0.50', description: '6x6 Board', gridSize: 6, minPlayers: 2, maxPlayers: 6 },
  { id: 3, amount: 1.00, label: '$1.00', description: '8x8 Board', gridSize: 8, minPlayers: 2, maxPlayers: 8 },
];

// Match configuration
export interface MatchConfig {
  tier: EntryTier;
  gridSize: number;
  minPlayers: number;
  maxPlayers: number;
}

// Matchmaking queue
export interface QueueEntry {
  playerId: PlayerID;
  player: Player;
  tier: number;
  joinedAt: number;
}

// Match result
export interface MatchResult {
  matchId: MatchID;
  winner: Player;
  players: Player[];
  finalScores: Record<PlayerID, number>;
  totalPool: bigint;
  payouts: Record<PlayerID, bigint>;
  duration: number;
}

// Leaderboard entry
export interface LeaderboardEntry {
  rank: number;
  player: Player;
  stats: PlayerStats;
}

// Prize pool distribution
export interface PrizeDistribution {
  charities: bigint;     // 3%
  burned: bigint;        // 7%
  dailyFreeRoll: bigint; // 3%
  weeklyTop3: bigint;    // 10%
  matchWinner: bigint;   // 77%
  weeklyJackpot: bigint; // remainder
}

// Free roll selection
export interface FreeRollSelection {
  fid: number;
  selection: number; // 1-6
  rolledNumber: number;
  won: boolean;
  prizeAmount: bigint;
  timestamp: number;
}

// Farcaster frame context
export interface FarcasterContext {
  fid: number;
  displayName: string;
  pfpUrl: string;
  username?: string;
}

// Animation states
export type DiceAnimationState = 'idle' | 'rolling' | 'result';
export type SliceCaptureState = 'idle' | 'capturing' | 'captured';
export type GamePhase = 'waiting' | 'rolling' | 'drawing' | 'capturing' | 'nextTurn' | 'gameOver';

// Grid configuration
export interface GridConfig {
  size: number;
  cellSize: number;
  padding: number;
}

export const GRID_SIZES = {
  beginner: 4,
  intermediate: 6,
  advanced: 8,
} as const;

// Token contract address
export const PIZZA_TOKEN_ADDRESS = '0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07';

// Player colors for the game
export const PLAYER_COLORS = [
  '#FF6B35', // Orange
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Coral
  '#AA96DA', // Lavender
  '#7EC8E3', // Sky Blue
  '#C9E4CA', // Sage
];
