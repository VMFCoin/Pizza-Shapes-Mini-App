'use client';

import { formatUnits } from 'viem';
import { motion } from 'framer-motion';
import { PRIZE_DISTRIBUTION, CHARITY_WALLETS } from '@/lib/constants';
import { tierToAmount } from '@/lib/contracts';

interface PrizeDistributionProps {
  tier: number;
  playerCount: number;
  showCharities?: boolean;
  priceUsd?: number;
}

export function PrizeDistribution({ tier, playerCount, showCharities = false, priceUsd }: PrizeDistributionProps) {
  const entryAmount = tierToAmount(tier, priceUsd);
  const totalPool = entryAmount * BigInt(playerCount);

  const formatPizza = (amount: bigint): string => {
    const value = Number(formatUnits(amount, 18));
    return value.toFixed(4);
  };

  const distributions = [
    {
      label: 'Winner',
      percentage: 77,
      amount: (totalPool * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000),
      color: 'bg-green-500',
      icon: '🏆',
      description: 'Paid directly to your wallet',
    },
    {
      label: 'Weekly Top 3',
      percentage: 10,
      amount: (totalPool * BigInt(PRIZE_DISTRIBUTION.weekly)) / BigInt(10000),
      color: 'bg-blue-500',
      icon: '📊',
      description: 'Leaderboard rewards',
    },
    {
      label: 'Burned',
      percentage: 7,
      amount: (totalPool * BigInt(PRIZE_DISTRIBUTION.burn)) / BigInt(10000),
      color: 'bg-red-500',
      icon: '🔥',
      description: 'Removed from circulation',
    },
    {
      label: 'Daily Free Roll',
      percentage: 3,
      amount: (totalPool * BigInt(PRIZE_DISTRIBUTION.freeRoll)) / BigInt(10000),
      color: 'bg-purple-500',
      icon: '🎲',
      description: 'Daily prize pool',
    },
    {
      label: 'Veteran Charities',
      percentage: 3,
      amount: (totalPool * BigInt(PRIZE_DISTRIBUTION.charity)) / BigInt(10000),
      color: 'bg-yellow-500',
      icon: '🎖️',
      description: 'Split among 9 charities',
    },
  ];

  const charityList = Object.entries(CHARITY_WALLETS).map(([key, address]) => {
    const name = key
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
    return { name, address };
  });

  return (
    <div className="space-y-4">
      {/* Total Pool */}
      <div className="text-center p-4 bg-gradient-to-r from-orange-500/20 to-yellow-500/20 rounded-xl border border-orange-500/30">
        <p className="text-sm text-gray-400">Total Prize Pool</p>
        <p className="text-2xl font-bold text-orange-400">
          {formatPizza(totalPool)} $PIZZA
        </p>
        <p className="text-xs text-gray-500 mt-1">
          {formatPizza(entryAmount)} x {playerCount} players
        </p>
      </div>

      {/* Distribution Breakdown */}
      <div className="space-y-2">
        {distributions.map((dist, index) => (
          <motion.div
            key={dist.label}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            className="flex items-center gap-3 p-3 bg-gray-800/50 rounded-lg"
          >
            <span className="text-xl">{dist.icon}</span>
            <div className="flex-1">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-white">{dist.label}</span>
                <span className="text-sm text-orange-400 font-mono">
                  {formatPizza(dist.amount)} $PIZZA
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${dist.percentage}%` }}
                    transition={{ delay: 0.3 + index * 0.1, duration: 0.5 }}
                    className={`h-full ${dist.color} rounded-full`}
                  />
                </div>
                <span className="text-xs text-gray-400 w-10 text-right">
                  {dist.percentage}%
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">{dist.description}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Charity Details */}
      {showCharities && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 p-4 bg-yellow-500/10 rounded-xl border border-yellow-500/30"
        >
          <h4 className="text-sm font-semibold text-yellow-400 mb-3 flex items-center gap-2">
            <span>🎖️</span>
            Veteran Charities (3% split 9 ways)
          </h4>
          <div className="grid grid-cols-1 gap-2">
            {charityList.map((charity) => (
              <div
                key={charity.address}
                className="flex items-center justify-between text-xs"
              >
                <span className="text-gray-300">{charity.name}</span>
                <a
                  href={`https://basescan.org/address/${charity.address}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-400 hover:text-blue-300 font-mono"
                >
                  {charity.address.slice(0, 6)}...{charity.address.slice(-4)}
                </a>
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-3">
            Each charity receives ~0.33% of every entry fee
          </p>
        </motion.div>
      )}
    </div>
  );
}

// Compact version for entry confirmation
export function PrizeDistributionCompact({ tier, playerCount, priceUsd }: { tier: number; playerCount: number; priceUsd?: number }) {
  const entryAmount = tierToAmount(tier, priceUsd);
  const totalPool = entryAmount * BigInt(playerCount);
  const winnerPrize = (totalPool * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000);

  const formatPizza = (amount: bigint): string => {
    const value = Number(formatUnits(amount, 18));
    return value.toFixed(2);
  };

  return (
    <div className="flex items-center justify-between text-sm p-3 bg-gray-800/50 rounded-lg">
      <div className="flex items-center gap-2">
        <span>🏆</span>
        <span className="text-gray-300">Winner receives:</span>
      </div>
      <span className="text-green-400 font-bold">{formatPizza(winnerPrize)} $PIZZA</span>
    </div>
  );
}
