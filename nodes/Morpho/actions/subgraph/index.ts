/**
 * @file Subgraph Actions for Morpho DeFi Protocol
 * @description GraphQL query operations for Morpho subgraph
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getSubgraphClient } from '../../transport/subgraphClient';
import { getMorphoClient } from '../../transport/morphoClient';

/**
 * Subgraph Actions
 * Query indexed data from the Morpho subgraph for historical data,
 * aggregations, and cross-entity queries not available on-chain.
 */

export async function queryMarkets(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 100) as number;
	const offset = executeFunctions.getNodeParameter('offset', itemIndex, 0) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	const query = `
		query QueryMarkets($first: Int!, $skip: Int!) {
			markets(first: $first, skip: $skip, orderBy: totalSupplyAssets, orderDirection: desc) {
				id
				loanToken {
					id
					symbol
					decimals
				}
				collateralToken {
					id
					symbol
					decimals
				}
				oracle
				irm
				lltv
				totalSupplyAssets
				totalSupplyShares
				totalBorrowAssets
				totalBorrowShares
				createdAt
				createdAtBlock
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { first: limit, skip: offset });

		return [{
			json: {
				markets: result.markets || [],
				count: result.markets?.length || 0,
				pagination: {
					limit,
					offset,
					hasMore: (result.markets?.length || 0) === limit,
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				error: error instanceof Error ? error.message : 'Query failed',
				note: 'Ensure the Morpho subgraph endpoint is configured in credentials',
			},
		}];
	}
}

export async function queryPositions(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex, '') as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex, '') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 100) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	// Build filter
	let filter = '';
	const filterConditions: string[] = [];

	if (userAddress) {
		filterConditions.push(`user: "${userAddress.toLowerCase()}"`);
	}
	if (marketId) {
		filterConditions.push(`market: "${marketId}"`);
	}

	if (filterConditions.length > 0) {
		filter = `where: { ${filterConditions.join(', ')} }`;
	}

	const query = `
		query QueryPositions($first: Int!) {
			positions(first: $first, ${filter}, orderBy: supplyShares, orderDirection: desc) {
				id
				user {
					id
				}
				market {
					id
					loanToken {
						symbol
					}
					collateralToken {
						symbol
					}
				}
				supplyShares
				borrowShares
				collateral
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { first: limit });

		const positions = (result.positions || []).map((p: any) => ({
			id: p.id,
			user: p.user?.id,
			marketId: p.market?.id,
			loanToken: p.market?.loanToken?.symbol,
			collateralToken: p.market?.collateralToken?.symbol,
			supplyShares: p.supplyShares,
			borrowShares: p.borrowShares,
			collateral: p.collateral,
		}));

		return [{
			json: {
				positions,
				count: positions.length,
				filters: {
					userAddress: userAddress || 'all',
					marketId: marketId || 'all',
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				error: error instanceof Error ? error.message : 'Query failed',
				note: 'Ensure the Morpho subgraph endpoint is configured',
			},
		}];
	}
}

export async function queryTransactions(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex, '') as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex, '') as string;
	const transactionType = executeFunctions.getNodeParameter('transactionType', itemIndex, 'all') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 100) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	// Build queries based on transaction type
	const queries: string[] = [];

	const buildFilter = () => {
		const conditions: string[] = [];
		if (userAddress) conditions.push(`onBehalf: "${userAddress.toLowerCase()}"`);
		if (marketId) conditions.push(`market: "${marketId}"`);
		return conditions.length > 0 ? `where: { ${conditions.join(', ')} }` : '';
	};

	const filter = buildFilter();

	if (transactionType === 'all' || transactionType === 'supply') {
		queries.push(`
			supplies(first: $first, ${filter}, orderBy: timestamp, orderDirection: desc) {
				id
				hash
				timestamp
				assets
				shares
				onBehalf
				market { id }
			}
		`);
	}

	if (transactionType === 'all' || transactionType === 'borrow') {
		queries.push(`
			borrows(first: $first, ${filter}, orderBy: timestamp, orderDirection: desc) {
				id
				hash
				timestamp
				assets
				shares
				onBehalf
				receiver
				market { id }
			}
		`);
	}

	if (transactionType === 'all' || transactionType === 'repay') {
		queries.push(`
			repays(first: $first, ${filter}, orderBy: timestamp, orderDirection: desc) {
				id
				hash
				timestamp
				assets
				shares
				onBehalf
				market { id }
			}
		`);
	}

	if (transactionType === 'all' || transactionType === 'withdraw') {
		queries.push(`
			withdraws(first: $first, ${filter}, orderBy: timestamp, orderDirection: desc) {
				id
				hash
				timestamp
				assets
				shares
				onBehalf
				receiver
				market { id }
			}
		`);
	}

	const query = `
		query QueryTransactions($first: Int!) {
			${queries.join('\n')}
		}
	`;

	try {
		const result = await subgraph.query(query, { first: limit });

		return [{
			json: {
				supplies: result.supplies || [],
				borrows: result.borrows || [],
				repays: result.repays || [],
				withdraws: result.withdraws || [],
				filters: {
					userAddress: userAddress || 'all',
					marketId: marketId || 'all',
					transactionType,
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				error: error instanceof Error ? error.message : 'Query failed',
				note: 'Ensure the Morpho subgraph endpoint is configured',
			},
		}];
	}
}

