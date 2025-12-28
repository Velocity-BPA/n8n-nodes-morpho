/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { calculateHealthFactor } from '../../utils/healthUtils';
import { toBorrowAssets } from '../../utils/sharesUtils';

/**
 * Get liquidatable positions
 */
export async function getLiquidatablePositions(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const healthThreshold = this.getNodeParameter('healthThreshold', index, 1.0) as number;

	return [
		{
			json: {
				network,
				healthThreshold,
				note: 'Finding liquidatable positions requires indexing all positions via subgraph. Use the Subgraph resource with a query filtering for positions where health factor < 1.0.',
				suggestedQuery: `{
  positions(where: { healthFactor_lt: "1000000000000000000" }, first: 100) {
    id
    user { address }
    market { id loanToken collateralToken }
    borrowShares
    collateral
    healthFactor
  }
}`,
			},
		},
	];
}

/**
 * Get liquidation info for a specific position
 */
export async function getLiquidationInfo(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);

	// Get position data
	const position = await morphoClient.getPosition(marketId, userAddress);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	// Calculate current debt
	const borrowAssets = toBorrowAssets(
		position.borrowShares,
		marketState.totalBorrowAssets,
		marketState.totalBorrowShares,
	);

	// Get oracle price
	let oraclePrice = BigInt(0);
	try {
		oraclePrice = await morphoClient.getOraclePrice(marketParams.oracle);
	} catch {
		// Oracle might not be queryable
	}

	// Calculate collateral value
	const collateralValue =
		oraclePrice > 0
			? (position.collateral * oraclePrice) / BigInt(10) ** BigInt(36)
			: BigInt(0);

	// LLTV (Liquidation Loan-to-Value)
	const lltv = marketParams.lltv;
	const maxBorrow = (collateralValue * lltv) / BigInt(10) ** BigInt(18);

	// Health factor
	const healthFactor =
		borrowAssets > 0
			? Number((maxBorrow * BigInt(10) ** BigInt(18)) / borrowAssets) / 1e18
			: Infinity;

	// Is position liquidatable?
	const isLiquidatable = healthFactor < 1.0;

	// Calculate max liquidatable amount (up to close factor, typically 100% in Morpho Blue)
	const maxLiquidatableDebt = isLiquidatable ? borrowAssets : BigInt(0);

	// Liquidation incentive factor (LIF) = 1 / LLTV (simplified)
	// In Morpho Blue, liquidator receives collateral at a discount
	const liquidationIncentive = Number(BigInt(10) ** BigInt(36) / lltv) / 1e18;

	return [
		{
			json: {
				marketId,
				userAddress,
				network,
				borrowShares: position.borrowShares.toString(),
				borrowAssets: borrowAssets.toString(),
				collateral: position.collateral.toString(),
				collateralValue: collateralValue.toString(),
				lltv: (Number(lltv) / 1e18).toString(),
				healthFactor,
				isLiquidatable,
				maxLiquidatableDebt: maxLiquidatableDebt.toString(),
				liquidationIncentive,
				oraclePrice: oraclePrice.toString(),
			},
		},
	];
}

/**
 * Liquidate a position
 */
export async function liquidatePosition(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const borrowerAddress = this.getNodeParameter('borrowerAddress', index) as string;
	const seizedAssets = this.getNodeParameter('seizedAssets', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const config = morphoClient.getConfig();

	if (config.readOnly) {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot liquidate: No private key provided. Configure credentials with a private key to perform liquidations.',
		);
	}

	// Verify position is liquidatable first
	const position = await morphoClient.getPosition(marketId, borrowerAddress);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	const borrowAssets = toBorrowAssets(
		position.borrowShares,
		marketState.totalBorrowAssets,
		marketState.totalBorrowShares,
	);

	let oraclePrice = BigInt(0);
	try {
		oraclePrice = await morphoClient.getOraclePrice(marketParams.oracle);
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot verify liquidation: Unable to get oracle price',
		);
	}

	const collateralValue =
		(position.collateral * oraclePrice) / BigInt(10) ** BigInt(36);
	const maxBorrow =
		(collateralValue * marketParams.lltv) / BigInt(10) ** BigInt(18);
	const healthFactor =
		borrowAssets > 0
			? Number((maxBorrow * BigInt(10) ** BigInt(18)) / borrowAssets) / 1e18
			: Infinity;

	if (healthFactor >= 1.0) {
		throw new NodeOperationError(
			this.getNode(),
			`Position is not liquidatable. Health factor: ${healthFactor.toFixed(4)} (must be < 1.0)`,
		);
	}

	// Execute liquidation
	const tx = await morphoClient.liquidate(
		marketId,
		borrowerAddress,
		BigInt(seizedAssets),
	);

	return [
		{
			json: {
				success: true,
				operation: 'liquidate',
				marketId,
				borrowerAddress,
				seizedAssets,
				transactionHash: tx.hash,
				blockNumber: tx.blockNumber,
				gasUsed: tx.gasUsed?.toString(),
			},
		},
	];
}

