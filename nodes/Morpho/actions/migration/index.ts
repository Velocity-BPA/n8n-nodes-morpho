/**
 * @file Migration Actions for Morpho DeFi Protocol
 * @description Operations for migrating positions from other lending protocols
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { getBundlerClient } from '../../transport/bundlerClient';
import { CURATED_MARKETS } from '../../constants/markets';

/**
 * Migration Actions
 * Facilitate position migrations from Aave, Compound, and other protocols to Morpho
 *
 * Note: Full migration typically requires:
 * 1. Flash loan to pay off existing debt
 * 2. Withdraw collateral from source protocol
 * 3. Supply collateral to Morpho
 * 4. Borrow on Morpho
 * 5. Repay flash loan
 *
 * This is typically done via the Morpho Bundler for atomicity.
 */

export async function checkMigrationEligibility(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex) as string;
	const sourceProtocol = executeFunctions.getNodeParameter('sourceProtocol', itemIndex) as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Check what positions the user has that could be migrated
	const eligibleMarkets: any[] = [];

	// For each Morpho market, check if migration is possible
	for (const market of CURATED_MARKETS) {
		try {
			const params = await morpho.morphoContract.idToMarketParams(market.id);
			const state = await morpho.morphoContract.market(market.id);

			// Check if there's liquidity available
			const availableLiquidity = state.totalSupplyAssets - state.totalBorrowAssets;

			if (availableLiquidity > 0n) {
				eligibleMarkets.push({
					marketId: market.id,
					name: market.name,
					loanToken: params.loanToken,
					collateralToken: params.collateralToken,
					lltv: Number(params.lltv) / 1e16,
					availableLiquidity: availableLiquidity.toString(),
				});
			}
		} catch {
			// Skip failed markets
		}
	}

	return [{
		json: {
			userAddress,
			sourceProtocol,
			eligible: eligibleMarkets.length > 0,
			eligibleMarkets,
			migrationRequirements: [
				'Sufficient liquidity in target Morpho market',
				'Collateral token supported by Morpho market',
				'User has approved bundler contract (if using bundler)',
				'Flash loan available for debt repayment',
			],
			steps: [
				'1. Flash loan to pay off existing debt',
				'2. Withdraw collateral from ' + sourceProtocol,
				'3. Supply collateral to Morpho',
				'4. Borrow on Morpho to repay flash loan',
			],
			note: 'Full migration is typically executed via the Morpho Bundler for atomicity',
		},
	}];
}

export async function migrateFromAave(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const collateralAmount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const borrowAmount = executeFunctions.getNodeParameter('borrowAmount', itemIndex, '0') as string;

	const morpho = await getMorphoClient(executeFunctions);

	if (morpho.config.readOnly) {
		throw new Error('Migration operation requires a private key. Currently in read-only mode.');
	}

	// Migration from Aave requires bundled operations
	// This is a simplified version - full implementation would use the Bundler

	const params = await morpho.morphoContract.idToMarketParams(marketId);

	return [{
		json: {
			operation: 'migrateFromAave',
			status: 'PREPARATION',
			marketId,
			targetMarket: {
				loanToken: params.loanToken,
				collateralToken: params.collateralToken,
				lltv: Number(params.lltv) / 1e16,
			},
			migrationDetails: {
				collateralAmount,
				borrowAmount: borrowAmount || 'To be calculated',
			},
			instructions: [
				'Migration from Aave requires the following steps:',
				'1. Approve Morpho Bundler to act on your behalf',
				'2. Use bundler to execute atomic migration:',
				'   - Flash loan WETH/USDC to repay Aave debt',
				'   - Withdraw collateral from Aave',
				'   - Supply collateral to Morpho',
				'   - Borrow on Morpho to repay flash loan',
				'3. Verify new position on Morpho',
			],
			warning: 'This is a complex operation. Consider using the Morpho Migration UI for safety.',
			resources: {
				morphoMigration: 'https://app.morpho.org/migrate',
				documentation: 'https://docs.morpho.org/migration',
			},
		},
	}];
}

