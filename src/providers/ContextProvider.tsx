'use client';
import { wagmiAdapter, projectId } from '@/lib/wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { OnchainKitProvider } from '@coinbase/onchainkit';
import { createAppKit } from '@reown/appkit/react';
import { base } from '@reown/appkit/networks';
import React, { type ReactNode } from 'react';
import { cookieToInitialState, WagmiProvider, type Config } from 'wagmi';

const queryClient = new QueryClient();

const metadata = {
  name: 'Pizza Shapes',
  description: 'Match shapes to win $PIZZA tokens',
  url: 'https://pizza-shapes-mini-app.vercel.app',
  icons: ['https://pizza-shapes-mini-app.vercel.app/pizza-logo.png'],
};

// Only create AppKit if projectId exists
if (projectId) {
  createAppKit({
    adapters: [wagmiAdapter],
    projectId,
    networks: [base],
    defaultNetwork: base,
    metadata,
    features: { analytics: true },
    featuredWalletIds: [
      'fd20dc426fb37566d803205b19bbc1d4096b248ac04548e3cfb6b3a38bd033aa', // Farcaster
      '99a71c7a80284d5c59f5f39562fda701c1b60e6d60a8167db88c8af2cf453fd0', // Coinbase
    ],
  });
}

function ContextProvider({
  children,
  cookies
}: {
  children: ReactNode;
  cookies: string | null
}) {
  const initialState = cookieToInitialState(wagmiAdapter.wagmiConfig as Config, cookies);

  return (
    <OnchainKitProvider
      apiKey={process.env.NEXT_PUBLIC_ONCHAINKIT_API_KEY}
      chain={base}
      config={{
        appearance: { mode: 'auto' },
      }}
    >
      <WagmiProvider config={wagmiAdapter.wagmiConfig as Config} initialState={initialState}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </WagmiProvider>
    </OnchainKitProvider>
  );
}

export default ContextProvider;
