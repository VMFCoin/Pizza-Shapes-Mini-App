// Charity wallet configuration for Pizza Shapes
// 3% of each entry fee is pooled and split 9 ways among these veteran charities

export interface CharityConfig {
  name: string;
  address: `0x${string}`;
  description?: string;
}

// All 9 veteran charities receiving equal shares of the 3% charity allocation
export const CHARITY_WALLETS: CharityConfig[] = [
  {
    name: "Patriots Promise",
    address: "0x6456879a5073038b0E57ea8E498Cb0240e949fC3",
    description: "Supporting veterans and their families",
  },
  {
    name: "Victory For Veterans",
    address: "0x700B53ff9a58Ee257F9A2EFda3a373D391028007",
    description: "Empowering veterans through support services",
  },
  {
    name: "Holy Family Village",
    address: "0xB697C8b4bCaE454d9dee1E83f73327D7a63600a1",
    description: "Housing and support for veteran families",
  },
  {
    name: "Camp Cowboy",
    address: "0x5951A4160F73b8798D68e7177dF8af6a7902e725",
    description: "Outdoor therapy programs for veterans",
  },
  {
    name: "Veterans In Need Project",
    address: "0xfB0EF51792c36Ae1fE6636603be199788819b67D",
    description: "Direct assistance for veterans in need",
  },
  {
    name: "Honor HER Foundation",
    address: "0x10F01632DC709F7fA413A140739D8843b06235A1",
    description: "Supporting women veterans",
  },
  {
    name: "Magicians On Mission",
    address: "0x0730d4dc43cf10A3Cd986FEE17f30cB0E75410e0",
    description: "Entertainment therapy for veterans",
  },
  {
    name: "April Forces",
    address: "0x043820c97771c570d830bb0e189778fdef5e6eeb",
    description: "Community support for military families",
  },
  {
    name: "Little Patriots Embraced",
    address: "0x097701F99CC7b0Ff816C2355faC104ADdC6e27B9",
    description: "Supporting children of veterans",
  },
] as const;

// Total number of charities
export const CHARITY_COUNT = CHARITY_WALLETS.length; // 9

// Calculate individual charity share from total charity allocation
// Total charity allocation = 3% (300 basis points)
// Each charity gets 3% / 9 = 0.333...% each
export const CHARITY_SHARE_BPS = Math.floor(300 / CHARITY_COUNT); // ~33 bps each

// Get all charity addresses as an array
export function getCharityAddresses(): `0x${string}`[] {
  return CHARITY_WALLETS.map(c => c.address);
}

// Calculate charity distribution for a given total pool
export function calculateCharityDistribution(totalPool: bigint): {
  totalCharity: bigint;
  perCharity: bigint;
  remainder: bigint;
} {
  // 3% to charity (300 basis points)
  const totalCharity = (totalPool * BigInt(300)) / BigInt(10000);

  // Split evenly among 9 charities
  const perCharity = totalCharity / BigInt(CHARITY_COUNT);

  // Any remainder due to rounding
  const remainder = totalCharity - (perCharity * BigInt(CHARITY_COUNT));

  return {
    totalCharity,
    perCharity,
    remainder,
  };
}
