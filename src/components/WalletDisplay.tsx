'use client';

import { motion } from 'framer-motion';
import { PIZZA_TOKEN_ADDRESS } from '@/types';

interface WalletDisplayProps {
  address?: string;
  balance: bigint;
  isConnected: boolean;
  onConnect: () => void;
  onViewToken?: () => void;
}

function formatBalance(balance: bigint): string {
  const value = Number(balance) / 10 ** 18;
  if (value >= 1000000) {
    return (value / 1000000).toFixed(2) + 'M';
  }
  if (value >= 1000) {
    return (value / 1000).toFixed(2) + 'K';
  }
  return value.toFixed(2);
}

function shortenAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletDisplay({
  address,
  balance,
  isConnected,
  onConnect,
  onViewToken,
}: WalletDisplayProps) {
  if (!isConnected) {
    return (
      <motion.button
        onClick={onConnect}
        className="px-4 py-2 bg-gradient-to-r from-game-primary to-game-secondary rounded-xl font-semibold text-white"
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
      >
        Connect Wallet
      </motion.button>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {/* Balance display */}
      <motion.button
        onClick={onViewToken}
        className="flex items-center gap-2 px-3 py-2 bg-white/10 rounded-xl hover:bg-white/20 transition-colors"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <span className="text-xl">🍕</span>
        <motion.span
          key={balance.toString()}
          initial={{ scale: 1.2, color: '#FFD700' }}
          animate={{ scale: 1, color: '#FFFFFF' }}
          className="font-bold text-white"
        >
          {formatBalance(balance)}
        </motion.span>
        <span className="text-xs text-gray-400">$PIZZA</span>
      </motion.button>

      {/* Address display */}
      {address && (
        <div className="px-3 py-2 bg-white/5 rounded-xl">
          <p className="text-xs text-gray-400 font-mono">
            {shortenAddress(address)}
          </p>
        </div>
      )}
    </div>
  );
}

// Compact wallet display for game screen
export function WalletDisplayCompact({
  balance,
  onViewToken,
}: {
  balance: bigint;
  onViewToken?: () => void;
}) {
  return (
    <motion.button
      onClick={onViewToken}
      className="flex items-center gap-1 px-2 py-1 bg-white/10 rounded-lg"
      whileTap={{ scale: 0.95 }}
    >
      <span className="text-sm">🍕</span>
      <span className="text-sm font-bold text-white">{formatBalance(balance)}</span>
    </motion.button>
  );
}
