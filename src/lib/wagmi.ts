import { http, createConfig, createStorage } from 'wagmi';
import { base } from 'wagmi/chains';
import { injected } from 'wagmi/connectors';

// Base Mainnet configuration for Pizza Shapes
export const config = createConfig({
  chains: [base],
  connectors: [
    // Injected connector works with Farcaster Mini App wallet
    injected({
      shimDisconnect: true,
    }),
  ],
  storage: createStorage({
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  }),
  transports: {
    [base.id]: http('https://mainnet.base.org'),
  },
});

// Export chain for reference
export const baseChain = base;

// Chain ID constant
export const BASE_CHAIN_ID = 8453;

declare module 'wagmi' {
  interface Register {
    config: typeof config;
  }
}
