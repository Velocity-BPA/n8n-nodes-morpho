/**
 * @file Utility Actions for Morpho DeFi Protocol
 * @description Helper functions and utility operations
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { NETWORK_CONFIGS } from '../../constants/networks';
import { MORPHO_CONTRACTS } from '../../constants/contracts';
import { toSupplyAssets, toBorrowAssets, toSupplyShares, toBorrowShares } from '../../utils/sharesUtils';
import { calculateHealthFactor, calculateLiquidationPrice } from '../../utils/healthUtils';

/**
 * Utility Actions
 * Helper functions for common calculations and operations
 */

export async function convertSharesToAssets(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const sharesAmount = executeFunctions.getNodeParameter('sharesAmount', itemIndex) as string;
	const shareType = executeFunctions.getNodeParameter('shareType', itemIndex, 'supply') as string;

	const morpho = await getMorphoClient(executeFunctions);
	const state = await morpho.morphoContract.market(marketId);

	const sharesBigInt = BigInt(sharesAmount);
	let assets: bigint;

	if (shareType === 'supply') {
		assets = toSupplyAssets(
			sharesBigInt,
			state.totalSupplyAssets,
			state.totalSupplyShares,
		);
	} else {
		assets = toBorrowAssets(
			sharesBigInt,
			state.totalBorrowAssets,
			state.totalBorrowShares,
		);
	}

	// Calculate exchange rate
	const exchangeRate = sharesBigInt > 0n
		? Number(assets) / Number(sharesBigInt)
		: 1;

	return [{
		json: {
			input: {
				shares: sharesAmount,
				shareType,
				marketId,
			},
			output: {
				assets: assets.toString(),
				exchangeRate: exchangeRate.toFixed(18),
			},
			marketState: {
				totalSupplyAssets: state.totalSupplyAssets.toString(),
				totalSupplyShares: state.totalSupplyShares.toString(),
				totalBorrowAssets: state.totalBorrowAssets.toString(),
				totalBorrowShares: state.totalBorrowShares.toString(),
			},
		},
	}];
}

export async function convertAssetsToShares(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const assetsAmount = executeFunctions.getNodeParameter('assetsAmount', itemIndex) as string;
	const shareType = executeFunctions.getNodeParameter('shareType', itemIndex, 'supply') as string;

	const morpho = await getMorphoClient(executeFunctions);
	const state = await morpho.morphoContract.market(marketId);

	const assetsBigInt = BigInt(assetsAmount);
	let shares: bigint;

	if (shareType === 'supply') {
		shares = toSupplyShares(
			assetsBigInt,
			state.totalSupplyAssets,
			state.totalSupplyShares,
		);
	} else {
		shares = toBorrowShares(
			assetsBigInt,
			state.totalBorrowAssets,
			state.totalBorrowShares,
		);
	}

	const exchangeRate = shares > 0n
		? Number(assetsBigInt) / Number(shares)
		: 1;

	return [{
		json: {
			input: {
				assets: assetsAmount,
				shareType,
				marketId,
			},
			output: {
				shares: shares.toString(),
				exchangeRate: exchangeRate.toFixed(18),
			},
		},
	}];
}

export async function calculateAPY(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const ratePerSecond = executeFunctions.getNodeParameter('ratePerSecond', itemIndex) as string;
	const compoundingPeriod = executeFunctions.getNodeParameter('compoundingPeriod', itemIndex, 'continuous') as string;

	const ratePerSecondNumber = parseFloat(ratePerSecond);
	const secondsPerYear = 365.25 * 24 * 60 * 60;

	let apy: number;
	let apr: number;

	// APR is simple (non-compounded)
	apr = ratePerSecondNumber * secondsPerYear * 100;

	// APY depends on compounding
	switch (compoundingPeriod) {
		case 'continuous':
			// Continuous compounding: APY = e^(r*t) - 1
			apy = (Math.exp(ratePerSecondNumber * secondsPerYear) - 1) * 100;
			break;
		case 'daily':
			// Daily compounding
			const dailyRate = ratePerSecondNumber * 86400;
			apy = (Math.pow(1 + dailyRate, 365) - 1) * 100;
			break;
		case 'weekly':
			const weeklyRate = ratePerSecondNumber * 604800;
			apy = (Math.pow(1 + weeklyRate, 52) - 1) * 100;
			break;
		case 'monthly':
			const monthlyRate = ratePerSecondNumber * 2628000;
			apy = (Math.pow(1 + monthlyRate, 12) - 1) * 100;
			break;
		default:
			apy = (Math.exp(ratePerSecondNumber * secondsPerYear) - 1) * 100;
	}

	return [{
		json: {
			input: {
				ratePerSecond,
				compoundingPeriod,
			},
			output: {
				apr: apr.toFixed(4) + '%',
				apy: apy.toFixed(4) + '%',
				aprNumeric: apr,
				apyNumeric: apy,
			},
			explanation: {
				apr: 'Annual Percentage Rate (simple interest)',
				apy: 'Annual Percentage Yield (compound interest)',
				difference: (apy - apr).toFixed(4) + '% additional from compounding',
			},
		},
	}];
}

