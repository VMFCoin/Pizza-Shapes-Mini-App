// $PIZZA Token on Base Mainnet (immutable)
export const PIZZA_TOKEN = "0xa821f2ee19f4f62e404c934d43eb6e5763fbdb07" as const;

// Burn address - tokens sent here are permanently removed from circulation
export const BURN_ADDRESS = "0x000000000000000000000000000000000000dEaD" as const;

// Contract addresses - reads from env or uses placeholder
// Update these after deployment or set NEXT_PUBLIC_ env variables
export const CONTRACTS = {
  stats: process.env.NEXT_PUBLIC_STATS_CONTRACT || "0x0000000000000000000000000000000000000000",
  settlement: process.env.NEXT_PUBLIC_SETTLEMENT_CONTRACT || "0x0000000000000000000000000000000000000000",
  freeRoll: process.env.NEXT_PUBLIC_FREE_ROLL_CONTRACT || "0x0000000000000000000000000000000000000000",
  weeklyVault: process.env.NEXT_PUBLIC_WEEKLY_VAULT_CONTRACT || "0x0000000000000000000000000000000000000000",
} as const;

// 9 Veteran charity wallets (3% of entry fees split 9 ways)
export const CHARITY_WALLETS = {
  patriotsPromise: "0x6456879a5073038b0E57ea8E498Cb0240e949fC3",
  victoryForVeterans: "0x700B53ff9a58Ee257F9A2EFda3a373D391028007",
  holyFamilyVillage: "0xB697C8b4bCaE454d9dee1E83f73327D7a63600a1",
  campCowboy: "0x5951A4160F73b8798D68e7177dF8af6a7902e725",
  veteransInNeedProject: "0xfB0EF51792c36Ae1fE6636603be199788819b67D",
  honorHerFoundation: "0x10F01632DC709F7fA413A140739D8843b06235A1",
  magiciansOnMission: "0x0730d4dc43cf10A3Cd986FEE17f30cB0E75410e0",
  aprilForces: "0x043820c97771c570d830bb0e189778fdef5e6eeb",
  littlePatriotsEmbraced: "0x097701F99CC7b0Ff816C2355faC104ADdC6e27B9",
} as const;

// Charity wallet array for contract initialization
export const CHARITY_WALLET_ARRAY = Object.values(CHARITY_WALLETS) as readonly `0x${string}`[];

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
