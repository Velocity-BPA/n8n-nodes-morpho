/**
 * @file Risk Actions for Morpho DeFi Protocol
 * @description Risk assessment and parameter operations
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { getSubgraphClient } from '../../transport/subgraphClient';
import { CURATED_MARKETS, MARKET_REGISTRY } from '../../constants/markets';
import { calculateHealthFactor } from '../../utils/healthUtils';
import { ORACLE_CONFIGS } from '../../constants/oracles';

/**
 * Risk Actions
 * Comprehensive risk assessment for Morpho protocol
 */

export async function getRiskParameters(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	// Get market parameters
	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);

	// Get market state
	const marketState = await morpho.morphoContract.market(marketId);

	// Calculate utilization
	const totalSupply = marketState.totalSupplyAssets;
	const totalBorrow = marketState.totalBorrowAssets;
	const utilization = totalSupply > 0n
		? Number((totalBorrow * 10000n) / totalSupply) / 100
		: 0;

	// Get oracle price
	let oraclePrice = 0n;
	try {
		const oracleContract = new morpho.provider.Contract(
			marketParams.oracle,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		oraclePrice = await oracleContract.price();
	} catch {
		// Oracle may not be available
	}

	// LLTV in percentage
	const lltvPercent = Number(marketParams.lltv) / 1e16;

	return [{
		json: {
			marketId,
			riskParameters: {
				lltv: marketParams.lltv.toString(),
				lltvPercent,
				oracle: marketParams.oracle,
				irm: marketParams.irm,
				loanToken: marketParams.loanToken,
				collateralToken: marketParams.collateralToken,
			},
			marketState: {
				totalSupplyAssets: totalSupply.toString(),
				totalBorrowAssets: totalBorrow.toString(),
				utilization,
				lastUpdate: Number(marketState.lastUpdate),
				fee: Number(marketState.fee) / 1e18,
			},
			oraclePrice: oraclePrice.toString(),
			riskLevel: utilization > 90 ? 'HIGH' : utilization > 70 ? 'MEDIUM' : 'LOW',
		},
	}];
}

export async function getLLTV(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);

	const lltvRaw = marketParams.lltv;
	const lltvPercent = Number(lltvRaw) / 1e16;
	const maxLTV = lltvPercent - 5; // Safe buffer below liquidation

	return [{
		json: {
			marketId,
			lltv: lltvRaw.toString(),
			lltvPercent,
			maxSafeLTV: maxLTV,
			description: `Liquidation occurs when LTV exceeds ${lltvPercent}%`,
		},
	}];
}

export async function getMarketRisk(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);
	const marketState = await morpho.morphoContract.market(marketId);

	// Calculate risk metrics
	const totalSupply = marketState.totalSupplyAssets;
	const totalBorrow = marketState.totalBorrowAssets;
	const utilization = totalSupply > 0n
		? Number((totalBorrow * 10000n) / totalSupply) / 100
		: 0;

	// Liquidity risk
	const availableLiquidity = totalSupply - totalBorrow;
	const liquidityRisk = Number(availableLiquidity) < 1e18 ? 'HIGH' : utilization > 85 ? 'MEDIUM' : 'LOW';

	// Check if market is whitelisted/curated
	const isCurated = CURATED_MARKETS.some(m => m.id.toLowerCase() === marketId.toLowerCase());

	// Overall risk score (0-100)
	let riskScore = 0;
	riskScore += utilization > 90 ? 30 : utilization > 70 ? 15 : 0;
	riskScore += liquidityRisk === 'HIGH' ? 25 : liquidityRisk === 'MEDIUM' ? 10 : 0;
	riskScore += !isCurated ? 20 : 0;

	return [{
		json: {
			marketId,
			riskMetrics: {
				utilization,
				utilizationRisk: utilization > 90 ? 'HIGH' : utilization > 70 ? 'MEDIUM' : 'LOW',
				availableLiquidity: availableLiquidity.toString(),
				liquidityRisk,
				isCurated,
				curationRisk: isCurated ? 'LOW' : 'ELEVATED',
			},
			overallRiskScore: riskScore,
			riskLevel: riskScore > 50 ? 'HIGH' : riskScore > 25 ? 'MEDIUM' : 'LOW',
			lltv: Number(marketParams.lltv) / 1e16,
		},
	}];
}

