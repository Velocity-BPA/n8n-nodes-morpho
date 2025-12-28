/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Health Factor and Liquidation Utilities
 *
 * Health factor represents the safety of a borrowing position.
 * - Health Factor > 1: Position is safe
 * - Health Factor = 1: Position is at liquidation threshold
 * - Health Factor < 1: Position can be liquidated
 *
 * Key concepts:
 * - LLTV (Liquidation Loan-to-Value): Max LTV before liquidation
 * - Collateral Value: Value of collateral in quote token terms
 * - Borrow Value: Total debt owed
 * - Liquidation Price: Price at which position becomes liquidatable
 */

import { ORACLE_PRICE_SCALE } from '../constants/oracles';
import { toBorrowAssets } from './sharesUtils';

const WAD = 10n ** 18n;

/**
 * Position data for health calculations
 */
export interface PositionData {
  collateral: bigint; // Collateral amount in collateral token units
  borrowShares: bigint; // Borrow shares
  totalBorrowAssets: bigint; // Market total borrow assets
  totalBorrowShares: bigint; // Market total borrow shares
}

/**
 * Market parameters for health calculations
 */
export interface MarketParams {
  lltv: bigint; // Liquidation LTV (scaled by 1e18)
  oraclePrice: bigint; // Oracle price (scaled by 1e36)
  collateralDecimals: number;
  loanDecimals: number;
}

/**
 * Calculate the health factor of a position
 *
 * Formula: healthFactor = (collateral * oraclePrice * LLTV) / (borrowValue * 10^36)
 *
 * @param position - Position data
 * @param params - Market parameters
 * @returns Health factor as a number (>1 is safe, <1 is liquidatable)
 */
export function calculateHealthFactor(
  position: PositionData,
  params: MarketParams,
): number {
  if (position.borrowShares === 0n) {
    return Infinity; // No debt means infinite health
  }

  // Convert borrow shares to assets
  const borrowAssets = toBorrowAssets(
    position.borrowShares,
    position.totalBorrowAssets,
    position.totalBorrowShares,
  );

  if (borrowAssets === 0n) {
    return Infinity;
  }

  // Calculate collateral value in loan token terms
  // collateralValue = collateral * oraclePrice / ORACLE_PRICE_SCALE
  const collateralValue = (position.collateral * params.oraclePrice) / ORACLE_PRICE_SCALE;

  // Calculate max borrowable value with LLTV
  // maxBorrowValue = collateralValue * LLTV / WAD
  const maxBorrowValue = (collateralValue * params.lltv) / WAD;

  // Health factor = maxBorrowValue / borrowAssets
  // Scale to get a floating point result
  const healthFactorScaled = (maxBorrowValue * WAD) / borrowAssets;

  return Number(healthFactorScaled) / Number(WAD);
}

/**
 * Calculate the liquidation price for a position
 *
 * This is the oracle price at which the position becomes liquidatable.
 *
 * Formula: liquidationPrice = (borrowValue * ORACLE_PRICE_SCALE) / (collateral * LLTV)
 *
 * @param position - Position data
 * @param params - Market parameters
 * @returns Liquidation price (scaled by ORACLE_PRICE_SCALE)
 */
export function calculateLiquidationPrice(
  position: PositionData,
  params: MarketParams,
): bigint {
  if (position.borrowShares === 0n || position.collateral === 0n) {
    return 0n;
  }

  const borrowAssets = toBorrowAssets(
    position.borrowShares,
    position.totalBorrowAssets,
    position.totalBorrowShares,
  );

  // liquidationPrice = borrowAssets * ORACLE_PRICE_SCALE * WAD / (collateral * LLTV)
  const liquidationPrice =
    (borrowAssets * ORACLE_PRICE_SCALE * WAD) / (position.collateral * params.lltv);

  return liquidationPrice;
}

/**
 * Calculate the maximum borrowable amount for a position
 *
 * @param collateral - Collateral amount
 * @param oraclePrice - Current oracle price
 * @param lltv - Liquidation LTV
 * @param currentBorrow - Current borrow amount (if any)
 * @returns Maximum additional borrowable amount
 */
export function calculateMaxBorrow(
  collateral: bigint,
  oraclePrice: bigint,
  lltv: bigint,
  currentBorrow: bigint = 0n,
): bigint {
  // maxBorrow = collateral * oraclePrice * LLTV / (ORACLE_PRICE_SCALE * WAD)
  const maxBorrow = (collateral * oraclePrice * lltv) / (ORACLE_PRICE_SCALE * WAD);

  // Subtract current borrow to get additional borrowable amount
  if (maxBorrow <= currentBorrow) {
    return 0n;
  }

  return maxBorrow - currentBorrow;
}

