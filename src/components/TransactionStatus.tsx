'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { type PaymentStep, getPaymentStepMessage, isPaymentLoading } from '@/hooks/usePayment';
import { BASE_MAINNET } from '@/lib/constants';

interface TransactionStatusProps {
  step: PaymentStep;
  hash?: `0x${string}`;
  error?: string;
  onDismiss?: () => void;
}

export function TransactionStatus({ step, hash, error, onDismiss }: TransactionStatusProps) {
  if (step === 'idle') return null;

  const isLoading = isPaymentLoading(step);
  const isSuccess = step === 'success';
  const isError = step === 'error';
  const message = error || getPaymentStepMessage(step);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -20 }}
        className={`rounded-xl p-4 ${
          isError
            ? 'bg-red-500/20 border border-red-500/30'
            : isSuccess
              ? 'bg-green-500/20 border border-green-500/30'
              : 'bg-orange-500/20 border border-orange-500/30'
        }`}
      >
        <div className="flex items-center gap-3">
          {/* Status indicator */}
          {isLoading && (
            <div className="w-5 h-5 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
          )}
          {isSuccess && (
            <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            </div>
          )}
          {isError && (
            <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
          )}

          {/* Message */}
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              isError ? 'text-red-300' : isSuccess ? 'text-green-300' : 'text-orange-300'
            }`}>
              {message}
            </p>

            {/* Transaction link */}
            {hash && (
              <a
                href={`${BASE_MAINNET.blockExplorer}/tx/${hash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline mt-1 inline-block"
              >
                View on BaseScan
              </a>
            )}
          </div>

          {/* Dismiss button */}
          {(isSuccess || isError) && onDismiss && (
            <button
              onClick={onDismiss}
              className="p-1 hover:bg-white/10 rounded-full transition-colors"
            >
              <svg className="w-4 h-4 text-white/60" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// Simplified inline status for compact displays
export function TransactionStatusInline({ step, hash }: { step: PaymentStep; hash?: `0x${string}` }) {
  if (step === 'idle') return null;

  const isLoading = isPaymentLoading(step);

  return (
    <div className="flex items-center gap-2 text-sm">
      {isLoading && (
        <div className="w-3 h-3 border-2 border-orange-400 border-t-transparent rounded-full animate-spin" />
      )}
      <span className="text-orange-300">{getPaymentStepMessage(step)}</span>
      {hash && (
        <a
          href={`${BASE_MAINNET.blockExplorer}/tx/${hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:text-blue-300"
        >
          Tx
        </a>
      )}
    </div>
  );
}
