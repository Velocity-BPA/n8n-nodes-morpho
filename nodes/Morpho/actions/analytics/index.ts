/**
 * @file Analytics Actions for Morpho DeFi Protocol
 * @description Protocol analytics, statistics, and reporting operations
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
import { KNOWN_VAULTS } from '../../constants/vaults';

/**
 * Analytics Actions
 * Comprehensive protocol analytics and statistics
 */

export async function getProtocolTVL(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const morpho = await getMorphoClient(executeFunctions);

	let totalTVL = 0n;
	let marketTVLs: any[] = [];

	// Aggregate TVL from known markets
	for (const market of CURATED_MARKETS) {
		try {
			const state = await morpho.morphoContract.market(market.id);
			const marketTVL = state.totalSupplyAssets;
			totalTVL += marketTVL;

			marketTVLs.push({
				marketId: market.id,
				name: market.name,
				tvl: marketTVL.toString(),
			});
		} catch {
			// Skip failed markets
		}
	}

	// Sort by TVL descending
	marketTVLs.sort((a, b) => {
		const aVal = BigInt(a.tvl);
		const bVal = BigInt(b.tvl);
		return aVal > bVal ? -1 : aVal < bVal ? 1 : 0;
	});

	return [{
		json: {
			network: morpho.network,
			totalTVL: totalTVL.toString(),
			totalTVLFormatted: (Number(totalTVL) / 1e18).toFixed(2),
			marketCount: marketTVLs.length,
			topMarkets: marketTVLs.slice(0, 10),
			timestamp: new Date().toISOString(),
		},
	}];
}

export async function getProtocolStats(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const morpho = await getMorphoClient(executeFunctions);

	let totalSupply = 0n;
	let totalBorrow = 0n;
	let marketCount = 0;
	let activeMarkets = 0;

	for (const market of CURATED_MARKETS) {
		try {
			const state = await morpho.morphoContract.market(market.id);
			totalSupply += state.totalSupplyAssets;
			totalBorrow += state.totalBorrowAssets;
			marketCount++;

			if (state.totalSupplyAssets > 0n) {
				activeMarkets++;
			}
		} catch {
			// Skip failed markets
		}
	}

	// Calculate protocol-wide utilization
	const utilization = totalSupply > 0n
		? Number((totalBorrow * 10000n) / totalSupply) / 100
		: 0;

	return [{
		json: {
			network: morpho.network,
			stats: {
				totalSupply: totalSupply.toString(),
				totalBorrow: totalBorrow.toString(),
				availableLiquidity: (totalSupply - totalBorrow).toString(),
				utilization: utilization.toFixed(2) + '%',
				marketCount,
				activeMarkets,
			},
			vaultCount: KNOWN_VAULTS.filter(v => v.network === morpho.network).length,
			timestamp: new Date().toISOString(),
		},
	}];
}