/**
 * Check if a position is liquidatable
 *
 * @param position - Position data
 * @param params - Market parameters
 * @returns True if position can be liquidated
 */
export function isLiquidatable(position: PositionData, params: MarketParams): boolean {
  const healthFactor = calculateHealthFactor(position, params);
  return healthFactor < 1;
}

/**
 * Calculate the Loan-to-Value (LTV) ratio
 *
 * @param position - Position data
 * @param params - Market parameters
 * @returns Current LTV ratio as a number (0-1 range, or higher if underwater)
 */
export function calculateLTV(position: PositionData, params: MarketParams): number {
  if (position.collateral === 0n) {
    return position.borrowShares > 0n ? Infinity : 0;
  }

  const borrowAssets = toBorrowAssets(
    position.borrowShares,
    position.totalBorrowAssets,
    position.totalBorrowShares,
  );

  if (borrowAssets === 0n) {
    return 0;
  }

  // Calculate collateral value in loan token terms
  const collateralValue = (position.collateral * params.oraclePrice) / ORACLE_PRICE_SCALE;

  // LTV = borrowAssets / collateralValue
  const ltvScaled = (borrowAssets * WAD) / collateralValue;

  return Number(ltvScaled) / Number(WAD);
}

/**
 * Calculate liquidation bonus/incentive
 *
 * The liquidation incentive factor (LIF) determines how much bonus liquidators receive.
 *
 * @param lltv - Liquidation LTV
 * @returns Liquidation incentive factor (e.g., 1.05 for 5% bonus)
 */
export function calculateLiquidationIncentive(lltv: bigint): number {
  // LIF = 1 / LLTV (simplified)
  // In practice, Morpho uses a more complex formula with cursor
  const WAD_NUM = Number(WAD);
  const lltvNum = Number(lltv);

  // Max incentive is typically capped at 15%
  const incentive = WAD_NUM / lltvNum;
  const maxIncentive = 1.15;

  return Math.min(incentive, maxIncentive);
}

/**
 * Calculate the amount of collateral that would be seized in a liquidation
 *
 * @param repaidAssets - Amount of debt being repaid
 * @param oraclePrice - Current oracle price
 * @param liquidationIncentiveFactor - The liquidation incentive factor
 * @returns Amount of collateral to be seized
 */
export function calculateSeizedCollateral(
  repaidAssets: bigint,
  oraclePrice: bigint,
  liquidationIncentiveFactor: number,
): bigint {
  // seizedCollateral = repaidAssets * LIF * ORACLE_PRICE_SCALE / oraclePrice
  const lifScaled = BigInt(Math.floor(liquidationIncentiveFactor * Number(WAD)));
  const seized = (repaidAssets * lifScaled * ORACLE_PRICE_SCALE) / (oraclePrice * WAD);

  return seized;
}

/**
 * Format health factor for display
 *
 * @param healthFactor - Health factor as a number
 * @returns Formatted string with status indicator
 */
export function formatHealthFactor(healthFactor: number): string {
  if (!isFinite(healthFactor)) {
    return '∞ (No debt)';
  }

  if (healthFactor < 1) {
    return `${healthFactor.toFixed(4)} ⚠️ LIQUIDATABLE`;
  }

  if (healthFactor < 1.1) {
    return `${healthFactor.toFixed(4)} ⚠️ HIGH RISK`;
  }

  if (healthFactor < 1.25) {
    return `${healthFactor.toFixed(4)} ⚠️ MODERATE RISK`;
  }

  return `${healthFactor.toFixed(4)} ✅ SAFE`;
}

/**
 * Get health status from health factor
 *
 * @param healthFactor - Health factor as a number
 * @returns Status string
 */
export function getHealthStatus(
  healthFactor: number,
): 'LIQUIDATABLE' | 'HIGH_RISK' | 'MODERATE_RISK' | 'SAFE' | 'NO_DEBT' {
  if (!isFinite(healthFactor)) return 'NO_DEBT';
  if (healthFactor < 1) return 'LIQUIDATABLE';
  if (healthFactor < 1.1) return 'HIGH_RISK';
  if (healthFactor < 1.25) return 'MODERATE_RISK';
  return 'SAFE';
}