/**
 * Get liquidation bonus/incentive for a market
 */
export async function getLiquidationBonus(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);

	// In Morpho Blue, liquidation incentive = 1/LLTV - 1
	// If LLTV = 80%, liquidator gets collateral at 80% of value = 25% bonus
	const lltv = Number(marketParams.lltv) / 1e18;
	const liquidationBonus = 1 / lltv - 1;
	const liquidationIncentiveFactor = 1 / lltv;

	return [
		{
			json: {
				marketId,
				network,
				lltv,
				liquidationBonus,
				liquidationBonusPercent: `${(liquidationBonus * 100).toFixed(2)}%`,
				liquidationIncentiveFactor,
				explanation:
					'Liquidators repay debt and receive collateral at a discount. The bonus is the profit margin.',
			},
		},
	];
}

/**
 * Get liquidation history
 */
export async function getLiquidationHistory(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const limit = this.getNodeParameter('limit', index, 100) as number;

	const marketFilter = marketId
		? `, market: "${marketId}"`
		: '';

	return [
		{
			json: {
				marketId: marketId || 'all',
				network,
				note: 'Liquidation history requires subgraph queries.',
				suggestedQuery: `{
  liquidations(first: ${limit}, orderBy: timestamp, orderDirection: desc${marketFilter}) {
    id
    timestamp
    market { id }
    liquidator { address }
    borrower { address }
    repaidAssets
    seizedAssets
    badDebtShares
  }
}`,
			},
		},
	];
}

/**
 * Get bad debt for a market or protocol
 */
export async function getBadDebt(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	if (marketId) {
		const morphoClient = getMorphoClient(this, network);
		const marketState = await morphoClient.getMarketState(marketId);

		// Bad debt accumulates in the market's fee recipient
		// It's tracked separately in the market state
		return [
			{
				json: {
					marketId,
					network,
					totalBorrowAssets: marketState.totalBorrowAssets.toString(),
					totalBorrowShares: marketState.totalBorrowShares.toString(),
					note: 'Bad debt in Morpho Blue is socialized among suppliers. Check market fee and lastUpdate for indicators.',
					fee: marketState.fee.toString(),
					lastUpdate: marketState.lastUpdate.toString(),
				},
			},
		];
	}

	return [
		{
			json: {
				network,
				note: 'Protocol-wide bad debt requires aggregating from subgraph.',
				suggestedQuery: `{
  markets {
    id
    totalBorrowAssets
    totalSupplyAssets
  }
}`,
			},
		},
	];
}

/**
 * Calculate liquidation amount for a position
 */
export async function calculateLiquidationAmount(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const position = await morphoClient.getPosition(marketId, userAddress);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	const borrowAssets = toBorrowAssets(
		position.borrowShares,
		marketState.totalBorrowAssets,
		marketState.totalBorrowShares,
	);

	let oraclePrice = BigInt(0);
	try {
		oraclePrice = await morphoClient.getOraclePrice(marketParams.oracle);
	} catch {
		// Continue without oracle
	}

	const collateralValue =
		oraclePrice > 0
			? (position.collateral * oraclePrice) / BigInt(10) ** BigInt(36)
			: BigInt(0);

	const maxBorrow =
		(collateralValue * marketParams.lltv) / BigInt(10) ** BigInt(18);
	const healthFactor =
		borrowAssets > 0
			? Number((maxBorrow * BigInt(10) ** BigInt(18)) / borrowAssets) / 1e18
			: Infinity;

	const isLiquidatable = healthFactor < 1.0;

	// In Morpho Blue, you can liquidate up to 100% of the position
	const maxSeizableCollateral = isLiquidatable ? position.collateral : BigInt(0);
	const maxRepayableDebt = isLiquidatable ? borrowAssets : BigInt(0);

	// Calculate collateral received for repaying all debt
	// collateralSeized = debtRepaid / oraclePrice * LIF
	const lif = BigInt(10) ** BigInt(36) / marketParams.lltv; // 1/LLTV in 1e18
	const collateralForFullRepay =
		oraclePrice > 0
			? (borrowAssets * lif) / oraclePrice
			: BigInt(0);

	return [
		{
			json: {
				marketId,
				userAddress,
				network,
				isLiquidatable,
				healthFactor,
				borrowAssets: borrowAssets.toString(),
				collateral: position.collateral.toString(),
				maxRepayableDebt: maxRepayableDebt.toString(),
				maxSeizableCollateral: maxSeizableCollateral.toString(),
				collateralForFullRepay: collateralForFullRepay.toString(),
				liquidationIncentiveFactor: (Number(lif) / 1e18).toString(),
			},
		},
	];
}

/**
 * Simulate a liquidation
 */