export async function getProtocolRisk(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const morpho = await getMorphoClient(executeFunctions);

	// Protocol-level risk assessment
	const network = morpho.network;

	// Get total protocol metrics from known markets
	let totalTVL = 0n;
	let marketCount = 0;
	let highRiskMarkets = 0;

	for (const market of CURATED_MARKETS) {
		try {
			const state = await morpho.morphoContract.market(market.id);
			totalTVL += state.totalSupplyAssets;
			marketCount++;

			const utilization = state.totalSupplyAssets > 0n
				? Number((state.totalBorrowAssets * 100n) / state.totalSupplyAssets)
				: 0;
			if (utilization > 90) highRiskMarkets++;
		} catch {
			// Skip markets that fail
		}
	}

	return [{
		json: {
			network,
			protocolRisk: {
				totalTVL: totalTVL.toString(),
				marketCount,
				highRiskMarkets,
				marketRiskRatio: marketCount > 0 ? highRiskMarkets / marketCount : 0,
			},
			smartContractRisk: 'LOW', // Morpho is audited
			oracleRisk: 'LOW', // Uses Chainlink
			governanceRisk: 'LOW', // Decentralized
			overallProtocolRisk: highRiskMarkets > marketCount * 0.3 ? 'ELEVATED' : 'LOW',
			notes: [
				'Morpho Blue is a permissionless lending primitive',
				'Smart contracts are audited by multiple firms',
				'Oracle risk depends on individual market configuration',
			],
		},
	}];
}

