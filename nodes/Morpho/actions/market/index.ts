/**
 * Market Resource Actions
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use of this node by for-profit organizations in production environments
 * requires a commercial license from Velocity BPA.
 * For licensing information, visit https://velobpa.com/licensing
 */

import { IExecuteFunctions } from 'n8n-workflow';
import {
	getConfigFromCredentials,
	getMarketData,
	getMarketParams,
	getOraclePrice,
	getBorrowRate,
} from '../transport/morphoClient';
import { queryMarkets } from '../transport/subgraphClient';
import {
	calculateMarketId,
	calculateMarketTVL,
	calculateAvailableLiquidity,
	formatLLTV,
	formatTokenAmount,
	createMarketSummary,
	isValidMarketId,
} from '../utils/marketUtils';
import {
	calculateUtilization,
	calculateUtilizationPercent,
	borrowRateToAPY,
	calculateSupplyAPY,
} from '../utils/rateUtils';
import { getMarketById as getMarketByIdConst, getMarketsByNetwork } from '../constants/markets';
import { NETWORKS } from '../constants/networks';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
		case 'getMarkets': {
			const network = this.getNodeParameter('network', itemIndex, 'ethereum') as string;
			const limit = this.getNodeParameter('limit', itemIndex, 10) as number;
			const offset = this.getNodeParameter('offset', itemIndex, 0) as number;

			try {
				// Try subgraph first
				const markets = await queryMarkets(config, { limit, offset });
				return markets;
			} catch {
				// Fallback to constants
				const knownMarkets = getMarketsByNetwork(network);
				return knownMarkets.slice(offset, offset + limit).map(m => ({
					id: m.id,
					loanToken: m.loanToken,
					collateralToken: m.collateralToken,
					lltv: formatLLTV(m.lltv),
					name: m.name,
					network,
				}));
			}
		}

		case 'getMarketById': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			if (!isValidMarketId(marketId)) {
				throw new Error('Invalid market ID format. Expected bytes32 hex string.');
			}

			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			return {
				id: marketId,
				params: marketParams,
				state: {
					totalSupplyAssets: marketData.totalSupplyAssets.toString(),
					totalSupplyShares: marketData.totalSupplyShares.toString(),
					totalBorrowAssets: marketData.totalBorrowAssets.toString(),
					totalBorrowShares: marketData.totalBorrowShares.toString(),
					lastUpdate: marketData.lastUpdate,
					fee: marketData.fee,
				},
				utilization: calculateUtilizationPercent(
					marketData.totalBorrowAssets,
					marketData.totalSupplyAssets,
				),
			};
		}

		case 'getMarketInfo': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				oraclePrice = null;
			}

			const utilization = calculateUtilization(
				marketData.totalBorrowAssets,
				marketData.totalSupplyAssets,
			);

			let borrowRate;
			try {
				borrowRate = await getBorrowRate(config, marketParams.irm, marketId);
			} catch {
				borrowRate = null;
			}

			return createMarketSummary(
				marketId,
				marketParams,
				marketData,
				oraclePrice,
			);
		}

		case 'getMarketAPY': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			let borrowRate;
			try {
				borrowRate = await getBorrowRate(config, marketParams.irm, marketId);
			} catch {
				// Calculate from defaults if IRM query fails
				borrowRate = BigInt(0);
			}

			const utilization = calculateUtilization(
				marketData.totalBorrowAssets,
				marketData.totalSupplyAssets,
			);

			const borrowAPY = borrowRateToAPY(borrowRate);
			const supplyAPY = calculateSupplyAPY(borrowAPY, utilization, Number(marketData.fee) / 1e18);

			return {
				marketId,
				borrowAPY: `${(borrowAPY * 100).toFixed(2)}%`,
				supplyAPY: `${(supplyAPY * 100).toFixed(2)}%`,
				borrowAPYRaw: borrowAPY,
				supplyAPYRaw: supplyAPY,
				utilization: `${(utilization * 100).toFixed(2)}%`,
			};
		}

		case 'getMarketUtilization': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const utilization = calculateUtilizationPercent(
				marketData.totalBorrowAssets,
				marketData.totalSupplyAssets,
			);

			return {
				marketId,
				utilization,
				totalSupply: marketData.totalSupplyAssets.toString(),
				totalBorrow: marketData.totalBorrowAssets.toString(),
			};
		}

		case 'getMarketLiquidity': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const liquidity = calculateAvailableLiquidity(
				marketData.totalSupplyAssets,
				marketData.totalBorrowAssets,
			);

			return {
				marketId,
				availableLiquidity: liquidity.toString(),
				availableLiquidityFormatted: formatTokenAmount(liquidity, 18),
				totalSupply: marketData.totalSupplyAssets.toString(),
				totalBorrow: marketData.totalBorrowAssets.toString(),
			};
		}

		case 'getMarketTVL': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const tvl = calculateMarketTVL(marketData.totalSupplyAssets, marketData.totalBorrowAssets);

			return {
				marketId,
				tvl: tvl.toString(),
				tvlFormatted: formatTokenAmount(tvl, 18),
				totalSupplyAssets: marketData.totalSupplyAssets.toString(),
			};
		}

		case 'getMarketParameters': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketParams = await getMarketParams(config, marketId);

			return {
				marketId,
				loanToken: marketParams.loanToken,
				collateralToken: marketParams.collateralToken,
				oracle: marketParams.oracle,
				irm: marketParams.irm,
				lltv: marketParams.lltv.toString(),
				lltvPercent: formatLLTV(marketParams.lltv),
			};
		}

		case 'getMarketOraclePrice': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketParams = await getMarketParams(config, marketId);
			const price = await getOraclePrice(config, marketParams.oracle);

			return {
				marketId,
				oracle: marketParams.oracle,
				price: price.toString(),
				// Price is scaled by 1e36 in Morpho
				priceDecimal: (Number(price) / 1e36).toString(),
			};
		}

		case 'getMarketCaps': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			// Morpho Blue itself doesn't have caps - these are on MetaMorpho vaults
			// Return market state as reference
			const marketData = await getMarketData(config, marketId);

			return {
				marketId,
				note: 'Morpho Blue markets are permissionless with no native caps. Caps are enforced at the MetaMorpho vault level.',
				currentSupply: marketData.totalSupplyAssets.toString(),
				currentBorrow: marketData.totalBorrowAssets.toString(),
			};
		}

		case 'getWhitelistedMarkets': {
			const network = this.getNodeParameter('network', itemIndex, 'ethereum') as string;
			const limit = this.getNodeParameter('limit', itemIndex, 10) as number;

			// Return known/curated markets
			const markets = getMarketsByNetwork(network);
			return markets.slice(0, limit).map(m => ({
				id: m.id,
				name: m.name,
				loanToken: m.loanToken,
				collateralToken: m.collateralToken,
				lltv: formatLLTV(m.lltv),
				network,
				whitelisted: true,
			}));
		}

		case 'searchMarkets': {
			const searchQuery = this.getNodeParameter('searchQuery', itemIndex, '') as string;
			const network = this.getNodeParameter('network', itemIndex, 'ethereum') as string;
			const limit = this.getNodeParameter('limit', itemIndex, 10) as number;

			const allMarkets = getMarketsByNetwork(network);
			const query = searchQuery.toLowerCase();

			const filtered = allMarkets.filter(m =>
				m.name.toLowerCase().includes(query) ||
				m.loanToken.toLowerCase().includes(query) ||
				m.collateralToken.toLowerCase().includes(query),
			);

			return filtered.slice(0, limit).map(m => ({
				id: m.id,
				name: m.name,
				loanToken: m.loanToken,
				collateralToken: m.collateralToken,
				lltv: formatLLTV(m.lltv),
				network,
			}));
		}

		case 'getMarketHistory': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const timeRange = this.getNodeParameter('timeRange', itemIndex, '7d') as string;

			// Historical data requires subgraph
			return {
				marketId,
				timeRange,
				note: 'Historical data requires subgraph integration. Use the Subgraph resource for detailed historical queries.',
				currentState: await getMarketData(config, marketId),
			};
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
