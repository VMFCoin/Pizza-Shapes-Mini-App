// $PIZZA Token on Base Mainnet (immutable)
export const PIZZA_TOKEN = "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07";

// Contract addresses (to be updated after deployment)
export const CONTRACTS = {
  stats: "0x0000000000000000000000000000000000000000",
  settlement: "0x0000000000000000000000000000000000000000",
  freeRoll: "0x0000000000000000000000000000000000000000",
  weeklyVault: "0x0000000000000000000000000000000000000000",
  charityWallet: "0x0000000000000000000000000000000000000000",
} as const;

// Network configuration
export const BASE_MAINNET = {
  chainId: 8453,
  name: "Base",
  rpcUrl: "https://mainnet.base.org",
  blockExplorer: "https://basescan.org",
} as const;

// Entry tiers (in PIZZA tokens)
export const ENTRY_TIERS = {
  1: { amount: "0.25", label: "$0.25", description: "Casual" },
  2: { amount: "0.50", label: "$0.50", description: "Standard" },
  3: { amount: "1.00", label: "$1.00", description: "High Stakes" },
} as const;

// Prize distribution (basis points)
export const PRIZE_DISTRIBUTION = {
  winner: 7700,      // 77%
  weekly: 1000,      // 10%
  burn: 700,         // 7%
  freeRoll: 300,     // 3%
  charity: 300,      // 3%
} as const;

// Game configuration
export const GAME_CONFIG = {
  minPlayers: 2,
  maxPlayers: 6,
  gridSizes: [4, 6, 8] as const,
  defaultGridSize: 4,
} as const;
