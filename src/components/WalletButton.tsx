'use client';
import React from 'react';
import { useAccount } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';

export default function WalletButton() {
  const { address, isConnected } = useAccount();
  const { open } = useAppKit();

  return (
    <button
      onClick={() => open()}
      className="px-4 py-2 bg-pizza-orange hover:bg-pizza-orange/90 text-white font-bold rounded-lg transition-colors"
    >
      {isConnected ? (
        <>{String(address).slice(0, 6)}...{String(address).slice(-4)}</>
      ) : (
        <>CONNECT WALLET</>
      )}
    </button>
  );
}
