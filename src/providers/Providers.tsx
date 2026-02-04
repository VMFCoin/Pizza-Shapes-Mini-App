'use client';

import { type ReactNode } from 'react';
import { WagmiProvider } from './WagmiProvider';

interface ProvidersProps {
  children: ReactNode;
}

export function Providers({ children }: ProvidersProps) {
  return (
    <WagmiProvider>
      {children}
    </WagmiProvider>
  );
}
