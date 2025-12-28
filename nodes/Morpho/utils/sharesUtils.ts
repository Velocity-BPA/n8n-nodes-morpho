/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Blue Share/Asset Conversion Utilities
 *
 * Morpho Blue uses a share-based accounting system for supply and borrow positions.
 * Shares represent proportional ownership in the pool and accrue interest over time.
 *
 * Key concepts:
 * - Virtual shares and assets prevent share manipulation on first deposit
 * - Supply shares track lending positions
 * - Borrow shares track debt positions
 * - Share value increases as interest accrues
 */

import { VIRTUAL_SHARES, VIRTUAL_ASSETS } from '../constants/contracts';

/**
 * Market state containing total supply and borrow data
 */
export interface MarketState {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
}

/**
 * Convert supply assets to shares
 *
 * Formula: shares = assets * (totalShares + virtualShares) / (totalAssets + virtualAssets)
 *
 * @param assets - Amount of assets to convert
 * @param totalAssets - Total supply assets in the market
 * @param totalShares - Total supply shares in the market
 * @returns The equivalent number of shares
 */
export function toSupplyShares(
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivDown(
    assets,
    totalShares + VIRTUAL_SHARES,
    totalAssets + VIRTUAL_ASSETS,
  );
}

/**
 * Convert supply shares to assets
 *
 * Formula: assets = shares * (totalAssets + virtualAssets) / (totalShares + virtualShares)
 *
 * @param shares - Number of shares to convert
 * @param totalAssets - Total supply assets in the market
 * @param totalShares - Total supply shares in the market
 * @returns The equivalent amount of assets
 */
export function toSupplyAssets(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivDown(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES,
  );
}

/**
 * Convert borrow assets to shares (round up for debt)
 *
 * @param assets - Amount of assets to convert
 * @param totalAssets - Total borrow assets in the market
 * @param totalShares - Total borrow shares in the market
 * @returns The equivalent number of shares (rounded up)
 */
export function toBorrowShares(
  assets: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivUp(
    assets,
    totalShares + VIRTUAL_SHARES,
    totalAssets + VIRTUAL_ASSETS,
  );
}

/**
 * Convert borrow shares to assets
 *
 * @param shares - Number of shares to convert
 * @param totalAssets - Total borrow assets in the market
 * @param totalShares - Total borrow shares in the market
 * @returns The equivalent amount of assets
 */
export function toBorrowAssets(
  shares: bigint,
  totalAssets: bigint,
  totalShares: bigint,
): bigint {
  return mulDivUp(
    shares,
    totalAssets + VIRTUAL_ASSETS,
    totalShares + VIRTUAL_SHARES,
  );
}

/**
 * Multiply and divide with rounding down
 *
 * @param x - First operand
 * @param y - Multiplier
 * @param d - Divisor
 * @returns (x * y) / d rounded down
 */
export function mulDivDown(x: bigint, y: bigint, d: bigint): bigint {
  return (x * y) / d;
}

/**
 * Multiply and divide with rounding up
 *
 * @param x - First operand
 * @param y - Multiplier
 * @param d - Divisor
 * @returns (x * y) / d rounded up
 */
export function mulDivUp(x: bigint, y: bigint, d: bigint): bigint {
  const result = x * y;
  return (result + d - 1n) / d;
}

/**
 * Calculate the exchange rate for supply (assets per share)
 *
 * @param totalAssets - Total supply assets
 * @param totalShares - Total supply shares
 * @returns Exchange rate as a bigint (scaled by 1e18)
 */
export function supplyExchangeRate(totalAssets: bigint, totalShares: bigint): bigint {
  const WAD = 10n ** 18n;
  if (totalShares === 0n) return WAD;
  return mulDivDown(
    (totalAssets + VIRTUAL_ASSETS) * WAD,
    1n,
    totalShares + VIRTUAL_SHARES,
  );
}

/**
 * Calculate the exchange rate for borrow (assets per share)
 *
 * @param totalAssets - Total borrow assets
 * @param totalShares - Total borrow shares
 * @returns Exchange rate as a bigint (scaled by 1e18)
 */
export function borrowExchangeRate(totalAssets: bigint, totalShares: bigint): bigint {
  const WAD = 10n ** 18n;
  if (totalShares === 0n) return WAD;
  return mulDivUp(
    (totalAssets + VIRTUAL_ASSETS) * WAD,
    1n,
    totalShares + VIRTUAL_SHARES,
  );
}

/**
 * Format shares for display (divide by 1e6 virtual shares offset)
 *
 * @param shares - Raw share amount
 * @param decimals - Token decimals for formatting
 * @returns Formatted share string
 */
export function formatShares(shares: bigint, decimals: number = 18): string {
  const divisor = 10n ** BigInt(decimals);
  const wholePart = shares / divisor;
  const fractionalPart = shares % divisor;
  const fractionalStr = fractionalPart.toString().padStart(decimals, '0');
  return `${wholePart}.${fractionalStr}`;
}

/**
 * Parse shares from string to bigint
 *
 * @param sharesStr - Share amount as string
 * @param decimals - Token decimals
 * @returns Share amount as bigint
 */
export function parseShares(sharesStr: string, decimals: number = 18): bigint {
  const [whole, fraction = ''] = sharesStr.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Calculate the share price (value of 1 share in assets)
 *
 * @param market - Market state
 * @param isSupply - Whether to calculate for supply (true) or borrow (false)
 * @returns Price per share as a number
 */
export function sharePrice(market: MarketState, isSupply: boolean): number {
  const WAD = 10n ** 18n;
  let rate: bigint;

  if (isSupply) {
    rate = supplyExchangeRate(market.totalSupplyAssets, market.totalSupplyShares);
  } else {
    rate = borrowExchangeRate(market.totalBorrowAssets, market.totalBorrowShares);
  }

  return Number(rate) / Number(WAD);
}