export async function migrateFromCompound(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const collateralAmount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const borrowAmount = executeFunctions.getNodeParameter('borrowAmount', itemIndex, '0') as string;

	const morpho = await getMorphoClient(executeFunctions);

	if (morpho.config.readOnly) {
		throw new Error('Migration operation requires a private key. Currently in read-only mode.');
	}

	const params = await morpho.morphoContract.idToMarketParams(marketId);

	return [{
		json: {
			operation: 'migrateFromCompound',
			status: 'PREPARATION',
			marketId,
			targetMarket: {
				loanToken: params.loanToken,
				collateralToken: params.collateralToken,
				lltv: Number(params.lltv) / 1e16,
			},
			migrationDetails: {
				collateralAmount,
				borrowAmount: borrowAmount || 'To be calculated',
			},
			instructions: [
				'Migration from Compound requires the following steps:',
				'1. Approve Morpho Bundler to act on your behalf',
				'2. Use bundler to execute atomic migration:',
				'   - Flash loan to repay Compound debt',
				'   - Redeem cTokens from Compound',
				'   - Supply collateral to Morpho',
				'   - Borrow on Morpho to repay flash loan',
				'3. Verify new position on Morpho',
			],
			warning: 'This is a complex operation. Consider using the Morpho Migration UI for safety.',
			resources: {
				morphoMigration: 'https://app.morpho.org/migrate',
				documentation: 'https://docs.morpho.org/migration',
			},
		},
	}];
}

