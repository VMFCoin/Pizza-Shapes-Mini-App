'use client';

import { useState, useCallback } from 'react';
import { parseUnits, formatUnits, type Address } from 'viem';
import { usePublicClient, useWalletClient } from 'wagmi';
import { PIZZA_TOKEN, CONTRACTS, PRIZE_DISTRIBUTION } from '@/lib/constants';
import { ERC20_ABI, SETTLEMENT_ABI } from '@/lib/contractAbis';
import { tierToAmount } from '@/lib/contracts';

// Payment flow states
export type PaymentStep =
  | 'idle'
  | 'checking_balance'
  | 'insufficient_balance'
  | 'checking_allowance'
  | 'requesting_approval'
  | 'approving'
  | 'approval_confirmed'
  | 'requesting_payment'
  | 'confirming_payment'
  | 'success'
  | 'error';

export interface PaymentState {
  step: PaymentStep;
  approvalHash?: `0x${string}`;
  paymentHash?: `0x${string}`;
  error?: string;
  prizeBreakdown?: PrizeBreakdown;
}

export interface PrizeBreakdown {
  totalPool: bigint;
  winner: bigint;         // 77%
  weeklyTop3: bigint;     // 10%
  burned: bigint;         // 7%
  dailyFreeRoll: bigint;  // 3%
  charities: bigint;      // 3%
}

interface UsePaymentReturn {
  paymentState: PaymentState;
  enterMatchWithPayment: (matchId: string, tier: number, address: Address, priceUsd: number) => Promise<boolean>;
  calculatePrizeBreakdown: (entryAmount: bigint, playerCount: number) => PrizeBreakdown;
  formatPizzaAmount: (amount: bigint) => string;
  resetPayment: () => void;
}