export async function queryVaults(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 100) as number;

	const subgraph = getSubgraphClient(executeFunctions);

	const query = `
		query QueryVaults($first: Int!) {
			vaults(first: $first, orderBy: totalAssets, orderDirection: desc) {
				id
				address
				name
				symbol
				asset {
					id
					symbol
					decimals
				}
				totalAssets
				totalSupply
				curator
				guardian
				fee
				feeRecipient
				timelock
				createdAt
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { first: limit });

		return [{
			json: {
				vaults: result.vaults || [],
				count: result.vaults?.length || 0,
			},
		}];
	} catch (error) {
		return [{
			json: {
				error: error instanceof Error ? error.message : 'Query failed',
				note: 'Ensure the Morpho subgraph endpoint is configured',
			},
		}];
	}
}

export async function queryLiquidations(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex, '') as string;
	const limit = executeFunctions.getNodeParameter('limit', itemIndex, 100) as number;
	const timeRange = executeFunctions.getNodeParameter('timeRange', itemIndex, '7d') as string;

	const subgraph = getSubgraphClient(executeFunctions);

	const now = Math.floor(Date.now() / 1000);
	let since: number;

	switch (timeRange) {
		case '24h': since = now - 24 * 60 * 60; break;
		case '7d': since = now - 7 * 24 * 60 * 60; break;
		case '30d': since = now - 30 * 24 * 60 * 60; break;
		default: since = now - 7 * 24 * 60 * 60;
	}

	const filter = marketId
		? `where: { market: "${marketId}", timestamp_gte: ${since} }`
		: `where: { timestamp_gte: ${since} }`;

	const query = `
		query QueryLiquidations($first: Int!) {
			liquidations(first: $first, ${filter}, orderBy: timestamp, orderDirection: desc) {
				id
				hash
				timestamp
				borrower
				liquidator
				repaidAssets
				repaidShares
				seizedAssets
				badDebtAssets
				badDebtShares
				market {
					id
					loanToken { symbol }
					collateralToken { symbol }
				}
			}
		}
	`;

	try {
		const result = await subgraph.query(query, { first: limit });

		const liquidations = result.liquidations || [];

		// Calculate statistics
		const totalRepaid = liquidations.reduce(
			(sum: bigint, l: any) => sum + BigInt(l.repaidAssets || 0), 0n
		);
		const totalSeized = liquidations.reduce(
			(sum: bigint, l: any) => sum + BigInt(l.seizedAssets || 0), 0n
		);
		const totalBadDebt = liquidations.reduce(
			(sum: bigint, l: any) => sum + BigInt(l.badDebtAssets || 0), 0n
		);

		return [{
			json: {
				liquidations,
				count: liquidations.length,
				statistics: {
					totalRepaid: totalRepaid.toString(),
					totalSeized: totalSeized.toString(),
					totalBadDebt: totalBadDebt.toString(),
				},
				filters: {
					marketId: marketId || 'all',
					timeRange,
				},
			},
		}];
	} catch (error) {
		return [{
			json: {
				error: error instanceof Error ? error.message : 'Query failed',
				note: 'Ensure the Morpho subgraph endpoint is configured',
			},
		}];
	}
}

export async function customGraphQLQuery(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const graphqlQuery = executeFunctions.getNodeParameter('graphqlQuery', itemIndex) as string;

	const subgraph = getSubgraphClient(executeFunctions);

	try {
		const result = await subgraph.query(graphqlQuery, {});

		return [{
			json: {
				success: true,
				data: result,
			},
		}];
	} catch (error) {
		return [{
			json: {
				success: false,
				error: error instanceof Error ? error.message : 'Query failed',
				query: graphqlQuery,
				note: 'Ensure your GraphQL query is valid and the subgraph endpoint is configured',
			},
		}];
	}
}

export async function getSubgraphStatus(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const subgraph = getSubgraphClient(executeFunctions);
	const morpho = await getMorphoClient(executeFunctions);

	// Try a simple query to test connectivity
	const testQuery = `
		query SubgraphStatus {
			_meta {
				block {
					number
					hash
				}
				deployment
				hasIndexingErrors
			}
		}
	`;

	try {
		const result = await subgraph.query(testQuery, {});

		return [{
			json: {
				status: 'CONNECTED',
				network: morpho.network,
				endpoint: subgraph.endpoint,
				meta: result._meta || {},
				lastIndexedBlock: result._meta?.block?.number,
				hasIndexingErrors: result._meta?.hasIndexingErrors || false,
			},
		}];
	} catch (error) {
		return [{
			json: {
				status: 'ERROR',
				network: morpho.network,
				endpoint: subgraph.endpoint,
				error: error instanceof Error ? error.message : 'Connection failed',
				troubleshooting: [
					'Verify the subgraph endpoint URL is correct',
					'Check if the subgraph is synced',
					'Ensure network connectivity',
				],
			},
		}];
	}
}

/**
 * Execute subgraph action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'queryMarkets':
			return queryMarkets(executeFunctions, itemIndex);
		case 'queryPositions':
			return queryPositions(executeFunctions, itemIndex);
		case 'queryTransactions':
			return queryTransactions(executeFunctions, itemIndex);
		case 'queryVaults':
			return queryVaults(executeFunctions, itemIndex);
		case 'queryLiquidations':
			return queryLiquidations(executeFunctions, itemIndex);
		case 'customGraphQLQuery':
			return customGraphQLQuery(executeFunctions, itemIndex);
		case 'getSubgraphStatus':
			return getSubgraphStatus(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown subgraph operation: ${operation}`);
	}
}
