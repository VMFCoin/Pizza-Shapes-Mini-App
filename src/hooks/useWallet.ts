'use client';

import { useState, useCallback, useEffect } from 'react';
import { PIZZA_TOKEN_ADDRESS } from '@/types';

// Simulated wallet hook for Farcaster Mini App
// In production, this would integrate with wagmi/viem and the Farcaster frame wallet

interface UseWalletReturn {
  address: string | undefined;
  balance: bigint;
  isConnected: boolean;
  isLoading: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  approvePizza: (amount: bigint) => Promise<boolean>;
  enterMatch: (matchId: string, amount: bigint) => Promise<boolean>;
  refreshBalance: () => Promise<void>;
}

export function useWallet(): UseWalletReturn {
  const [address, setAddress] = useState<string | undefined>(undefined);
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Simulate fetching balance
  const refreshBalance = useCallback(async () => {
    if (!address) return;

    setIsLoading(true);
    try {
      // In production, fetch actual $PIZZA balance from Base mainnet
      // const provider = new ethers.JsonRpcProvider('https://mainnet.base.org');
      // const tokenContract = new ethers.Contract(PIZZA_TOKEN_ADDRESS, ERC20_ABI, provider);
      // const balance = await tokenContract.balanceOf(address);

      // Simulated balance for demo
      await new Promise(resolve => setTimeout(resolve, 500));
      setBalance(BigInt(1000) * BigInt(10 ** 18)); // 1000 PIZZA tokens
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoading(false);
    }
  }, [address]);

  const connect = useCallback(async () => {
    setIsLoading(true);
    try {
      // In production, this would use Farcaster frame wallet or wagmi
      // For now, simulate connection
      await new Promise(resolve => setTimeout(resolve, 500));

      // Simulated address
      const simulatedAddress = '0x' + Array(40).fill(0).map(() =>
        Math.floor(Math.random() * 16).toString(16)
      ).join('');

      setAddress(simulatedAddress);
      setIsConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const disconnect = useCallback(() => {
    setAddress(undefined);
    setBalance(BigInt(0));
    setIsConnected(false);
  }, []);

  const approvePizza = useCallback(async (amount: bigint): Promise<boolean> => {
    if (!isConnected || !address) return false;

    setIsLoading(true);
    try {
      // In production:
      // const signer = await provider.getSigner();
      // const tokenContract = new ethers.Contract(PIZZA_TOKEN_ADDRESS, ERC20_ABI, signer);
      // const tx = await tokenContract.approve(GAME_CONTRACT_ADDRESS, amount);
      // await tx.wait();

      // Simulate approval
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Approved ${amount} PIZZA tokens`);
      return true;
    } catch (error) {
      console.error('Failed to approve PIZZA:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address]);

  const enterMatch = useCallback(async (matchId: string, amount: bigint): Promise<boolean> => {
    if (!isConnected || !address) return false;

    setIsLoading(true);
    try {
      // In production:
      // const signer = await provider.getSigner();
      // const gameContract = new ethers.Contract(GAME_CONTRACT_ADDRESS, GAME_ABI, signer);
      // const tx = await gameContract.enterMatch(matchId, amount);
      // await tx.wait();

      // Simulate entering match
      await new Promise(resolve => setTimeout(resolve, 1000));
      console.log(`Entered match ${matchId} with ${amount} PIZZA tokens`);

      // Update balance
      setBalance(prev => prev - amount);
      return true;
    } catch (error) {
      console.error('Failed to enter match:', error);
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [isConnected, address]);

  // Auto-refresh balance when connected
  useEffect(() => {
    if (isConnected && address) {
      refreshBalance();
    }
  }, [isConnected, address, refreshBalance]);

  return {
    address,
    balance,
    isConnected,
    isLoading,
    connect,
    disconnect,
    approvePizza,
    enterMatch,
    refreshBalance,
  };
}

// Interface for external use
export interface UseWallet {
  address?: string;
  balance: bigint;
  approvePizza: (amount: bigint) => Promise<void>;
  enterMatch: (amount: bigint) => Promise<void>;
}