export async function getMigrationQuote(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const sourceProtocol = executeFunctions.getNodeParameter('sourceProtocol', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const collateralAmount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const borrowAmount = executeFunctions.getNodeParameter('borrowAmount', itemIndex, '0') as string;

	const morpho = await getMorphoClient(executeFunctions);

	const params = await morpho.morphoContract.idToMarketParams(marketId);
	const state = await morpho.morphoContract.market(marketId);

	// Calculate estimated gas
	const estimatedGasUnits = 800000n; // Typical migration gas
	const gasPrice = await morpho.provider.getFeeData();
	const estimatedGasCost = gasPrice.gasPrice
		? estimatedGasUnits * gasPrice.gasPrice
		: 0n;

	// Calculate flash loan fee (typically 0.05% - 0.09%)
	const flashLoanFeePercent = 0.05;
	const borrowAmountBigInt = BigInt(borrowAmount || 0);
	const flashLoanFee = borrowAmountBigInt > 0n
		? (borrowAmountBigInt * BigInt(Math.floor(flashLoanFeePercent * 100))) / 10000n
		: 0n;

	// Get current borrow rate on Morpho
	let borrowRate = 0n;
	try {
		const irmContract = new morpho.provider.Contract(
			params.irm,
			['function borrowRateView(bytes32,tuple(uint128,uint128,uint128,uint128,uint128)) view returns (uint256)'],
			morpho.provider
		);
		borrowRate = await irmContract.borrowRateView(marketId, [
			state.totalSupplyAssets,
			state.totalSupplyShares,
			state.totalBorrowAssets,
			state.totalBorrowShares,
			state.lastUpdate,
		]);
	} catch {
		// IRM query failed
	}

	const secondsPerYear = 365.25 * 24 * 60 * 60;
	const morphoBorrowAPY = borrowRate > 0n
		? (Math.exp(Number(borrowRate) / 1e18 * secondsPerYear) - 1) * 100
		: 0;

	return [{
		json: {
			sourceProtocol,
			targetMarketId: marketId,
			quote: {
				collateralAmount,
				borrowAmount: borrowAmount || '0',
				flashLoanFee: flashLoanFee.toString(),
				flashLoanFeePercent: flashLoanFeePercent + '%',
				estimatedGasCost: estimatedGasCost.toString(),
				estimatedGasUnits: estimatedGasUnits.toString(),
			},
			targetMarket: {
				lltv: Number(params.lltv) / 1e16,
				borrowAPY: morphoBorrowAPY.toFixed(4) + '%',
			},
			savings: {
				note: 'Estimated savings depend on source protocol rates',
				suggestion: 'Compare APY on source protocol vs Morpho to estimate savings',
			},
		},
	}];
}

export async function getMigrationStatus(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const transactionHash = executeFunctions.getNodeParameter('transactionHash', itemIndex, '') as string;
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;

	const morpho = await getMorphoClient(executeFunctions);

	// If transaction hash provided, check its status
	let txStatus: any = null;
	if (transactionHash) {
		try {
			const receipt = await morpho.provider.getTransactionReceipt(transactionHash);
			txStatus = {
				hash: transactionHash,
				status: receipt ? (receipt.status === 1 ? 'SUCCESS' : 'FAILED') : 'PENDING',
				blockNumber: receipt?.blockNumber,
				gasUsed: receipt?.gasUsed?.toString(),
			};
		} catch {
			txStatus = {
				hash: transactionHash,
				status: 'UNKNOWN',
				error: 'Could not fetch transaction receipt',
			};
		}
	}

	// Check current position on Morpho
	const position = await morpho.morphoContract.position(marketId, userAddress);

	const hasPosition = position.supplyShares > 0n ||
		position.borrowShares > 0n ||
		position.collateral > 0n;

	return [{
		json: {
			userAddress,
			marketId,
			transaction: txStatus,
			currentPosition: {
				supplyShares: position.supplyShares.toString(),
				borrowShares: position.borrowShares.toString(),
				collateral: position.collateral.toString(),
				hasPosition,
			},
			migrationComplete: hasPosition && (!transactionHash || txStatus?.status === 'SUCCESS'),
		},
	}];
}

export async function estimateGasSavings(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const sourceProtocol = executeFunctions.getNodeParameter('sourceProtocol', itemIndex) as string;
	const operationType = executeFunctions.getNodeParameter('operationType', itemIndex, 'borrow') as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Gas estimates for common operations (in gas units)
	const gasEstimates: Record<string, Record<string, number>> = {
		aave: {
			supply: 250000,
			borrow: 350000,
			repay: 280000,
			withdraw: 260000,
		},
		compound: {
			supply: 220000,
			borrow: 320000,
			repay: 250000,
			withdraw: 240000,
		},
		morpho: {
			supply: 150000,
			borrow: 200000,
			repay: 180000,
			withdraw: 160000,
		},
	};

	const sourceGas = gasEstimates[sourceProtocol.toLowerCase()]?.[operationType] || 300000;
	const morphoGas = gasEstimates.morpho[operationType] || 175000;
	const gasSavings = sourceGas - morphoGas;
	const savingsPercent = (gasSavings / sourceGas) * 100;

	// Get current gas price
	const gasPrice = await morpho.provider.getFeeData();
	const gasPriceGwei = gasPrice.gasPrice
		? Number(gasPrice.gasPrice) / 1e9
		: 30; // Default 30 gwei

	const ethSavings = (gasSavings * gasPriceGwei) / 1e9;

	return [{
		json: {
			sourceProtocol,
			operationType,
			comparison: {
				sourceProtocolGas: sourceGas,
				morphoGas,
				gasSavings,
				savingsPercent: savingsPercent.toFixed(2) + '%',
			},
			currentGasPrice: gasPriceGwei.toFixed(2) + ' gwei',
			estimatedEthSavings: ethSavings.toFixed(6) + ' ETH',
			note: 'Morpho Blue has optimized gas usage due to its minimal, immutable design',
			benefits: [
				'Simpler contract architecture reduces gas',
				'No complex storage patterns',
				'Efficient share-based accounting',
				'Optimized for common operations',
			],
		},
	}];
}

/**
 * Execute migration action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'checkMigrationEligibility':
			return checkMigrationEligibility(executeFunctions, itemIndex);
		case 'migrateFromAave':
			return migrateFromAave(executeFunctions, itemIndex);
		case 'migrateFromCompound':
			return migrateFromCompound(executeFunctions, itemIndex);
		case 'getMigrationQuote':
			return getMigrationQuote(executeFunctions, itemIndex);
		case 'getMigrationStatus':
			return getMigrationStatus(executeFunctions, itemIndex);
		case 'estimateGasSavings':
			return estimateGasSavings(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown migration operation: ${operation}`);
	}
}
