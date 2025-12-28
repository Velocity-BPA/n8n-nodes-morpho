/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Interest Rate Utilities
 *
 * Morpho Blue uses an Adaptive Curve Interest Rate Model (IRM).
 * The IRM adjusts rates based on utilization to optimize liquidity.
 *
 * Key concepts:
 * - Utilization: Ratio of borrowed assets to total supply
 * - Target Utilization: The optimal utilization rate (typically 90%)
 * - Rate at Target: The interest rate when at target utilization
 * - Curve Steepness: How quickly rates change with utilization
 */

import { SECONDS_PER_YEAR, WAD } from '../constants/contracts';

/**
 * Calculate utilization rate
 *
 * Utilization = totalBorrowAssets / totalSupplyAssets
 *
 * @param totalBorrowAssets - Total assets borrowed
 * @param totalSupplyAssets - Total assets supplied
 * @returns Utilization rate as a number (0-1)
 */
export function calculateUtilization(
  totalBorrowAssets: bigint,
  totalSupplyAssets: bigint,
): number {
  if (totalSupplyAssets === 0n) {
    return 0;
  }

  const utilizationScaled = (totalBorrowAssets * WAD) / totalSupplyAssets;
  return Number(utilizationScaled) / Number(WAD);
}

/**
 * Calculate utilization as a percentage
 *
 * @param totalBorrowAssets - Total assets borrowed
 * @param totalSupplyAssets - Total assets supplied
 * @returns Utilization as a percentage (0-100)
 */
export function calculateUtilizationPercent(
  totalBorrowAssets: bigint,
  totalSupplyAssets: bigint,
): number {
  return calculateUtilization(totalBorrowAssets, totalSupplyAssets) * 100;
}

/**
 * Convert per-second borrow rate to APY
 *
 * APY = (1 + ratePerSecond)^secondsPerYear - 1
 *
 * @param borrowRatePerSecond - Borrow rate per second (scaled by 1e18)
 * @returns APY as a percentage
 */
export function borrowRateToAPY(borrowRatePerSecond: bigint): number {
  const ratePerSecond = Number(borrowRatePerSecond) / Number(WAD);
  const secondsPerYear = Number(SECONDS_PER_YEAR);

  // Compound interest formula
  const apy = Math.pow(1 + ratePerSecond, secondsPerYear) - 1;

  return apy * 100; // Convert to percentage
}

/**
 * Convert per-second borrow rate to APR (simple interest)
 *
 * APR = ratePerSecond * secondsPerYear
 *
 * @param borrowRatePerSecond - Borrow rate per second (scaled by 1e18)
 * @returns APR as a percentage
 */
export function borrowRateToAPR(borrowRatePerSecond: bigint): number {
  const ratePerSecond = Number(borrowRatePerSecond) / Number(WAD);
  const secondsPerYear = Number(SECONDS_PER_YEAR);

  const apr = ratePerSecond * secondsPerYear;

  return apr * 100; // Convert to percentage
}

/**
 * Calculate supply APY from borrow rate and utilization
 *
 * Supply APY = Borrow APY * Utilization * (1 - fee)
 *
 * @param borrowRatePerSecond - Borrow rate per second
 * @param utilization - Utilization rate (0-1)
 * @param fee - Protocol fee (0-1, typically 0)
 * @returns Supply APY as a percentage
 */
export function calculateSupplyAPY(
  borrowRatePerSecond: bigint,
  utilization: number,
  fee: number = 0,
): number {
  const borrowAPY = borrowRateToAPY(borrowRatePerSecond);
  return borrowAPY * utilization * (1 - fee);
}

/**
 * Calculate supply APR from borrow rate and utilization
 *
 * @param borrowRatePerSecond - Borrow rate per second
 * @param utilization - Utilization rate (0-1)
 * @param fee - Protocol fee (0-1)
 * @returns Supply APR as a percentage
 */
export function calculateSupplyAPR(
  borrowRatePerSecond: bigint,
  utilization: number,
  fee: number = 0,
): number {
  const borrowAPR = borrowRateToAPR(borrowRatePerSecond);
  return borrowAPR * utilization * (1 - fee);
}