export async function calculateHealthFactorUtil(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const collateralValue = executeFunctions.getNodeParameter('collateralValue', itemIndex) as number;
	const borrowValue = executeFunctions.getNodeParameter('debtValue', itemIndex) as number;
	const lltv = executeFunctions.getNodeParameter('lltv', itemIndex) as number;

	const healthFactor = calculateHealthFactor(
		BigInt(Math.floor(collateralValue * 1e18)),
		BigInt(Math.floor(borrowValue * 1e18)),
		BigInt(Math.floor(lltv * 1e16)),
	);

	const healthFactorNumber = Number(healthFactor) / 1e18;

	let status: string;
	let recommendation: string;

	if (borrowValue === 0) {
		status = 'NO_DEBT';
		recommendation = 'No active debt position';
	} else if (healthFactorNumber >= 2) {
		status = 'SAFE';
		recommendation = 'Position is well-collateralized';
	} else if (healthFactorNumber >= 1.5) {
		status = 'HEALTHY';
		recommendation = 'Position is healthy but monitor during high volatility';
	} else if (healthFactorNumber >= 1.1) {
		status = 'WARNING';
		recommendation = 'Consider adding collateral or reducing debt';
	} else if (healthFactorNumber >= 1) {
		status = 'DANGER';
		recommendation = 'High liquidation risk - take immediate action';
	} else {
		status = 'LIQUIDATABLE';
		recommendation = 'Position can be liquidated';
	}

	return [{
		json: {
			input: {
				collateralValue,
				borrowValue,
				lltv,
			},
			healthFactor: healthFactorNumber.toFixed(4),
			status,
			recommendation,
			liquidationBuffer: ((healthFactorNumber - 1) * 100).toFixed(2) + '%',
		},
	}];
}

export async function calculateLiquidationPriceUtil(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const collateralAmount = executeFunctions.getNodeParameter('collateralAmount', itemIndex) as number;
	const borrowAmount = executeFunctions.getNodeParameter('borrowAmount', itemIndex) as number;
	const currentPrice = executeFunctions.getNodeParameter('currentPrice', itemIndex) as number;
	const lltv = executeFunctions.getNodeParameter('lltv', itemIndex) as number;

	// Liquidation price = (borrowAmount / (collateralAmount * LLTV))
	const lltvDecimal = lltv / 100;
	const liquidationPrice = borrowAmount / (collateralAmount * lltvDecimal);

	const priceDropPercent = ((currentPrice - liquidationPrice) / currentPrice) * 100;
	const distanceToLiquidation = currentPrice - liquidationPrice;

	return [{
		json: {
			input: {
				collateralAmount,
				borrowAmount,
				currentPrice,
				lltv,
			},
			liquidationPrice: liquidationPrice.toFixed(8),
			currentPrice,
			priceDropToLiquidation: priceDropPercent.toFixed(2) + '%',
			distanceToLiquidation: distanceToLiquidation.toFixed(8),
			isAtRisk: priceDropPercent < 20,
			riskLevel: priceDropPercent < 10 ? 'HIGH' : priceDropPercent < 20 ? 'MEDIUM' : 'LOW',
		},
	}];
}

export async function validateMarketId(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Check if market exists by trying to get its parameters
	try {
		const params = await morpho.morphoContract.idToMarketParams(marketId);

		// A market exists if loanToken is not zero address
		const exists = params.loanToken !== '0x0000000000000000000000000000000000000000';

		if (!exists) {
			return [{
				json: {
					marketId,
					valid: false,
					error: 'Market does not exist',
				},
			}];
		}

		// Get market state
		const state = await morpho.morphoContract.market(marketId);

		return [{
			json: {
				marketId,
				valid: true,
				parameters: {
					loanToken: params.loanToken,
					collateralToken: params.collateralToken,
					oracle: params.oracle,
					irm: params.irm,
					lltv: Number(params.lltv) / 1e16,
				},
				hasActivity: state.totalSupplyAssets > 0n || state.totalBorrowAssets > 0n,
			},
		}];
	} catch (error) {
		return [{
			json: {
				marketId,
				valid: false,
				error: error instanceof Error ? error.message : 'Validation failed',
			},
		}];
	}
}

