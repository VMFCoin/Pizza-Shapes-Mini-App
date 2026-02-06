import { PIZZA_TOKEN } from '@/lib/constants';

export interface PriceResult {
  priceUsd: number;
  source: 'dexscreener' | 'coingecko';
  fetchedAt: number;
}

/**
 * Fetch PIZZA price from DexScreener (primary source)
 */
async function fetchFromDexScreener(): Promise<number> {
  const url = `https://api.dexscreener.com/latest/dex/tokens/${PIZZA_TOKEN}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    throw new Error(`DexScreener returned ${res.status}`);
  }

  const data = await res.json();
  const pairs = data?.pairs;

  if (!pairs || pairs.length === 0) {
    throw new Error('No pairs found on DexScreener');
  }

  // Pick highest-liquidity pair
  const bestPair = pairs.reduce((best: any, pair: any) => {
    const liquidity = pair.liquidity?.usd || 0;
    const bestLiquidity = best.liquidity?.usd || 0;
    return liquidity > bestLiquidity ? pair : best;
  }, pairs[0]);

  const priceUsd = parseFloat(bestPair.priceUsd);

  if (isNaN(priceUsd) || priceUsd <= 0) {
    throw new Error('Invalid price from DexScreener');
  }

  return priceUsd;
}

/**
 * Fetch PIZZA price from CoinGecko (fallback source)
 */
async function fetchFromCoinGecko(): Promise<number> {
  const url = `https://api.coingecko.com/api/v3/simple/token_price/base?contract_addresses=${PIZZA_TOKEN}&vs_currencies=usd`;
  const res = await fetch(url, { signal: AbortSignal.timeout(10000) });

  if (!res.ok) {
    throw new Error(`CoinGecko returned ${res.status}`);
  }

  const data = await res.json();
  const tokenData = data?.[PIZZA_TOKEN.toLowerCase()];

  if (!tokenData || typeof tokenData.usd !== 'number') {
    throw new Error('Invalid price from CoinGecko');
  }

  const priceUsd = tokenData.usd;

  if (priceUsd <= 0) {
    throw new Error('Price is zero or negative from CoinGecko');
  }

  return priceUsd;
}

/**
 * Fetch PIZZA price — tries DexScreener first, falls back to CoinGecko
 */
export async function fetchPizzaPrice(): Promise<PriceResult> {
  // Try DexScreener first
  try {
    const priceUsd = await fetchFromDexScreener();
    return { priceUsd, source: 'dexscreener', fetchedAt: Date.now() };
  } catch (dexErr) {
    console.warn('DexScreener price fetch failed, trying CoinGecko:', dexErr);
  }

  // Fallback to CoinGecko
  try {
    const priceUsd = await fetchFromCoinGecko();
    return { priceUsd, source: 'coingecko', fetchedAt: Date.now() };
  } catch (geckoErr) {
    console.error('CoinGecko price fetch also failed:', geckoErr);
    throw new Error('Unable to fetch PIZZA price from any source');
  }
}

/**
 * Convert a USD amount to PIZZA token amount (as bigint with 18 decimals)
 */
export function usdToPizzaAmount(usdAmount: number, priceUsd: number): bigint {
  if (priceUsd <= 0) throw new Error('Invalid price');

  const pizzaAmount = usdAmount / priceUsd;

  // Convert to 18-decimal bigint
  // Use string math to avoid floating point precision loss
  const wholePart = Math.floor(pizzaAmount);
  const fractionalPart = pizzaAmount - wholePart;

  // 18 decimal places
  const wholeWei = BigInt(wholePart) * BigInt('1000000000000000000');
  const fracWei = BigInt(Math.floor(fractionalPart * 1e18));

  return wholeWei + fracWei;
}
