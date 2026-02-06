'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { fetchPizzaPrice, usdToPizzaAmount, type PriceResult } from '@/lib/priceService';

const REFRESH_INTERVAL = 60_000; // 60 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [2000, 5000, 10000]; // exponential-ish backoff

interface UsePizzaPriceReturn {
  priceUsd: number | null;
  source: PriceResult['source'] | null;
  isLoading: boolean;
  error: string | null;
  lastUpdated: number | null;
  usdToPizza: (usdAmount: number) => bigint | null;
  refetch: () => void;
}

export function usePizzaPrice(): UsePizzaPriceReturn {
  const [priceData, setPriceData] = useState<PriceResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const doFetch = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const result = await fetchPizzaPrice();
      setPriceData(result);
      retryCount.current = 0;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch price';

      if (retryCount.current < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retryCount.current] || 10000;
        retryCount.current += 1;
        setTimeout(doFetch, delay);
      } else {
        setError(message);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial fetch + auto-refresh
  useEffect(() => {
    doFetch();

    intervalRef.current = setInterval(doFetch, REFRESH_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [doFetch]);

  const usdToPizza = useCallback(
    (usdAmount: number): bigint | null => {
      if (!priceData) return null;
      return usdToPizzaAmount(usdAmount, priceData.priceUsd);
    },
    [priceData]
  );

  const refetch = useCallback(() => {
    retryCount.current = 0;
    doFetch();
  }, [doFetch]);

  return {
    priceUsd: priceData?.priceUsd ?? null,
    source: priceData?.source ?? null,
    isLoading: isLoading && !priceData, // only show loading if we have no data yet
    error,
    lastUpdated: priceData?.fetchedAt ?? null,
    usdToPizza,
    refetch,
  };
}
