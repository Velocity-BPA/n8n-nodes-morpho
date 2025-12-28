/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { calculateSupplyAPY, calculateBorrowAPY, calculateUtilization } from '../../utils/rateUtils';

/**
 * Get supply rate for a market
 */
export async function getSupplyRate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketState = await morphoClient.getMarketState(marketId);
	const marketParams = await morphoClient.getMarketParams(marketId);

	// Get borrow rate from IRM
	let borrowRatePerSecond = BigInt(0);
	try {
		borrowRatePerSecond = await morphoClient.getBorrowRate(marketParams.irm, marketId);
	} catch {
		// IRM might not be queryable
	}

	const utilization = calculateUtilization(
		marketState.totalBorrowAssets,
		marketState.totalSupplyAssets,
	);

	// Supply rate = borrow rate * utilization * (1 - fee)
	const fee = Number(marketState.fee) / 1e18;
	const borrowAPY = calculateBorrowAPY(borrowRatePerSecond);
	const supplyAPY = calculateSupplyAPY(borrowAPY, utilization, fee);

	// Rate per second
	const supplyRatePerSecond =
		borrowRatePerSecond > 0
			? (borrowRatePerSecond * BigInt(Math.floor(utilization * 1e18))) /
			  BigInt(1e18) *
			  BigInt(Math.floor((1 - fee) * 1e18)) /
			  BigInt(1e18)
			: BigInt(0);

	return [
		{
			json: {
				marketId,
				network,
				supplyRatePerSecond: supplyRatePerSecond.toString(),
				supplyAPY,
				supplyAPYPercent: `${(supplyAPY * 100).toFixed(2)}%`,
				utilization,
				utilizationPercent: `${(utilization * 100).toFixed(2)}%`,
				fee,
				feePercent: `${(fee * 100).toFixed(2)}%`,
			},
		},
	];
}

/**
 * Get borrow rate for a market
 */
export async function getBorrowRate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketState = await morphoClient.getMarketState(marketId);
	const marketParams = await morphoClient.getMarketParams(marketId);

	let borrowRatePerSecond = BigInt(0);
	try {
		borrowRatePerSecond = await morphoClient.getBorrowRate(marketParams.irm, marketId);
	} catch {
		// IRM might not be queryable
	}

	const borrowAPY = calculateBorrowAPY(borrowRatePerSecond);

	const utilization = calculateUtilization(
		marketState.totalBorrowAssets,
		marketState.totalSupplyAssets,
	);

	return [
		{
			json: {
				marketId,
				network,
				borrowRatePerSecond: borrowRatePerSecond.toString(),
				borrowAPY,
				borrowAPYPercent: `${(borrowAPY * 100).toFixed(2)}%`,
				utilization,
				utilizationPercent: `${(utilization * 100).toFixed(2)}%`,
				irm: marketParams.irm,
			},
		},
	];
}

/**
 * Get utilization rate for a market
 */
export async function getUtilizationRate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketState = await morphoClient.getMarketState(marketId);

	const utilization = calculateUtilization(
		marketState.totalBorrowAssets,
		marketState.totalSupplyAssets,
	);

	return [
		{
			json: {
				marketId,
				network,
				utilization,
				utilizationPercent: `${(utilization * 100).toFixed(2)}%`,
				totalSupplyAssets: marketState.totalSupplyAssets.toString(),
				totalBorrowAssets: marketState.totalBorrowAssets.toString(),
				availableLiquidity: (
					marketState.totalSupplyAssets - marketState.totalBorrowAssets
				).toString(),
			},
		},
	];
}

/**
 * Get rate at a specific utilization level
 */
export async function getRateAtUtilization(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const utilizationRate = this.getNodeParameter('utilizationRate', index) as number;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	// Note: This would require calling the IRM with simulated market state
	// For now, we provide an approximation based on typical IRM curves
	return [
		{
			json: {
				marketId,
				network,
				targetUtilization: utilizationRate,
				targetUtilizationPercent: `${(utilizationRate * 100).toFixed(2)}%`,
				irm: marketParams.irm,
				note: 'Calculating rate at specific utilization requires calling IRM with simulated state. Use the IRM contract directly for precise calculations.',
				currentUtilization: calculateUtilization(
					marketState.totalBorrowAssets,
					marketState.totalSupplyAssets,
				),
			},
		},
	];
}

/**
 * Get IRM (Interest Rate Model) info
 */
export async function getIRM(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	let currentBorrowRate = BigInt(0);
	try {
		currentBorrowRate = await morphoClient.getBorrowRate(marketParams.irm, marketId);
	} catch {
		// IRM might not be queryable
	}

	return [
		{
			json: {
				marketId,
				network,
				irmAddress: marketParams.irm,
				currentBorrowRatePerSecond: currentBorrowRate.toString(),
				currentBorrowAPY: calculateBorrowAPY(currentBorrowRate),
				currentUtilization: calculateUtilization(
					marketState.totalBorrowAssets,
					marketState.totalSupplyAssets,
				),
				description:
					'Morpho Blue uses Adaptive Curve IRMs that adjust rates based on utilization and target rate.',
			},
		},
	];
}

