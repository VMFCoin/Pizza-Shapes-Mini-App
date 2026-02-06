'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, usePublicClient } from 'wagmi';
import { useAppKit } from '@reown/appkit/react';
import { parseUnits, formatUnits, type Address } from 'viem';
import { PIZZA_TOKEN, CONTRACTS } from '@/lib/constants';
import { ERC20_ABI, SETTLEMENT_ABI } from '@/lib/contractAbis';

// Transaction states for UI feedback
export type TransactionStatus =
  | 'idle'
  | 'pending_approval'
  | 'approving'
  | 'pending_confirmation'
  | 'confirming'
  | 'success'
  | 'error';

export interface TransactionState {
  status: TransactionStatus;
  hash?: `0x${string}`;
  error?: string;
}

interface UseWalletReturn {
  // Connection state
  address: Address | undefined;
  isConnected: boolean;
  isConnecting: boolean;
  chainId: number | undefined;

  // Balance
  balance: bigint;
  formattedBalance: string;
  isLoadingBalance: boolean;

  // Connection actions
  connect: () => void;
  disconnect: () => void;

  // Token actions
  refreshBalance: () => void;
  approvePizza: (amount: bigint, spender?: Address) => Promise<TransactionState>;
  checkAllowance: (spender?: Address) => Promise<bigint>;

  // Match actions
  enterMatch: (matchId: string, tier: number) => Promise<TransactionState>;

  // Transaction state
  txState: TransactionState;
  resetTxState: () => void;

  // Write contract state
  isPending: boolean;
  isConfirming: boolean;
  isConfirmed: boolean;
}

export function useWallet(): UseWalletReturn {
  // Account state from wagmi
  const { address, isConnected, isConnecting, chainId } = useAccount();

  // AppKit for wallet connection modal
  const { open } = useAppKit();

  // Public client for reading
  const publicClient = usePublicClient();

  // Write contract hooks
  const { writeContract, data: writeHash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash: writeHash });

  // Read $PIZZA balance
  const { data: balanceData, refetch: refetchBalance, isLoading: isLoadingBalance } = useReadContract({
    address: PIZZA_TOKEN as Address,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // Local state
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });

  const balance = (balanceData as bigint) || BigInt(0);

  // Format balance for display
  const formattedBalance = useMemo(() => {
    const value = Number(formatUnits(balance, 18));
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  }, [balance]);

  // Connect wallet using AppKit modal
  const connect = useCallback(() => {
    open();
  }, [open]);

  // Disconnect wallet
  const disconnect = useCallback(() => {
    open({ view: 'Account' });
  }, [open]);

  // Refresh balance
  const refreshBalance = useCallback(() => {
    refetchBalance();
  }, [refetchBalance]);

  // Check token allowance
  const checkAllowance = useCallback(async (spender?: Address): Promise<bigint> => {
    if (!address || !publicClient) return BigInt(0);

    const spenderAddress = spender || (CONTRACTS.settlement as Address);

    try {
      const allowance = await publicClient.readContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, spenderAddress],
      });
      return allowance as bigint;
    } catch (error) {
      console.error('Failed to check allowance:', error);
      return BigInt(0);
    }
  }, [address, publicClient]);

  // Approve $PIZZA spending
  const approvePizza = useCallback(async (
    amount: bigint,
    spender?: Address
  ): Promise<TransactionState> => {
    if (!address) {
      return { status: 'error', error: 'Wallet not connected' };
    }

    const spenderAddress = spender || (CONTRACTS.settlement as Address);
    setTxState({ status: 'pending_approval' });

    try {
      // Check current allowance first
      const currentAllowance = await checkAllowance(spenderAddress);
      if (currentAllowance >= amount) {
        setTxState({ status: 'success' });
        return { status: 'success' };
      }

      setTxState({ status: 'approving' });

      // Send approval transaction
      writeContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
      });

      // Note: Transaction confirmation is handled by useWaitForTransactionReceipt
      return { status: 'pending_confirmation' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxState({ status: 'error', error: errorMessage });
      return { status: 'error', error: errorMessage };
    }
  }, [address, checkAllowance, writeContract]);

  // Enter match with entry fee
  const enterMatch = useCallback(async (
    matchId: string,
    tier: number
  ): Promise<TransactionState> => {
    if (!address) {
      return { status: 'error', error: 'Wallet not connected' };
    }

    // Calculate tier amount
    const tierAmounts: Record<number, bigint> = {
      1: parseUnits('0.25', 18),
      2: parseUnits('0.5', 18),
      3: parseUnits('1', 18),
    };
    const amount = tierAmounts[tier];
    if (!amount) {
      return { status: 'error', error: 'Invalid tier' };
    }

    // Check balance
    if (balance < amount) {
      return { status: 'error', error: 'Insufficient $PIZZA balance' };
    }

    setTxState({ status: 'pending_approval' });

    try {
      // Step 1: Approve if needed
      const allowance = await checkAllowance(CONTRACTS.settlement as Address);
      if (allowance < amount) {
        setTxState({ status: 'approving' });
        writeContract({
          address: PIZZA_TOKEN as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [CONTRACTS.settlement as Address, amount],
        });
        // Wait for approval to be confirmed before entering match
        return { status: 'pending_confirmation' };
      }

      setTxState({ status: 'pending_confirmation' });

      // Step 2: Convert matchId to bytes32
      const matchIdBytes = matchId.startsWith('0x')
        ? matchId as `0x${string}`
        : `0x${matchId.padEnd(64, '0')}` as `0x${string}`;

      // Step 3: Enter match (V3: pass amount instead of tier)
      writeContract({
        address: CONTRACTS.settlement as Address,
        abi: SETTLEMENT_ABI,
        functionName: 'enterMatch',
        args: [matchIdBytes, amount],
      });

      return { status: 'pending_confirmation' };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxState({ status: 'error', error: errorMessage });
      return { status: 'error', error: errorMessage };
    }
  }, [address, balance, checkAllowance, writeContract]);

  // Reset transaction state
  const resetTxState = useCallback(() => {
    setTxState({ status: 'idle' });
    reset();
  }, [reset]);

  // Update txState when transaction confirms
  useEffect(() => {
    if (isConfirmed && writeHash) {
      setTxState({ status: 'success', hash: writeHash });
      refreshBalance();
    }
  }, [isConfirmed, writeHash, refreshBalance]);

  // Auto-refresh balance periodically when connected
  useEffect(() => {
    if (isConnected && address) {
      const interval = setInterval(refreshBalance, 30000);
      return () => clearInterval(interval);
    }
  }, [isConnected, address, refreshBalance]);

  return {
    address,
    isConnected,
    isConnecting,
    chainId,
    balance,
    formattedBalance,
    isLoadingBalance,
    connect,
    disconnect,
    refreshBalance,
    approvePizza,
    checkAllowance,
    enterMatch,
    txState,
    resetTxState,
    isPending,
    isConfirming,
    isConfirmed,
  };
}
