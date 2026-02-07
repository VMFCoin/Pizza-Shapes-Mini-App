// Player colors for the game
export const PLAYER_COLORS = [
  '#FF6B35', // Orange
  '#4ECDC4', // Teal
  '#FFE66D', // Yellow
  '#95E1D3', // Mint
  '#F38181', // Coral
  '#AA96DA', // Lavender
];

// Entry tier configurations
export const ENTRY_TIERS = [
  { id: 1, amount: 0.25, label: '$0.25', description: '4x4 Beginner', gridSize: 4, minPlayers: 2, maxPlayers: 2 },
  { id: 2, amount: 0.50, label: '$0.50', description: '6x6 Board', gridSize: 6, minPlayers: 2, maxPlayers: 4 },
  { id: 3, amount: 1.00, label: '$1.00', description: '8x8 Board', gridSize: 8, minPlayers: 2, maxPlayers: 6 },
];

// Game configuration
export const CELL_SIZE = 60;
export const PADDING = 40;
export const DISCONNECT_TIMEOUT_MS = 30000; // 30 seconds

// Bot player configuration
export const BOT_FID = 999999999;
export const BOT_DISPLAY_NAME = 'Pizza Bot';