export async function getVolumeStats(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const timeRange = executeFunctions.getNodeParameter('timeRange', itemIndex, '24h') as string;

	const subgraph = getSubgraphClient(executeFunctions);

	const now = Math.floor(Date.now() / 1000);
	let since: number;

	switch (timeRange) {
		case '1h': since = now - 60 * 60; break;
		case '24h': since = now - 24 * 60 * 60; break;
		case '7d': since = now - 7 * 24 * 60 * 60; break;
		case '30d': since = now - 30 * 24 * 60 * 60; break;
		default: since = now - 24 * 60 * 60;
	}

	const query = `
		query VolumeStats($since: Int!) {
			supplyEvents: supplies(where: { timestamp_gte: $since }) {
				id
				assets
				timestamp
			}
			borrowEvents: borrows(where: { timestamp_gte: $since }) {
				id
				assets
				timestamp
			}
			repayEvents: repays(where: { timestamp_gte: $since }) {
				id
				assets
				timestamp
			}
			withdrawEvents: withdraws(where: { timestamp_gte: $since }) {
				id
				assets
				timestamp
			}
			liquidationEvents: liquidations(where: { timestamp_gte: $since }) {
				id
				repaidAssets
				seizedCollateral
				timestamp
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { since });

		// Aggregate volumes
		const supplyVolume = result.supplyEvents?.reduce(
			(sum: bigint, e: any) => sum + BigInt(e.assets || 0), 0n
		) || 0n;
		const borrowVolume = result.borrowEvents?.reduce(
			(sum: bigint, e: any) => sum + BigInt(e.assets || 0), 0n
		) || 0n;
		const repayVolume = result.repayEvents?.reduce(
			(sum: bigint, e: any) => sum + BigInt(e.assets || 0), 0n
		) || 0n;
		const withdrawVolume = result.withdrawEvents?.reduce(
			(sum: bigint, e: any) => sum + BigInt(e.assets || 0), 0n
		) || 0n;
		const liquidationVolume = result.liquidationEvents?.reduce(
			(sum: bigint, e: any) => sum + BigInt(e.repaidAssets || 0), 0n
		) || 0n;

		return [{
			json: {
				timeRange,
				volume: {
					supply: supplyVolume.toString(),
					borrow: borrowVolume.toString(),
					repay: repayVolume.toString(),
					withdraw: withdrawVolume.toString(),
					liquidation: liquidationVolume.toString(),
					total: (supplyVolume + borrowVolume + repayVolume + withdrawVolume).toString(),
				},
				eventCounts: {
					supplies: result.supplyEvents?.length || 0,
					borrows: result.borrowEvents?.length || 0,
					repays: result.repayEvents?.length || 0,
					withdraws: result.withdrawEvents?.length || 0,
					liquidations: result.liquidationEvents?.length || 0,
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				timeRange,
				note: 'Volume statistics require subgraph access. Please configure the Morpho subgraph endpoint.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

export async function getUserStats(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex) as string;

	const subgraph = getSubgraphClient(executeFunctions);

	const query = `
		query UserStats($user: Bytes!) {
			user(id: $user) {
				id
				positions {
					id
					market {
						id
					}
					supplyShares
					borrowShares
					collateral
				}
			}
			supplies(where: { onBehalf: $user }, first: 100) {
				id
				assets
				shares
				timestamp
			}
			borrows(where: { onBehalf: $user }, first: 100) {
				id
				assets
				shares
				timestamp
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { user: userAddress.toLowerCase() });

		const positions = result.user?.positions || [];
		const activePositions = positions.filter(
			(p: any) => BigInt(p.supplyShares || 0) > 0n ||
				BigInt(p.borrowShares || 0) > 0n ||
				BigInt(p.collateral || 0) > 0n
		);

		return [{
			json: {
				userAddress,
				stats: {
					totalPositions: positions.length,
					activePositions: activePositions.length,
					supplyTransactions: result.supplies?.length || 0,
					borrowTransactions: result.borrows?.length || 0,
				},
				positions: activePositions,
				recentActivity: {
					supplies: (result.supplies || []).slice(0, 10),
					borrows: (result.borrows || []).slice(0, 10),
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				userAddress,
				note: 'User statistics require subgraph access. Please configure the Morpho subgraph endpoint.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

export async function getMarketRankings(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const sortBy = executeFunctions.getNodeParameter('sortBy', itemIndex, 'tvl') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 10) as number;

	const morpho = await getMorphoClient(executeFunctions);

	const marketData: any[] = [];

	for (const market of CURATED_MARKETS) {
		try {
			const state = await morpho.morphoContract.market(market.id);
			const totalSupply = state.totalSupplyAssets;
			const totalBorrow = state.totalBorrowAssets;
			const utilization = totalSupply > 0n
				? Number((totalBorrow * 10000n) / totalSupply) / 100
				: 0;

			marketData.push({
				marketId: market.id,
				name: market.name,
				tvl: totalSupply.toString(),
				tvlNumber: Number(totalSupply),
				totalBorrow: totalBorrow.toString(),
				utilization,
			});
		} catch {
			// Skip failed markets
		}
	}

	// Sort based on criteria
	switch (sortBy) {
		case 'tvl':
			marketData.sort((a, b) => b.tvlNumber - a.tvlNumber);
			break;
		case 'utilization':
			marketData.sort((a, b) => b.utilization - a.utilization);
			break;
		case 'borrow':
			marketData.sort((a, b) => Number(BigInt(b.totalBorrow) - BigInt(a.totalBorrow)));
			break;
		default:
			marketData.sort((a, b) => b.tvlNumber - a.tvlNumber);
	}

	// Add rankings
	const rankedMarkets = marketData.slice(0, limit).map((m, i) => ({
		rank: i + 1,
		...m,
	}));

	return [{
		json: {
			sortBy,
			limit,
			rankings: rankedMarkets,
			totalMarkets: marketData.length,
		},
	}];
}

export async function getTopSuppliers(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex, '') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 10) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	const query = marketId
		? `
			query TopSuppliers($marketId: ID!, $limit: Int!) {
				positions(
					where: { market: $marketId, supplyShares_gt: "0" }
					orderBy: supplyShares
					orderDirection: desc
					first: $limit
				) {
					id
					user { id }
					supplyShares
					market { id }
				}
			}
		`
		: `
			query TopSuppliers($limit: Int!) {
				positions(
					where: { supplyShares_gt: "0" }
					orderBy: supplyShares
					orderDirection: desc
					first: $limit
				) {
					id
					user { id }
					supplyShares
					market { id }
				}
			}
		`;

	try {
		const result = await subgraph.query(query, marketId ? { marketId, limit } : { limit });

		const suppliers = (result.positions || []).map((p: any, i: number) => ({
			rank: i + 1,
			user: p.user?.id,
			marketId: p.market?.id,
			supplyShares: p.supplyShares,
		}));

		return [{
			json: {
				marketId: marketId || 'all',
				limit,
				topSuppliers: suppliers,
			},
		}];
	} catch (error) {
		return [{
			json: {
				marketId: marketId || 'all',
				note: 'Top suppliers data requires subgraph access.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

export async function getTopBorrowers(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex, '') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 10) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	const query = marketId
		? `
			query TopBorrowers($marketId: ID!, $limit: Int!) {
				positions(
					where: { market: $marketId, borrowShares_gt: "0" }
					orderBy: borrowShares
					orderDirection: desc
					first: $limit
				) {
					id
					user { id }
					borrowShares
					market { id }
				}
			}
		`
		: `
			query TopBorrowers($limit: Int!) {
				positions(
					where: { borrowShares_gt: "0" }
					orderBy: borrowShares
					orderDirection: desc
					first: $limit
				) {
					id
					user { id }
					borrowShares
					market { id }
				}
			}
		`;

	try {
		const result = await subgraph.query(query, marketId ? { marketId, limit } : { limit });

		const borrowers = (result.positions || []).map((p: any, i: number) => ({
			rank: i + 1,
			user: p.user?.id,
			marketId: p.market?.id,
			borrowShares: p.borrowShares,
		}));

		return [{
			json: {
				marketId: marketId || 'all',
				limit,
				topBorrowers: borrowers,
			},
		}];
	} catch (error) {
		return [{
			json: {
				marketId: marketId || 'all',
				note: 'Top borrowers data requires subgraph access.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

export async function getHistoricalData(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const timeRange = executeFunctions.getNodeParameter('timeRange', itemIndex, '7d') as string;

	const subgraph = getSubgraphClient(executeFunctions);

	const now = Math.floor(Date.now() / 1000);
	let since: number;

	switch (timeRange) {
		case '24h': since = now - 24 * 60 * 60; break;
		case '7d': since = now - 7 * 24 * 60 * 60; break;
		case '30d': since = now - 30 * 24 * 60 * 60; break;
		case '90d': since = now - 90 * 24 * 60 * 60; break;
		default: since = now - 7 * 24 * 60 * 60;
	}

	const query = `
		query HistoricalData($marketId: ID!, $since: Int!) {
			market(id: $marketId) {
				id
				dailySnapshots(
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
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { marketId, since });

		return [{
			json: {
				marketId,
				timeRange,
				dataPoints: result.market?.dailySnapshots?.length || 0,
				historicalData: result.market?.dailySnapshots || [],
			},
		}];
	} catch (error) {
		return [{
			json: {
				marketId,
				timeRange,
				note: 'Historical data requires subgraph access.',
				error: error instanceof Error ? error.message : 'Unknown error',
			},
		}];
	}
}

export async function exportAnalytics(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const exportType = executeFunctions.getNodeParameter('exportType', itemIndex, 'summary') as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Gather comprehensive analytics
	const analytics: any = {
		exportedAt: new Date().toISOString(),
		network: morpho.network,
		type: exportType,
	};

	if (exportType === 'summary' || exportType === 'full') {
		// Protocol summary
		let totalSupply = 0n;
		let totalBorrow = 0n;
		const markets: any[] = [];

		for (const market of CURATED_MARKETS) {
			try {
				const state = await morpho.morphoContract.market(market.id);
				const params = await morpho.morphoContract.idToMarketParams(market.id);

				totalSupply += state.totalSupplyAssets;
				totalBorrow += state.totalBorrowAssets;

				markets.push({
					id: market.id,
					name: market.name,
					totalSupply: state.totalSupplyAssets.toString(),
					totalBorrow: state.totalBorrowAssets.toString(),
					lltv: Number(params.lltv) / 1e16,
				});
			} catch {
				// Skip failed
			}
		}

		analytics.summary = {
			totalSupply: totalSupply.toString(),
			totalBorrow: totalBorrow.toString(),
			marketCount: markets.length,
			utilization: totalSupply > 0n
				? (Number(totalBorrow) / Number(totalSupply) * 100).toFixed(2) + '%'
				: '0%',
		};

		if (exportType === 'full') {
			analytics.markets = markets;
			analytics.vaults = KNOWN_VAULTS.filter(v => v.network === morpho.network);
		}
	}

	return [{
		json: analytics,
	}];
}

export async function getYieldComparison(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const asset = executeFunctions.getNodeParameter('asset', itemIndex, '') as string;

	const morpho = await getMorphoClient(executeFunctions);

	// Find markets with the specified asset
	const yieldData: any[] = [];

	for (const market of CURATED_MARKETS) {
		try {
			const params = await morpho.morphoContract.idToMarketParams(market.id);

			// Check if market involves the asset
			const matchesAsset = !asset ||
				params.loanToken.toLowerCase() === asset.toLowerCase() ||
				params.collateralToken.toLowerCase() === asset.toLowerCase();

			if (matchesAsset) {
				const state = await morpho.morphoContract.market(market.id);
				const utilization = state.totalSupplyAssets > 0n
					? Number(state.totalBorrowAssets) / Number(state.totalSupplyAssets)
					: 0;

				// Get IRM rate
				let borrowAPY = 0;
				let supplyAPY = 0;
				try {
					const irmContract = new morpho.provider.Contract(
						params.irm,
						['function borrowRateView(bytes32,tuple(uint128,uint128,uint128,uint128,uint128)) view returns (uint256)'],
						morpho.provider
					);
					const rate = await irmContract.borrowRateView(market.id, [
						state.totalSupplyAssets,
						state.totalSupplyShares,
						state.totalBorrowAssets,
						state.totalBorrowShares,
						state.lastUpdate,
					]);
					// Convert to APY
					const secondsPerYear = 365.25 * 24 * 60 * 60;
					borrowAPY = (Math.exp(Number(rate) / 1e18 * secondsPerYear) - 1) * 100;
					supplyAPY = borrowAPY * utilization * (1 - Number(state.fee) / 1e18);
				} catch {
					// IRM query failed
				}

				yieldData.push({
					marketId: market.id,
					name: market.name,
					loanToken: params.loanToken,
					collateralToken: params.collateralToken,
					supplyAPY: supplyAPY.toFixed(2) + '%',
					borrowAPY: borrowAPY.toFixed(2) + '%',
					utilization: (utilization * 100).toFixed(2) + '%',
					lltv: Number(params.lltv) / 1e16,
				});
			}
		} catch {
			// Skip failed markets
		}
	}

	// Sort by supply APY
	yieldData.sort((a, b) => parseFloat(b.supplyAPY) - parseFloat(a.supplyAPY));

	return [{
		json: {
			asset: asset || 'all',
			marketCount: yieldData.length,
			comparison: yieldData,
			bestSupplyAPY: yieldData[0] || null,
			lowestBorrowAPY: [...yieldData].sort((a, b) =>
				parseFloat(a.borrowAPY) - parseFloat(b.borrowAPY)
			)[0] || null,
		},
	}];
}

/**
 * Execute analytics action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getProtocolTVL':
			return getProtocolTVL(executeFunctions, itemIndex);
		case 'getProtocolStats':
			return getProtocolStats(executeFunctions, itemIndex);
		case 'getVolumeStats':
			return getVolumeStats(executeFunctions, itemIndex);
		case 'getUserStats':
			return getUserStats(executeFunctions, itemIndex);
		case 'getMarketRankings':
			return getMarketRankings(executeFunctions, itemIndex);
		case 'getTopSuppliers':
			return getTopSuppliers(executeFunctions, itemIndex);
		case 'getTopBorrowers':
			return getTopBorrowers(executeFunctions, itemIndex);
		case 'getHistoricalData':
			return getHistoricalData(executeFunctions, itemIndex);
		case 'exportAnalytics':
			return exportAnalytics(executeFunctions, itemIndex);
		case 'getYieldComparison':
			return getYieldComparison(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown analytics operation: ${operation}`);
	}
}