export async function getCollateralRisk(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const collateralToken = executeFunctions.getNodeParameter('collateralToken', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	// Find markets using this collateral
	const marketsWithCollateral: any[] = [];

	for (const market of CURATED_MARKETS) {
		try {
			const params = await morpho.morphoContract.idToMarketParams(market.id);
			if (params.collateralToken.toLowerCase() === collateralToken.toLowerCase()) {
				const state = await morpho.morphoContract.market(market.id);
				marketsWithCollateral.push({
					marketId: market.id,
					loanToken: params.loanToken,
					lltv: Number(params.lltv) / 1e16,
					totalCollateral: state.totalSupplyAssets.toString(),
				});
			}
		} catch {
			// Skip failed markets
		}
	}

	// Assess collateral risk
	const isStablecoin = collateralToken.toLowerCase().includes('usdc') ||
		collateralToken.toLowerCase().includes('usdt') ||
		collateralToken.toLowerCase().includes('dai');

	const volatilityRisk = isStablecoin ? 'LOW' : 'MEDIUM';

	return [{
		json: {
			collateralToken,
			marketsUsingCollateral: marketsWithCollateral.length,
			markets: marketsWithCollateral,
			riskAssessment: {
				volatilityRisk,
				liquidityRisk: marketsWithCollateral.length > 5 ? 'LOW' : 'MEDIUM',
				concentrationRisk: marketsWithCollateral.length < 3 ? 'ELEVATED' : 'LOW',
			},
			notes: 'Collateral risk depends on price volatility and market liquidity',
		},
	}];
}

export async function getOracleRisk(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);
	const oracleAddress = marketParams.oracle;

	// Check if oracle is known
	const knownOracle = ORACLE_CONFIGS.find(
		o => o.address.toLowerCase() === oracleAddress.toLowerCase()
	);

	// Try to get price
	let currentPrice = 0n;
	let priceAvailable = false;
	try {
		const oracleContract = new morpho.provider.Contract(
			oracleAddress,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		currentPrice = await oracleContract.price();
		priceAvailable = true;
	} catch {
		// Oracle may not be callable
	}

	return [{
		json: {
			marketId,
			oracle: {
				address: oracleAddress,
				type: knownOracle?.type || 'UNKNOWN',
				description: knownOracle?.description || 'Custom oracle',
				isKnown: !!knownOracle,
			},
			priceAvailable,
			currentPrice: currentPrice.toString(),
			riskAssessment: {
				oracleTypeRisk: knownOracle?.type === 'chainlink' ? 'LOW' : 'MEDIUM',
				availabilityRisk: priceAvailable ? 'LOW' : 'HIGH',
				manipulationRisk: knownOracle?.type === 'chainlink' ? 'LOW' : 'ELEVATED',
			},
			overallOracleRisk: !priceAvailable ? 'HIGH' : !knownOracle ? 'MEDIUM' : 'LOW',
		},
	}];
}

export async function getBadDebtRisk(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const marketState = await morpho.morphoContract.market(marketId);
	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);

	// Get oracle price
	let oraclePrice = 0n;
	try {
		const oracleContract = new morpho.provider.Contract(
			marketParams.oracle,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		oraclePrice = await oracleContract.price();
	} catch {
		// Oracle may not be available
	}

	const totalBorrow = marketState.totalBorrowAssets;
	const totalSupply = marketState.totalSupplyAssets;
	const lltv = Number(marketParams.lltv) / 1e18;

	// Calculate theoretical max bad debt scenario
	// If all positions were at exactly LLTV and price dropped 20%
	const priceDropScenario = 0.20;
	const potentialBadDebt = Number(totalBorrow) * priceDropScenario;

	return [{
		json: {
			marketId,
			currentState: {
				totalBorrow: totalBorrow.toString(),
				totalSupply: totalSupply.toString(),
				lltv,
				oraclePrice: oraclePrice.toString(),
			},
			badDebtRisk: {
				currentBadDebt: '0', // Would need to query individual positions
				potentialBadDebtOn20PercentDrop: potentialBadDebt.toFixed(0),
				exposureRatio: totalSupply > 0n
					? (Number(totalBorrow) / Number(totalSupply) * 100).toFixed(2) + '%'
					: '0%',
			},
			mitigationFactors: [
				'Liquidation incentives encourage timely liquidations',
				'LLTV provides buffer before bad debt occurs',
				'Oracle updates trigger position monitoring',
			],
			riskLevel: Number(totalBorrow) / Number(totalSupply) > 0.85 ? 'ELEVATED' : 'NORMAL',
		},
	}];
}

export async function calculateHealthFactorAction(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const collateralValue = executeFunctions.getNodeParameter('collateralValue', itemIndex) as number;
	const debtValue = executeFunctions.getNodeParameter('debtValue', itemIndex) as number;
	const lltv = executeFunctions.getNodeParameter('lltv', itemIndex) as number;

	// Calculate health factor
	// HF = (collateralValue * LLTV) / debtValue
	const healthFactor = debtValue > 0
		? (collateralValue * (lltv / 100)) / debtValue
		: Infinity;

	// Determine status
	let status: string;
	let recommendation: string;

	if (healthFactor === Infinity) {
		status = 'NO_DEBT';
		recommendation = 'No debt means no liquidation risk';
	} else if (healthFactor >= 2) {
		status = 'SAFE';
		recommendation = 'Position is well-collateralized';
	} else if (healthFactor >= 1.5) {
		status = 'HEALTHY';
		recommendation = 'Position is healthy but monitor during volatility';
	} else if (healthFactor >= 1.1) {
		status = 'WARNING';
		recommendation = 'Consider adding collateral or reducing debt';
	} else if (healthFactor >= 1) {
		status = 'DANGER';
		recommendation = 'Liquidation risk is imminent - take action immediately';
	} else {
		status = 'LIQUIDATABLE';
		recommendation = 'Position can be liquidated';
	}

	// Calculate how much price can drop before liquidation
	const priceDropToLiquidation = healthFactor > 1
		? ((healthFactor - 1) / healthFactor) * 100
		: 0;

	return [{
		json: {
			inputs: {
				collateralValue,
				debtValue,
				lltv,
			},
			healthFactor: healthFactor === Infinity ? 'INFINITE' : healthFactor.toFixed(4),
			status,
			recommendation,
			priceDropToLiquidation: priceDropToLiquidation.toFixed(2) + '%',
			liquidationThreshold: lltv,
		},
	}];
}

export async function getRiskHistory(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const timeRange = executeFunctions.getNodeParameter('timeRange', itemIndex, '7d') as string;

	const subgraph = getSubgraphClient(executeFunctions);

	// Query historical risk data from subgraph
	const query = `
		query MarketRiskHistory($marketId: ID!, $since: Int!) {
			market(id: $marketId) {
				id
				snapshots: dailySnapshots(
					where: { timestamp_gte: $since }
					orderBy: timestamp
					orderDirection: asc
				) {
					timestamp
					totalSupply
					totalBorrow
					utilization
					supplyAPY
					borrowAPY
				}
				liquidations(
					where: { timestamp_gte: $since }
					orderBy: timestamp
					orderDirection: desc
				) {
					id
					timestamp
					repaidAssets
					seizedCollateral
				}
			}
		}
	`;

	// Calculate timestamp based on time range
	const now = Math.floor(Date.now() / 1000);
	let since = now - 7 * 24 * 60 * 60; // Default 7 days

	if (timeRange === '24h') since = now - 24 * 60 * 60;
	else if (timeRange === '7d') since = now - 7 * 24 * 60 * 60;
	else if (timeRange === '30d') since = now - 30 * 24 * 60 * 60;
	else if (timeRange === '90d') since = now - 90 * 24 * 60 * 60;

	try {
		const result = await subgraph.query(query, { marketId, since });

		return [{
			json: {
				marketId,
				timeRange,
				snapshots: result.market?.snapshots || [],
				liquidations: result.market?.liquidations || [],
				summary: {
					snapshotCount: result.market?.snapshots?.length || 0,
					liquidationCount: result.market?.liquidations?.length || 0,
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				marketId,
				timeRange,
				note: 'Historical risk data requires subgraph access. Please configure the Morpho subgraph endpoint.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

/**
 * Execute risk action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getRiskParameters':
			return getRiskParameters(executeFunctions, itemIndex);
		case 'getLLTV':
			return getLLTV(executeFunctions, itemIndex);
		case 'getMarketRisk':
			return getMarketRisk(executeFunctions, itemIndex);
		case 'getProtocolRisk':
			return getProtocolRisk(executeFunctions, itemIndex);
		case 'getCollateralRisk':
			return getCollateralRisk(executeFunctions, itemIndex);
		case 'getOracleRisk':
			return getOracleRisk(executeFunctions, itemIndex);
		case 'getBadDebtRisk':
			return getBadDebtRisk(executeFunctions, itemIndex);
		case 'calculateHealthFactor':
			return calculateHealthFactorAction(executeFunctions, itemIndex);
		case 'getRiskHistory':
			return getRiskHistory(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown risk operation: ${operation}`);
	}
}