/**
 * Adaptive Curve IRM parameters
 */
export interface IRMParams {
  curveStepness: bigint; // Steepness of the interest rate curve
  adjustmentSpeed: bigint; // How fast the rate at target adjusts
  targetUtilization: bigint; // Target utilization rate (scaled by 1e18)
  initialRateAtTarget: bigint; // Initial rate at target utilization
  minRateAtTarget: bigint; // Minimum rate at target
  maxRateAtTarget: bigint; // Maximum rate at target
}

/**
 * Default Adaptive Curve IRM parameters (from Morpho)
 */
export const DEFAULT_IRM_PARAMS: IRMParams = {
  curveStepness: 4n * WAD, // 4x
  adjustmentSpeed: (50n * WAD) / SECONDS_PER_YEAR, // 50% per year
  targetUtilization: (90n * WAD) / 100n, // 90%
  initialRateAtTarget: (4n * WAD) / 100n / SECONDS_PER_YEAR, // 4% APR
  minRateAtTarget: (1n * WAD) / 1000n / SECONDS_PER_YEAR, // 0.1% APR
  maxRateAtTarget: (200n * WAD) / 100n / SECONDS_PER_YEAR, // 200% APR
};

/**
 * Calculate borrow rate based on utilization (simplified model)
 *
 * This is a simplified version of the Adaptive Curve IRM.
 * The actual IRM adapts the rate at target over time.
 *
 * @param utilization - Current utilization (0-1)
 * @param rateAtTarget - Current rate at target utilization
 * @param targetUtilization - Target utilization rate (0-1)
 * @param curveSteepness - Steepness of the curve
 * @returns Borrow rate per second (scaled by 1e18)
 */
export function calculateBorrowRate(
  utilization: number,
  rateAtTarget: number,
  targetUtilization: number = 0.9,
  curveSteepness: number = 4,
): number {
  // Below target: linear increase
  // Above target: exponential increase

  if (utilization <= targetUtilization) {
    // Linear portion below target
    return rateAtTarget * (utilization / targetUtilization);
  } else {
    // Exponential portion above target
    const excess = (utilization - targetUtilization) / (1 - targetUtilization);
    const multiplier = Math.pow(curveSteepness, excess);
    return rateAtTarget * multiplier;
  }
}

/**
 * Estimate future interest accrued
 *
 * @param principal - Principal amount
 * @param borrowRatePerSecond - Borrow rate per second
 * @param durationSeconds - Duration in seconds
 * @returns Interest amount
 */
export function estimateInterest(
  principal: bigint,
  borrowRatePerSecond: bigint,
  durationSeconds: bigint,
): bigint {
  // Simple interest: principal * rate * time
  return (principal * borrowRatePerSecond * durationSeconds) / WAD;
}

/**
 * Format APY/APR for display
 *
 * @param rate - Rate as a percentage
 * @param decimals - Number of decimal places
 * @returns Formatted string
 */
export function formatRate(rate: number, decimals: number = 2): string {
  if (!isFinite(rate)) {
    return 'N/A';
  }

  return `${rate.toFixed(decimals)}%`;
}

/**
 * Calculate effective yield considering compound frequency
 *
 * @param apr - Annual Percentage Rate
 * @param compoundsPerYear - Number of compounding periods per year
 * @returns Effective APY
 */
export function aprToApy(apr: number, compoundsPerYear: number = 365 * 24 * 60 * 60): number {
  return (Math.pow(1 + apr / 100 / compoundsPerYear, compoundsPerYear) - 1) * 100;
}

/**
 * Calculate APR from APY
 *
 * @param apy - Annual Percentage Yield
 * @param compoundsPerYear - Number of compounding periods per year
 * @returns APR
 */
export function apyToApr(apy: number, compoundsPerYear: number = 365 * 24 * 60 * 60): number {
  return (Math.pow(1 + apy / 100, 1 / compoundsPerYear) - 1) * compoundsPerYear * 100;
}
