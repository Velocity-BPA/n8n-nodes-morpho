/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Market Utilities
 *
 * Helper functions for working with Morpho Blue markets.
 * Markets are identified by their unique market ID (bytes32 hash).
 */

import { ethers } from 'ethers';
import { ORACLE_PRICE_SCALE } from '../constants/oracles';

const WAD = 10n ** 18n;

/**
 * Market parameters tuple
 */
export interface MarketParams {
  loanToken: string;
  collateralToken: string;
  oracle: string;
  irm: string;
  lltv: bigint;
}

/**
 * Market state data from the contract
 */
export interface MarketData {
  totalSupplyAssets: bigint;
  totalSupplyShares: bigint;
  totalBorrowAssets: bigint;
  totalBorrowShares: bigint;
  lastUpdate: bigint;
  fee: bigint;
}

/**
 * Calculate market ID from market parameters
 *
 * The market ID is keccak256(abi.encode(marketParams))
 *
 * @param params - Market parameters
 * @returns Market ID as bytes32 hex string
 */
export function calculateMarketId(params: MarketParams): string {
  const abiCoder = new ethers.AbiCoder();
  const encoded = abiCoder.encode(
    ['address', 'address', 'address', 'address', 'uint256'],
    [params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
  );
  return ethers.keccak256(encoded);
}

/**
 * Validate a market ID format
 *
 * @param marketId - Market ID to validate
 * @returns True if valid bytes32 hex string
 */
export function isValidMarketId(marketId: string): boolean {
  if (!marketId.startsWith('0x')) {
    return false;
  }

  // bytes32 = 32 bytes = 64 hex characters + '0x' prefix
  if (marketId.length !== 66) {
    return false;
  }

  // Check if all characters are valid hex
  return /^0x[0-9a-fA-F]{64}$/.test(marketId);
}

/**
 * Validate an Ethereum address
 *
 * @param address - Address to validate
 * @returns True if valid address
 */
export function isValidAddress(address: string): boolean {
  try {
    return ethers.isAddress(address);
  } catch {
    return false;
  }
}

/**
 * Calculate market TVL (Total Value Locked)
 *
 * TVL = totalSupplyAssets - totalBorrowAssets (available liquidity)
 * Or you can consider TVL as just totalSupplyAssets
 *
 * @param totalSupplyAssets - Total supplied assets
 * @param oraclePrice - Oracle price (if converting to USD)
 * @param tokenDecimals - Token decimals
 * @returns TVL value
 */
export function calculateMarketTVL(
  totalSupplyAssets: bigint,
  oraclePrice?: bigint,
  tokenDecimals: number = 18,
): number {
  const tvl = Number(totalSupplyAssets) / Math.pow(10, tokenDecimals);

  if (oraclePrice) {
    // Convert to USD value
    const price = Number(oraclePrice) / Number(ORACLE_PRICE_SCALE);
    return tvl * price;
  }

  return tvl;
}

/**
 * Calculate available liquidity in a market
 *
 * @param totalSupplyAssets - Total supplied assets
 * @param totalBorrowAssets - Total borrowed assets
 * @returns Available liquidity
 */
export function calculateAvailableLiquidity(
  totalSupplyAssets: bigint,
  totalBorrowAssets: bigint,
): bigint {
  if (totalBorrowAssets >= totalSupplyAssets) {
    return 0n;
  }
  return totalSupplyAssets - totalBorrowAssets;
}

/**
 * Format LLTV for display
 *
 * @param lltv - LLTV value (scaled by 1e18)
 * @returns Formatted percentage string
 */
export function formatLLTV(lltv: bigint): string {
  const percentage = (Number(lltv) / Number(WAD)) * 100;
  return `${percentage.toFixed(2)}%`;
}

/**
 * Parse LLTV from percentage string
 *
 * @param percentageStr - Percentage string (e.g., "86" or "86%")
 * @returns LLTV as bigint (scaled by 1e18)
 */
export function parseLLTV(percentageStr: string): bigint {
  const percentage = parseFloat(percentageStr.replace('%', ''));
  return BigInt(Math.floor((percentage / 100) * Number(WAD)));
}

/**
 * Format token amount for display
 *
 * @param amount - Token amount in smallest unit
 * @param decimals - Token decimals
 * @param displayDecimals - Number of decimals to display
 * @returns Formatted string
 */
export function formatTokenAmount(
  amount: bigint,
  decimals: number = 18,
  displayDecimals: number = 4,
): string {
  const divisor = Math.pow(10, decimals);
  const value = Number(amount) / divisor;

  if (value >= 1_000_000_000) {
    return `${(value / 1_000_000_000).toFixed(2)}B`;
  }
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(2)}M`;
  }
  if (value >= 1_000) {
    return `${(value / 1_000).toFixed(2)}K`;
  }

  return value.toFixed(displayDecimals);
}

/**
 * Parse token amount from string
 *
 * @param amountStr - Amount as string
 * @param decimals - Token decimals
 * @returns Amount as bigint
 */
export function parseTokenAmount(amountStr: string, decimals: number = 18): bigint {
  const [whole, fraction = ''] = amountStr.split('.');
  const paddedFraction = fraction.padEnd(decimals, '0').slice(0, decimals);
  return BigInt(whole + paddedFraction);
}

/**
 * Calculate the value of collateral in loan token terms
 *
 * @param collateralAmount - Amount of collateral
 * @param oraclePrice - Oracle price (scaled by 1e36)
 * @returns Value in loan token terms
 */
export function calculateCollateralValue(collateralAmount: bigint, oraclePrice: bigint): bigint {
  return (collateralAmount * oraclePrice) / ORACLE_PRICE_SCALE;
}

/**
 * Check if a market has sufficient liquidity for a borrow
 *
 * @param borrowAmount - Amount to borrow
 * @param totalSupplyAssets - Total supplied assets
 * @param totalBorrowAssets - Total borrowed assets
 * @returns True if sufficient liquidity
 */
export function hasSufficientLiquidity(
  borrowAmount: bigint,
  totalSupplyAssets: bigint,
  totalBorrowAssets: bigint,
): boolean {
  const available = calculateAvailableLiquidity(totalSupplyAssets, totalBorrowAssets);
  return borrowAmount <= available;
}

/**
 * Shorten address for display
 *
 * @param address - Full address
 * @param chars - Number of characters to show on each end
 * @returns Shortened address (e.g., "0x1234...5678")
 */
export function shortenAddress(address: string, chars: number = 4): string {
  if (!address) return '';
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/**
 * Format market ID for display
 *
 * @param marketId - Full market ID
 * @returns Shortened market ID
 */
export function shortenMarketId(marketId: string): string {
  return shortenAddress(marketId, 8);
}

/**
 * Create market summary object
 *
 * @param params - Market parameters
 * @param data - Market data
 * @param oraclePrice - Current oracle price
 * @returns Summary object
 */
export function createMarketSummary(
  params: MarketParams,
  data: MarketData,
  oraclePrice: bigint,
) {
  const utilization =
    data.totalSupplyAssets > 0n
      ? Number((data.totalBorrowAssets * 10000n) / data.totalSupplyAssets) / 100
      : 0;

  const availableLiquidity = calculateAvailableLiquidity(
    data.totalSupplyAssets,
    data.totalBorrowAssets,
  );

  return {
    marketId: calculateMarketId(params),
    loanToken: params.loanToken,
    collateralToken: params.collateralToken,
    lltv: formatLLTV(params.lltv),
    totalSupply: data.totalSupplyAssets.toString(),
    totalBorrow: data.totalBorrowAssets.toString(),
    availableLiquidity: availableLiquidity.toString(),
    utilization: `${utilization.toFixed(2)}%`,
    oraclePrice: oraclePrice.toString(),
    lastUpdate: new Date(Number(data.lastUpdate) * 1000).toISOString(),
  };
}