export async function getContractAddresses(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const network = executeFunctions.getNodeParameter('network', itemIndex, 'ethereum') as string;

	const contracts = MORPHO_CONTRACTS[network as keyof typeof MORPHO_CONTRACTS];
	const networkConfig = NETWORK_CONFIGS[network as keyof typeof NETWORK_CONFIGS];

	if (!contracts) {
		return [{
			json: {
				network,
				error: `Unknown network: ${network}`,
				supportedNetworks: Object.keys(MORPHO_CONTRACTS),
			},
		}];
	}

	return [{
		json: {
			network,
			chainId: networkConfig?.chainId,
			contracts: {
				morpho: contracts.morpho,
				bundler: contracts.bundler,
				publicAllocator: contracts.publicAllocator,
				metaMorphoFactory: contracts.metaMorphoFactory,
			},
			subgraph: networkConfig?.subgraph,
			explorer: networkConfig?.blockExplorer,
		},
	}];
}

export async function estimateGas(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const operation = executeFunctions.getNodeParameter('operationType', itemIndex) as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Gas estimates for common operations (in gas units)
	const gasEstimates: Record<string, number> = {
		supply: 150000,
		supplyCollateral: 120000,
		borrow: 200000,
		repay: 180000,
		withdraw: 160000,
		withdrawCollateral: 130000,
		liquidate: 350000,
		vaultDeposit: 180000,
		vaultWithdraw: 170000,
	};

	const estimatedGas = gasEstimates[operation] || 200000;

	// Get current gas price
	const feeData = await morpho.provider.getFeeData();
	const gasPrice = feeData.gasPrice || 30000000000n; // Default 30 gwei
	const gasPriceGwei = Number(gasPrice) / 1e9;

	const estimatedCostWei = BigInt(estimatedGas) * gasPrice;
	const estimatedCostEth = Number(estimatedCostWei) / 1e18;

	return [{
		json: {
			operation,
			estimatedGas,
			gasPrice: gasPriceGwei.toFixed(2) + ' gwei',
			estimatedCost: estimatedCostEth.toFixed(6) + ' ETH',
			note: 'Estimates are approximate. Actual gas may vary based on network conditions and operation parameters.',
			allOperations: gasEstimates,
		},
	}];
}

export async function getNetworkStatus(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const morpho = await getMorphoClient(executeFunctions);

	try {
		// Get current block
		const block = await morpho.provider.getBlock('latest');
		const blockNumber = block?.number || 0;
		const blockTimestamp = block?.timestamp || 0;

		// Get gas price
		const feeData = await morpho.provider.getFeeData();

		// Check Morpho contract
		let morphoStatus = 'UNKNOWN';
		try {
			// Try to call a read function
			await morpho.morphoContract.owner();
			morphoStatus = 'CONNECTED';
		} catch {
			morphoStatus = 'ERROR';
		}

		return [{
			json: {
				network: morpho.network,
				status: 'CONNECTED',
				block: {
					number: blockNumber,
					timestamp: blockTimestamp,
					time: new Date(blockTimestamp * 1000).toISOString(),
				},
				gasPrice: {
					current: feeData.gasPrice ? (Number(feeData.gasPrice) / 1e9).toFixed(2) + ' gwei' : 'unknown',
					maxFee: feeData.maxFeePerGas ? (Number(feeData.maxFeePerGas) / 1e9).toFixed(2) + ' gwei' : 'unknown',
					maxPriority: feeData.maxPriorityFeePerGas ? (Number(feeData.maxPriorityFeePerGas) / 1e9).toFixed(2) + ' gwei' : 'unknown',
				},
				morphoContract: morphoStatus,
			},
		}];
	} catch (error) {
		return [{
			json: {
				network: morpho.network,
				status: 'ERROR',
				error: error instanceof Error ? error.message : 'Connection failed',
			},
		}];
	}
}

/**
 * Execute utility action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'convertSharesToAssets':
			return convertSharesToAssets(executeFunctions, itemIndex);
		case 'convertAssetsToShares':
			return convertAssetsToShares(executeFunctions, itemIndex);
		case 'calculateAPY':
			return calculateAPY(executeFunctions, itemIndex);
		case 'calculateHealthFactor':
			return calculateHealthFactorUtil(executeFunctions, itemIndex);
		case 'calculateLiquidationPrice':
			return calculateLiquidationPriceUtil(executeFunctions, itemIndex);
		case 'validateMarketId':
			return validateMarketId(executeFunctions, itemIndex);
		case 'getContractAddresses':
			return getContractAddresses(executeFunctions, itemIndex);
		case 'estimateGas':
			return estimateGas(executeFunctions, itemIndex);
		case 'getNetworkStatus':
			return getNetworkStatus(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown utility operation: ${operation}`);
	}
}