/**
 * Get rate parameters (IRM configuration)
 */
export async function getRateParameters(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);

	return [
		{
			json: {
				marketId,
				network,
				irmAddress: marketParams.irm,
				note: 'IRM parameters are encoded in the IRM contract. Common parameters include target utilization, curve steepness, and base rate. Query the IRM contract directly for specific parameters.',
				typicalParameters: {
					targetUtilization: '90% - The utilization rate the IRM optimizes towards',
					curveSteepness:
						'How quickly rates increase beyond target utilization',
					baseRate: 'Minimum borrow rate at 0% utilization',
					maxRate: 'Maximum borrow rate at 100% utilization',
				},
			},
		},
	];
}

/**
 * Get rate history
 */
export async function getRateHistory(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const timeRange = this.getNodeParameter('timeRange', index, '24h') as string;

	return [
		{
			json: {
				marketId,
				network,
				timeRange,
				note: 'Historical rate data requires indexing. Use the Subgraph resource to query rate history.',
				suggestedQuery: `{
  marketHourData(where: { market: "${marketId}" }, first: 168, orderBy: timestamp, orderDirection: desc) {
    timestamp
    totalSupplyAssets
    totalBorrowAssets
    borrowRate
    supplyRate
  }
}`,
			},
		},
	];
}

/**
 * Calculate rate from parameters
 */
export async function calculateRate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const utilizationRate = this.getNodeParameter('utilizationRate', index) as number;
	const ratePerSecond = this.getNodeParameter('ratePerSecond', index, '') as string;

	// If rate per second is provided, calculate APY
	if (ratePerSecond) {
		const rate = BigInt(ratePerSecond);
		const apy = calculateBorrowAPY(rate);

		return [
			{
				json: {
					ratePerSecond,
					apy,
					apyPercent: `${(apy * 100).toFixed(2)}%`,
					calculation: 'APY = (1 + ratePerSecond)^31536000 - 1',
				},
			},
		];
	}

	// Otherwise, provide utilization-based estimates
	// Using typical Morpho IRM curve
	const targetUtilization = 0.9;
	let estimatedAPY: number;

	if (utilizationRate <= targetUtilization) {
		// Below target: linear increase from ~2% to ~4%
		estimatedAPY = 0.02 + (utilizationRate / targetUtilization) * 0.02;
	} else {
		// Above target: exponential increase
		const excessUtilization = (utilizationRate - targetUtilization) / (1 - targetUtilization);
		estimatedAPY = 0.04 + excessUtilization * excessUtilization * 0.96;
	}

	return [
		{
			json: {
				utilizationRate,
				utilizationPercent: `${(utilizationRate * 100).toFixed(2)}%`,
				estimatedBorrowAPY: estimatedAPY,
				estimatedBorrowAPYPercent: `${(estimatedAPY * 100).toFixed(2)}%`,
				note: 'This is an estimate based on typical Morpho IRM curves. Actual rates depend on the specific IRM implementation.',
				targetUtilization,
			},
		},
	];
}

/**
 * Get optimal utilization for a market
 */
export async function getOptimalUtilization(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	const currentUtilization = calculateUtilization(
		marketState.totalBorrowAssets,
		marketState.totalSupplyAssets,
	);

	// Most Morpho IRMs target ~90% utilization
	const targetUtilization = 0.9;

	return [
		{
			json: {
				marketId,
				network,
				irmAddress: marketParams.irm,
				targetUtilization,
				targetUtilizationPercent: '90%',
				currentUtilization,
				currentUtilizationPercent: `${(currentUtilization * 100).toFixed(2)}%`,
				utilizationGap: targetUtilization - currentUtilization,
				status:
					currentUtilization < targetUtilization
						? 'Below optimal - room for more borrowing'
						: currentUtilization > targetUtilization
						? 'Above optimal - higher rates to attract supply'
						: 'At optimal utilization',
				note: 'Most Morpho Adaptive Curve IRMs target 90% utilization. The actual target depends on the specific IRM implementation.',
			},
		},
	];
}

/**
 * Route interest rate operations
 */
export async function executeInterestRateOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getSupplyRate':
			return getSupplyRate.call(this, index);
		case 'getBorrowRate':
			return getBorrowRate.call(this, index);
		case 'getUtilizationRate':
			return getUtilizationRate.call(this, index);
		case 'getRateAtUtilization':
			return getRateAtUtilization.call(this, index);
		case 'getIRM':
			return getIRM.call(this, index);
		case 'getRateParameters':
			return getRateParameters.call(this, index);
		case 'getRateHistory':
			return getRateHistory.call(this, index);
		case 'calculateRate':
			return calculateRate.call(this, index);
		case 'getOptimalUtilization':
			return getOptimalUtilization.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown interest rate operation: ${operation}`,
			);
	}
}
