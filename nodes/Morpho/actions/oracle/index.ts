/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { ORACLES } from '../../constants';

/**
 * Get oracle price for an oracle address
 */
export async function getOraclePrice(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index, '') as string;
	const marketId = this.getNodeParameter('marketId', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);

	let oracle = oracleAddress;

	// If market ID provided, get oracle from market params
	if (!oracle && marketId) {
		const marketParams = await morphoClient.getMarketParams(marketId);
		oracle = marketParams.oracle;
	}

	if (!oracle) {
		throw new NodeOperationError(
			this.getNode(),
			'Either oracleAddress or marketId must be provided',
		);
	}

	const price = await morphoClient.getOraclePrice(oracle);

	// Price is in 1e36 scale (collateral price / loan price)
	const priceFormatted = Number(price) / 1e36;

	return [
		{
			json: {
				oracleAddress: oracle,
				network,
				price: price.toString(),
				priceFormatted,
				scale: '1e36',
				marketId: marketId || undefined,
				description:
					'Oracle price represents collateralToken/loanToken in 1e36 scale. Divide by 1e36 to get the human-readable ratio.',
			},
		},
	];
}

/**
 * Get oracle info
 */
export async function getOracleInfo(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	// Check known oracles
	const knownOracles = ORACLES[network] || [];
	const knownOracle = knownOracles.find(
		(o: any) => o.address.toLowerCase() === oracleAddress.toLowerCase(),
	);

	const morphoClient = getMorphoClient(this, network);

	let price = BigInt(0);
	try {
		price = await morphoClient.getOraclePrice(oracleAddress);
	} catch {
		// Oracle might not be callable
	}

	return [
		{
			json: {
				oracleAddress,
				network,
				known: !!knownOracle,
				name: knownOracle?.name || 'Unknown Oracle',
				type: knownOracle?.type || 'Unknown',
				baseToken: knownOracle?.baseToken,
				quoteToken: knownOracle?.quoteToken,
				currentPrice: price.toString(),
				currentPriceFormatted: Number(price) / 1e36,
				note: 'Oracle types include Chainlink, Morpho Oracle, and custom implementations.',
			},
		},
	];
}

/**
 * Get price feed details
 */
export async function getPriceFeed(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);

	// Try to get price
	let price = BigInt(0);
	try {
		price = await morphoClient.getOraclePrice(oracleAddress);
	} catch {
		// Continue
	}

	// Check known oracles for feed details
	const knownOracles = ORACLES[network] || [];
	const knownOracle = knownOracles.find(
		(o: any) => o.address.toLowerCase() === oracleAddress.toLowerCase(),
	);

	return [
		{
			json: {
				oracleAddress,
				network,
				price: price.toString(),
				priceFormatted: Number(price) / 1e36,
				feedType: knownOracle?.type || 'Unknown',
				baseFeed: knownOracle?.baseFeed,
				quoteFeed: knownOracle?.quoteFeed,
				note: 'Morpho oracles typically combine multiple Chainlink feeds or use custom implementations.',
			},
		},
	];
}

/**
 * Get historical prices (requires subgraph)
 */
export async function getHistoricalPrices(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const timeRange = this.getNodeParameter('timeRange', index, '24h') as string;

	return [
		{
			json: {
				oracleAddress,
				network,
				timeRange,
				note: 'Historical oracle prices require off-chain indexing. Use the Subgraph resource or external price APIs like Chainlink to get historical data.',
				alternatives: [
					'Query Chainlink subgraph for underlying feed history',
					'Use DeFi Llama API for historical token prices',
					'Query market events from Morpho subgraph to infer price at transaction time',
				],
			},
		},
	];
}

/**
 * Get oracle for a specific market
 */
export async function getOracleByMarket(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);

	let price = BigInt(0);
	try {
		price = await morphoClient.getOraclePrice(marketParams.oracle);
	} catch {
		// Oracle might not be callable
	}

	// Check known oracles
	const knownOracles = ORACLES[network] || [];
	const knownOracle = knownOracles.find(
		(o: any) => o.address.toLowerCase() === marketParams.oracle.toLowerCase(),
	);

	return [
		{
			json: {
				marketId,
				network,
				oracleAddress: marketParams.oracle,
				oracleName: knownOracle?.name || 'Unknown',
				oracleType: knownOracle?.type || 'Unknown',
				loanToken: marketParams.loanToken,
				collateralToken: marketParams.collateralToken,
				currentPrice: price.toString(),
				currentPriceFormatted: Number(price) / 1e36,
			},
		},
	];
}

/**
 * Validate oracle is functioning
 */
export async function validateOracle(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);

	const checks: any = {
		oracleAddress,
		network,
		callable: false,
		pricePositive: false,
		priceReasonable: false,
		valid: false,
	};

	try {
		const price = await morphoClient.getOraclePrice(oracleAddress);
		checks.callable = true;
		checks.price = price.toString();
		checks.priceFormatted = Number(price) / 1e36;
		checks.pricePositive = price > 0;

		// Check if price is in reasonable range (not zero, not astronomically high)
		// Price should typically be between 1e-18 and 1e18 in 1e36 scale
		const priceNum = Number(price);
		checks.priceReasonable = priceNum > 1e18 && priceNum < 1e54;

		checks.valid = checks.callable && checks.pricePositive && checks.priceReasonable;
	} catch (error: any) {
		checks.error = error.message || 'Failed to call oracle';
	}

	return [
		{
			json: checks,
		},
	];
}

/**
 * Get price confidence (placeholder - actual implementation depends on oracle type)
 */
export async function getPriceConfidence(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				oracleAddress,
				network,
				note: 'Price confidence metrics depend on the oracle implementation. Chainlink oracles provide deviation thresholds and heartbeat intervals. For Morpho oracles, check the underlying feeds.',
				suggestedChecks: [
					'Query underlying Chainlink aggregator for deviation threshold',
					'Check heartbeat interval for staleness',
					'Compare with alternative price sources',
					'Monitor for significant price deviations',
				],
			},
		},
	];
}

/**
 * Get TWAP price (Time-Weighted Average Price)
 */
export async function getTWAP(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const oracleAddress = this.getNodeParameter('oracleAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const period = this.getNodeParameter('twapPeriod', index, '1h') as string;

	return [
		{
			json: {
				oracleAddress,
				network,
				period,
				note: 'TWAP calculation requires historical price data. Morpho Blue oracles return spot prices. For TWAP, use Uniswap V3 TWAP oracles or calculate from historical data.',
				alternatives: [
					'Use Uniswap V3 TWAP oracle for on-chain TWAP',
					'Calculate from indexed historical prices',
					'Use TWAP oracle wrappers if available',
				],
			},
		},
	];
}

/**
 * Route oracle operations
 */
export async function executeOracleOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getOraclePrice':
			return getOraclePrice.call(this, index);
		case 'getOracleInfo':
			return getOracleInfo.call(this, index);
		case 'getPriceFeed':
			return getPriceFeed.call(this, index);
		case 'getHistoricalPrices':
			return getHistoricalPrices.call(this, index);
		case 'getOracleByMarket':
			return getOracleByMarket.call(this, index);
		case 'validateOracle':
			return validateOracle.call(this, index);
		case 'getPriceConfidence':
			return getPriceConfidence.call(this, index);
		case 'getTWAP':
			return getTWAP.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown oracle operation: ${operation}`,
			);
	}
}