export function usePayment(): UsePaymentReturn {
  const [paymentState, setPaymentState] = useState<PaymentState>({ step: 'idle' });
  const publicClient = usePublicClient();
  const { data: walletClient } = useWalletClient();

  // Calculate prize breakdown based on entry amount and player count
  const calculatePrizeBreakdown = useCallback((entryAmount: bigint, playerCount: number): PrizeBreakdown => {
    const totalPool = entryAmount * BigInt(playerCount);

    return {
      totalPool,
      winner: (totalPool * BigInt(PRIZE_DISTRIBUTION.winner)) / BigInt(10000),
      weeklyTop3: (totalPool * BigInt(PRIZE_DISTRIBUTION.weekly)) / BigInt(10000),
      burned: (totalPool * BigInt(PRIZE_DISTRIBUTION.burn)) / BigInt(10000),
      dailyFreeRoll: (totalPool * BigInt(PRIZE_DISTRIBUTION.freeRoll)) / BigInt(10000),
      charities: (totalPool * BigInt(PRIZE_DISTRIBUTION.charity)) / BigInt(10000),
    };
  }, []);

  // Format PIZZA amount for display
  const formatPizzaAmount = useCallback((amount: bigint): string => {
    const value = Number(formatUnits(amount, 18));
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
    return value.toFixed(4);
  }, []);

  // Main entry flow with payment
  const enterMatchWithPayment = useCallback(async (
    matchId: string,
    tier: number,
    address: Address,
    priceUsd: number
  ): Promise<boolean> => {
    if (!publicClient || !walletClient) {
      setPaymentState({ step: 'error', error: 'Wallet not connected' });
      return false;
    }

    const settlementAddress = CONTRACTS.settlement as Address;
    const zeroAddress = '0x0000000000000000000000000000000000000000';

    // Validate settlement contract is configured
    if (!settlementAddress || settlementAddress === zeroAddress) {
      setPaymentState({
        step: 'error',
        error: 'Settlement contract not configured. Please contact the developer.',
      });
      return false;
    }

    // Calculate dynamic PIZZA amount based on live USD price
    const entryAmount = tierToAmount(tier, priceUsd);

    if (entryAmount === BigInt(0)) {
      setPaymentState({
        step: 'error',
        error: 'Unable to calculate entry amount. Price data unavailable.',
      });
      return false;
    }

    try {
      // Step 1: Check balance
      setPaymentState({ step: 'checking_balance' });

      const balance = await publicClient.readContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [address],
      }) as bigint;

      if (balance < entryAmount) {
        const needed = formatPizzaAmount(entryAmount);
        const have = formatPizzaAmount(balance);
        setPaymentState({
          step: 'insufficient_balance',
          error: `Insufficient balance. Need ${needed} $PIZZA, have ${have} $PIZZA`,
        });
        return false;
      }

      // Step 2: Check allowance
      setPaymentState({ step: 'checking_allowance' });

      const allowance = await publicClient.readContract({
        address: PIZZA_TOKEN as Address,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [address, settlementAddress],
      }) as bigint;

      // Step 3: Approve if needed
      if (allowance < entryAmount) {
        setPaymentState({ step: 'requesting_approval' });

        const approvalAmount = entryAmount;

        const approvalHash = await walletClient.writeContract({
          address: PIZZA_TOKEN as Address,
          abi: ERC20_ABI,
          functionName: 'approve',
          args: [settlementAddress, approvalAmount],
        });

        setPaymentState({ step: 'approving', approvalHash });

        // Wait for approval confirmation
        const approvalReceipt = await publicClient.waitForTransactionReceipt({
          hash: approvalHash,
        });

        if (approvalReceipt.status !== 'success') {
          setPaymentState({
            step: 'error',
            approvalHash,
            error: 'Approval transaction failed',
          });
          return false;
        }

        setPaymentState({ step: 'approval_confirmed', approvalHash });
      }

      // Step 4: Enter match — V3 contract: enterMatch(bytes32, uint256)
      setPaymentState({ step: 'requesting_payment' });

      // Convert matchId to bytes32
      const matchIdBytes = matchId.startsWith('0x')
        ? matchId as `0x${string}`
        : `0x${Buffer.from(matchId).toString('hex').padEnd(64, '0')}` as `0x${string}`;

      const paymentHash = await walletClient.writeContract({
        address: settlementAddress,
        abi: SETTLEMENT_ABI,
        functionName: 'enterMatch',
        args: [matchIdBytes, entryAmount],
      });

      setPaymentState({ step: 'confirming_payment', paymentHash });

      // Wait for payment confirmation
      const paymentReceipt = await publicClient.waitForTransactionReceipt({
        hash: paymentHash,
      });

      if (paymentReceipt.status !== 'success') {
        setPaymentState({
          step: 'error',
          paymentHash,
          error: 'Entry transaction failed',
        });
        return false;
      }

      // Calculate prize breakdown for display
      const prizeBreakdown = calculatePrizeBreakdown(entryAmount, 2);

      setPaymentState({
        step: 'success',
        paymentHash,
        prizeBreakdown,
      });

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      // Handle user rejection
      if (errorMessage.includes('User rejected') || errorMessage.includes('user rejected')) {
        setPaymentState({
          step: 'error',
          error: 'Transaction cancelled by user',
        });
      } else {
        setPaymentState({
          step: 'error',
          error: errorMessage,
        });
      }
      return false;
    }
  }, [publicClient, walletClient, calculatePrizeBreakdown, formatPizzaAmount]);

  // Reset payment state
  const resetPayment = useCallback(() => {
    setPaymentState({ step: 'idle' });
  }, []);

  return {
    paymentState,
    enterMatchWithPayment,
    calculatePrizeBreakdown,
    formatPizzaAmount,
    resetPayment,
  };
}

// Helper: Get step message for UI
export function getPaymentStepMessage(step: PaymentStep): string {
  switch (step) {
    case 'idle':
      return 'Ready to play';
    case 'checking_balance':
      return 'Checking $PIZZA balance...';
    case 'insufficient_balance':
      return 'Insufficient $PIZZA balance';
    case 'checking_allowance':
      return 'Checking approval...';
    case 'requesting_approval':
      return 'Please approve $PIZZA spending in your wallet';
    case 'approving':
      return 'Waiting for approval confirmation...';
    case 'approval_confirmed':
      return 'Approval confirmed!';
    case 'requesting_payment':
      return 'Please confirm entry fee in your wallet';
    case 'confirming_payment':
      return 'Confirming entry...';
    case 'success':
      return 'Entry confirmed! Joining match...';
    case 'error':
      return 'Transaction failed';
    default:
      return '';
  }
}

// Helper: Check if step is a loading state
export function isPaymentLoading(step: PaymentStep): boolean {
  return [
    'checking_balance',
    'checking_allowance',
    'requesting_approval',
    'approving',
    'requesting_payment',
    'confirming_payment',
  ].includes(step);
}