export async function simulateLiquidation(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const seizedAssets = this.getNodeParameter('seizedAssets', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const position = await morphoClient.getPosition(marketId, userAddress);
	const marketParams = await morphoClient.getMarketParams(marketId);
	const marketState = await morphoClient.getMarketState(marketId);

	const borrowAssets = toBorrowAssets(
		position.borrowShares,
		marketState.totalBorrowAssets,
		marketState.totalBorrowShares,
	);

	let oraclePrice = BigInt(0);
	try {
		oraclePrice = await morphoClient.getOraclePrice(marketParams.oracle);
	} catch {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot simulate: Unable to get oracle price',
		);
	}

	const collateralValue =
		(position.collateral * oraclePrice) / BigInt(10) ** BigInt(36);
	const maxBorrow =
		(collateralValue * marketParams.lltv) / BigInt(10) ** BigInt(18);
	const healthFactor =
		borrowAssets > 0
			? Number((maxBorrow * BigInt(10) ** BigInt(18)) / borrowAssets) / 1e18
			: Infinity;

	if (healthFactor >= 1.0) {
		return [
			{
				json: {
					success: false,
					reason: 'Position is not liquidatable',
					healthFactor,
					marketId,
					userAddress,
				},
			},
		];
	}

	// Calculate what happens if we seize the specified collateral
	const seizedCollateral = BigInt(seizedAssets);
	const seizedValue = (seizedCollateral * oraclePrice) / BigInt(10) ** BigInt(36);
	const lif = BigInt(10) ** BigInt(36) / marketParams.lltv;
	const debtRepaid = (seizedValue * marketParams.lltv) / BigInt(10) ** BigInt(18);
	const profit = seizedValue - debtRepaid;

	const newCollateral = position.collateral - seizedCollateral;
	const newBorrowAssets = borrowAssets - debtRepaid;

	const newCollateralValue =
		(newCollateral * oraclePrice) / BigInt(10) ** BigInt(36);
	const newMaxBorrow =
		(newCollateralValue * marketParams.lltv) / BigInt(10) ** BigInt(18);
	const newHealthFactor =
		newBorrowAssets > 0
			? Number((newMaxBorrow * BigInt(10) ** BigInt(18)) / newBorrowAssets) / 1e18
			: Infinity;

	return [
		{
			json: {
				success: true,
				simulation: true,
				marketId,
				userAddress,
				seizedCollateral: seizedCollateral.toString(),
				seizedValue: seizedValue.toString(),
				debtRepaid: debtRepaid.toString(),
				profit: profit.toString(),
				before: {
					collateral: position.collateral.toString(),
					borrowAssets: borrowAssets.toString(),
					healthFactor,
				},
				after: {
					collateral: newCollateral.toString(),
					borrowAssets: newBorrowAssets.toString(),
					healthFactor: newHealthFactor,
				},
			},
		},
	];
}

/**
 * Get liquidation parameters for a market
 */
export async function getLiquidationParameters(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const marketParams = await morphoClient.getMarketParams(marketId);

	const lltv = Number(marketParams.lltv) / 1e18;
	const liquidationIncentiveFactor = 1 / lltv;
	const liquidationBonus = liquidationIncentiveFactor - 1;

	return [
		{
			json: {
				marketId,
				network,
				lltv,
				lltvPercent: `${(lltv * 100).toFixed(2)}%`,
				liquidationIncentiveFactor,
				liquidationBonus,
				liquidationBonusPercent: `${(liquidationBonus * 100).toFixed(2)}%`,
				closeFactor: 1.0, // Morpho Blue allows 100% liquidation
				oracle: marketParams.oracle,
				irm: marketParams.irm,
				loanToken: marketParams.loanToken,
				collateralToken: marketParams.collateralToken,
				description: {
					lltv: 'Liquidation Loan-to-Value - Position becomes liquidatable when LTV exceeds LLTV',
					liquidationIncentiveFactor: 'Collateral received per unit of debt repaid (1/LLTV)',
					liquidationBonus: 'Profit margin for liquidators (LIF - 1)',
					closeFactor: 'Maximum portion of debt that can be liquidated (100% in Morpho Blue)',
				},
			},
		},
	];
}

/**
 * Route liquidation operations
 */
export async function executeLiquidationOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getLiquidatablePositions':
			return getLiquidatablePositions.call(this, index);
		case 'getLiquidationInfo':
			return getLiquidationInfo.call(this, index);
		case 'liquidatePosition':
			return liquidatePosition.call(this, index);
		case 'getLiquidationBonus':
			return getLiquidationBonus.call(this, index);
		case 'getLiquidationHistory':
			return getLiquidationHistory.call(this, index);
		case 'getBadDebt':
			return getBadDebt.call(this, index);
		case 'calculateLiquidationAmount':
			return calculateLiquidationAmount.call(this, index);
		case 'simulateLiquidation':
			return simulateLiquidation.call(this, index);
		case 'getLiquidationParameters':
			return getLiquidationParameters.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown liquidation operation: ${operation}`,
			);
	}
}
