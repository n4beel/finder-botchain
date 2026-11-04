import { isAddress, getAddress, formatEther } from "viem";

// Constants matching contract
export const MAX_NAME_BYTES = 64;
export const MAX_DESC_BYTES = 300;
export const MIN_PRICE = 1_000_000_000_000_000n; // 0.001 ether
export const MAX_PRICE = 1_000_000_000_000_000_000_000_000n; // 1,000,000 ether
export const MIN_BPS = 100; // 1%
export const MAX_BPS = 3000; // 30%
export const MAX_STOCK = 10_000;
export const MIN_DURATION = 3600; // 1 hour
export const MAX_DURATION = 31536000; // 365 days
export const MAX_PAGE = 50;

export interface OfferData {
  id: bigint;
  seller: `0x${string}`;
  endsAt: bigint;
  stock: number;
  sold: number;
  finderBps: number;
  openedBlock: number;
  price: bigint;
  name: string;
  description?: string;
}

export interface SplitQuote {
  toSeller: bigint;
  toFinder: bigint;
}

export interface FinderTally {
  finder: `0x${string}`;
  buyers: number;
  earned: bigint;
}

/**
 * Pure calculation of split mirroring contract logic
 */
export function split(price: bigint, finderBps: number, hasFinder: boolean): SplitQuote {
  if (!hasFinder || finderBps <= 0) {
    return { toSeller: price, toFinder: 0n };
  }
  const toFinder = (price * BigInt(finderBps)) / 10000n;
  const toSeller = price - toFinder;
  return { toSeller, toFinder };
}

/**
 * Construct finder affiliate link
 */
export function finderLink(origin: string, id: bigint | number | string, address: `0x${string}`): string {
  const cleanOrigin = origin.replace(/\/$/, "");
  return `${cleanOrigin}/offer/${id}?f=${address}`;
}

/**
 * Parse and validate ?f= parameter
 */
export function parseFinderParam(searchParam: string | null | undefined): `0x${string}` | null {
  if (!searchParam) return null;
  const trimmed = searchParam.trim();
  if (isAddress(trimmed)) {
    return getAddress(trimmed) as `0x${string}`;
  }
  return null;
}

export function formatBOT(wei: bigint): string {
  return `${formatEther(wei)} BOT`;
}
