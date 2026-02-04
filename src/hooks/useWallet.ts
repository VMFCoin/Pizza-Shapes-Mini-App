'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { useAccount, useConnect, useDisconnect, usePublicClient, useWalletClient } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { parseUnits, formatUnits, encodeFunctionData, type Address } from 'viem';
import sdk from '@farcaster/miniapp-sdk';
import { PIZZA_TOKEN, CONTRACTS, BASE_MAINNET } from '@/lib/constants';
import { ERC20_ABI, SETTLEMENT_ABI } from '@/lib/contractAbis';
import { BASE_CHAIN_ID } from '@/lib/wagmi';

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
  connect: () => Promise<void>;
  disconnect: () => void;

  // Token actions
  refreshBalance: () => Promise<void>;
  approvePizza: (amount: bigint, spender?: Address) => Promise<TransactionState>;
  checkAllowance: (spender?: Address) => Promise<bigint>;

  // Match actions
  enterMatch: (matchId: string, tier: number) => Promise<TransactionState>;

  // Transaction state
  txState: TransactionState;
  resetTxState: () => void;
}

export function useWallet(): UseWalletReturn {
  // Wagmi hooks
  const { address, isConnected, chainId } = useAccount();
  const { connectAsync, isPending: isConnecting } = useConnect();
  const { disconnectAsync } = useDisconnect();
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Local state
  const [balance, setBalance] = useState<bigint>(BigInt(0));
  const [isLoadingBalance, setIsLoadingBalance] = useState(false);
  const [txState, setTxState] = useState<TransactionState>({ status: 'idle' });
  const [isFarcasterContext, setIsFarcasterContext] = useState(false);

  // Check if running in Farcaster Mini App
  useEffect(() => {
    const checkContext = async () => {
      try {
        const ctx = await sdk.context;
        setIsFarcasterContext(!!ctx?.user);
      } catch {
        setIsFarcasterContext(false);
      }
    };
    checkContext();
  }, []);

  // Format balance for display
  const formattedBalance = useMemo(() => {
    const value = Number(formatUnits(balance, 18));
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(2);
  }, [balance]);

  // Fetch $PIZZA balance
  const refreshBalance = useCallback(async () => {
    if (!address || !publicClient) return;

    setIsLoadingBalance(true);
    try {
      const balanceResult = await publicClient.readContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      });
      setBalance(balanceResult as bigint);
    } catch (error) {
      console.error('Failed to fetch balance:', error);
    } finally {
      setIsLoadingBalance(false);
    }
  }, [address, publicClient]);

  // Connect wallet
  const connect = useCallback(async () => {
    try {
      // In Farcaster Mini App context, use the injected wallet
      await connectAsync({
        connector: injected(),
        chainId: BASE_CHAIN_ID,
      });
    } catch (error) {
      console.error('Failed to connect wallet:', error);
      throw error;
    }
  }, [connectAsync]);

  // Disconnect wallet
  const disconnect = useCallback(async () => {
    try {
      await disconnectAsync();
      setBalance(BigInt(0));
    } catch (error) {
      console.error('Failed to disconnect:', error);
    }
  }, [disconnectAsync]);

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
    if (!walletClient || !address || !publicClient) {
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
      const hash = await walletClient.writeContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [spenderAddress, amount],
      });

      setTxState({ status: 'confirming', hash });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setTxState({ status: 'success', hash });
        return { status: 'success', hash };
      } else {
        setTxState({ status: 'error', error: 'Transaction failed' });
        return { status: 'error', error: 'Transaction failed' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxState({ status: 'error', error: errorMessage });
      return { status: 'error', error: errorMessage };
    }
  }, [walletClient, address, publicClient, checkAllowance]);

  // Enter match with entry fee
  const enterMatch = useCallback(async (
    matchId: string,
    tier: number
  ): Promise<TransactionState> => {
    if (!walletClient || !address || !publicClient) {
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
        const approvalResult = await approvePizza(amount, CONTRACTS.settlement as Address);
        if (approvalResult.status === 'error') {
          return approvalResult;
        }
      }

      setTxState({ status: 'pending_confirmation' });

      // Step 2: Convert matchId to bytes32
      const matchIdBytes = matchId.startsWith('0x')
        ? matchId as `0x${string}`
        : `0x${matchId.padEnd(64, '0')}` as `0x${string}`;

      // Step 3: Enter match
      const hash = await walletClient.writeContract({
        address: CONTRACTS.settlement as Address,
        abi: SETTLEMENT_ABI,
        functionName: 'enterMatch',
        args: [matchIdBytes, tier],
      });

      setTxState({ status: 'confirming', hash });

      // Wait for confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        // Refresh balance after successful entry
        await refreshBalance();
        setTxState({ status: 'success', hash });
        return { status: 'success', hash };
      } else {
        setTxState({ status: 'error', error: 'Transaction failed' });
        return { status: 'error', error: 'Transaction failed' };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setTxState({ status: 'error', error: errorMessage });
      return { status: 'error', error: errorMessage };
    }
  }, [walletClient, address, publicClient, balance, checkAllowance, approvePizza, refreshBalance]);

  // Reset transaction state
  const resetTxState = useCallback(() => {
    setTxState({ status: 'idle' });
  }, []);

  // Auto-refresh balance when connected
  useEffect(() => {
    if (isConnected && address) {
      refreshBalance();
      // Refresh every 30 seconds
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
  };
}
