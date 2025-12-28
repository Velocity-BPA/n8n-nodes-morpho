/**
 * Morpho Subgraph Client
 *
 * [Velocity BPA Licensing Notice]
 *
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 *
 * Use of this node by for-profit organizations in production environments requires
 * a commercial license from Velocity BPA.
 *
 * For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.
 */

import { GraphQLClient, gql } from 'graphql-request';
import { NETWORKS, getNetworkConfig, type NetworkConfig } from '../constants/networks';

// Subgraph endpoint URLs
export const SUBGRAPH_ENDPOINTS = {
	ethereum: 'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue',
	base: 'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue-base',
} as const;

// Query result types
export interface SubgraphMarket {
	id: string;
	loanToken: {
		id: string;
		symbol: string;
		decimals: number;
	};
	collateralToken: {
		id: string;
		symbol: string;
		decimals: number;
	};
	oracle: string;
	irm: string;
	lltv: string;
	totalSupplyAssets: string;
	totalSupplyShares: string;
	totalBorrowAssets: string;
	totalBorrowShares: string;
	fee: string;
	lastUpdate: string;
}

export interface SubgraphPosition {
	id: string;
	user: string;
	market: {
		id: string;
		loanToken: { symbol: string };
		collateralToken: { symbol: string };
	};
	supplyShares: string;
	borrowShares: string;
	collateral: string;
}

export interface SubgraphTransaction {
	id: string;
	hash: string;
	timestamp: string;
	blockNumber: string;
	type: string;
	user: string;
	market: { id: string };
	assets: string;
	shares: string;
}

export interface SubgraphVault {
	id: string;
	name: string;
	symbol: string;
	asset: { id: string; symbol: string };
	curator: string;
	guardian: string;
	totalAssets: string;
	totalShares: string;
	fee: string;
}

export interface SubgraphLiquidation {
	id: string;
	hash: string;
	timestamp: string;
	liquidator: string;
	borrower: string;
	market: { id: string };
	repaidAssets: string;
	repaidShares: string;
	seizedAssets: string;
	badDebtAssets: string;
	badDebtShares: string;
}

// GraphQL Queries
const MARKETS_QUERY = gql`
	query GetMarkets($first: Int!, $skip: Int!, $orderBy: String, $orderDirection: String) {
		markets(first: $first, skip: $skip, orderBy: $orderBy, orderDirection: $orderDirection) {
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
			fee
			lastUpdate
		}
	}
`;

const MARKET_BY_ID_QUERY = gql`
	query GetMarket($id: ID!) {
		market(id: $id) {
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
			fee
			lastUpdate
		}
	}
`;

const POSITIONS_QUERY = gql`
	query GetPositions($first: Int!, $skip: Int!, $where: Position_filter) {
		positions(first: $first, skip: $skip, where: $where) {
			id
			user
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

const POSITIONS_BY_USER_QUERY = gql`
	query GetPositionsByUser($user: String!) {
		positions(where: { user: $user }) {
			id
			user
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

const TRANSACTIONS_QUERY = gql`
	query GetTransactions($first: Int!, $skip: Int!, $where: Transaction_filter, $orderBy: String, $orderDirection: String) {
		transactions(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
			id
			hash
			timestamp
			blockNumber
			type
			user
			market {
				id
			}
			assets
			shares
		}
	}
`;

const VAULTS_QUERY = gql`
	query GetVaults($first: Int!, $skip: Int!) {
		metaMorphoVaults(first: $first, skip: $skip) {
			id
			name
			symbol
			asset {
				id
				symbol
			}
			curator
			guardian
			totalAssets
			totalShares
			fee
		}
	}
`;

const VAULT_BY_ADDRESS_QUERY = gql`
	query GetVault($id: ID!) {
		metaMorphoVault(id: $id) {
			id
			name
			symbol
			asset {
				id
				symbol
			}
			curator
			guardian
			totalAssets
			totalShares
			fee
		}
	}
`;

const LIQUIDATIONS_QUERY = gql`
	query GetLiquidations($first: Int!, $skip: Int!, $where: Liquidation_filter, $orderBy: String, $orderDirection: String) {
		liquidations(first: $first, skip: $skip, where: $where, orderBy: $orderBy, orderDirection: $orderDirection) {
			id
			hash
			timestamp
			liquidator
			borrower
			market {
				id
			}
			repaidAssets
			repaidShares
			seizedAssets
			badDebtAssets
			badDebtShares
		}
	}
`;

const SUBGRAPH_STATUS_QUERY = gql`
	query GetStatus {
		_meta {
			block {
				number
				timestamp
			}
			deployment
			hasIndexingErrors
		}
	}
`;

/**
 * Create a GraphQL client for a specific network
 */
export function createSubgraphClient(network: string, customEndpoint?: string): GraphQLClient {
	const endpoint = customEndpoint || SUBGRAPH_ENDPOINTS[network as keyof typeof SUBGRAPH_ENDPOINTS];

	if (!endpoint) {
		throw new Error(`No subgraph endpoint configured for network: ${network}`);
	}

	return new GraphQLClient(endpoint, {
		headers: {
			'Content-Type': 'application/json',
		},
	});
}

/**
 * Query markets from the subgraph
 */
export async function queryMarkets(
	client: GraphQLClient,
	options: {
		first?: number;
		skip?: number;
		orderBy?: string;
		orderDirection?: 'asc' | 'desc';
	} = {},
): Promise<SubgraphMarket[]> {
	const { first = 100, skip = 0, orderBy = 'totalSupplyAssets', orderDirection = 'desc' } = options;

	const response = await client.request<{ markets: SubgraphMarket[] }>(MARKETS_QUERY, {
		first,
		skip,
		orderBy,
		orderDirection,
	});

	return response.markets;
}

/**
 * Query a specific market by ID
 */
export async function queryMarketById(client: GraphQLClient, marketId: string): Promise<SubgraphMarket | null> {
	const response = await client.request<{ market: SubgraphMarket | null }>(MARKET_BY_ID_QUERY, {
		id: marketId.toLowerCase(),
	});

	return response.market;
}

/**
 * Query positions from the subgraph
 */
export async function queryPositions(
	client: GraphQLClient,
	options: {
		first?: number;
		skip?: number;
		user?: string;
		marketId?: string;
		hasSupply?: boolean;
		hasBorrow?: boolean;
	} = {},
): Promise<SubgraphPosition[]> {
	const { first = 100, skip = 0, user, marketId, hasSupply, hasBorrow } = options;

	const where: Record<string, unknown> = {};
	if (user) where.user = user.toLowerCase();
	if (marketId) where.market = marketId.toLowerCase();
	if (hasSupply) where.supplyShares_gt = '0';
	if (hasBorrow) where.borrowShares_gt = '0';

	const response = await client.request<{ positions: SubgraphPosition[] }>(POSITIONS_QUERY, {
		first,
		skip,
		where: Object.keys(where).length > 0 ? where : undefined,
	});

	return response.positions;
}

/**
 * Query positions by user address
 */
export async function queryPositionsByUser(client: GraphQLClient, userAddress: string): Promise<SubgraphPosition[]> {
	const response = await client.request<{ positions: SubgraphPosition[] }>(POSITIONS_BY_USER_QUERY, {
		user: userAddress.toLowerCase(),
	});

	return response.positions;
}

/**
 * Query transactions from the subgraph
 */
export async function queryTransactions(
	client: GraphQLClient,
	options: {
		first?: number;
		skip?: number;
		user?: string;
		marketId?: string;
		type?: string;
		orderBy?: string;
		orderDirection?: 'asc' | 'desc';
	} = {},
): Promise<SubgraphTransaction[]> {
	const {
		first = 100,
		skip = 0,
		user,
		marketId,
		type,
		orderBy = 'timestamp',
		orderDirection = 'desc',
	} = options;

	const where: Record<string, unknown> = {};
	if (user) where.user = user.toLowerCase();
	if (marketId) where.market = marketId.toLowerCase();
	if (type) where.type = type;

	const response = await client.request<{ transactions: SubgraphTransaction[] }>(TRANSACTIONS_QUERY, {
		first,
		skip,
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy,
		orderDirection,
	});

	return response.transactions;
}

/**
 * Query vaults from the subgraph
 */
export async function queryVaults(
	client: GraphQLClient,
	options: {
		first?: number;
		skip?: number;
	} = {},
): Promise<SubgraphVault[]> {
	const { first = 100, skip = 0 } = options;

	const response = await client.request<{ metaMorphoVaults: SubgraphVault[] }>(VAULTS_QUERY, {
		first,
		skip,
	});

	return response.metaMorphoVaults;
}

/**
 * Query a specific vault by address
 */
export async function queryVaultByAddress(client: GraphQLClient, vaultAddress: string): Promise<SubgraphVault | null> {
	const response = await client.request<{ metaMorphoVault: SubgraphVault | null }>(VAULT_BY_ADDRESS_QUERY, {
		id: vaultAddress.toLowerCase(),
	});

	return response.metaMorphoVault;
}

/**
 * Query liquidations from the subgraph
 */
export async function queryLiquidations(
	client: GraphQLClient,
	options: {
		first?: number;
		skip?: number;
		liquidator?: string;
		borrower?: string;
		marketId?: string;
		orderBy?: string;
		orderDirection?: 'asc' | 'desc';
	} = {},
): Promise<SubgraphLiquidation[]> {
	const {
		first = 100,
		skip = 0,
		liquidator,
		borrower,
		marketId,
		orderBy = 'timestamp',
		orderDirection = 'desc',
	} = options;

	const where: Record<string, unknown> = {};
	if (liquidator) where.liquidator = liquidator.toLowerCase();
	if (borrower) where.borrower = borrower.toLowerCase();
	if (marketId) where.market = marketId.toLowerCase();

	const response = await client.request<{ liquidations: SubgraphLiquidation[] }>(LIQUIDATIONS_QUERY, {
		first,
		skip,
		where: Object.keys(where).length > 0 ? where : undefined,
		orderBy,
		orderDirection,
	});

	return response.liquidations;
}

/**
 * Get subgraph indexing status
 */
export async function getSubgraphStatus(client: GraphQLClient): Promise<{
	blockNumber: number;
	blockTimestamp: number;
	deployment: string;
	hasIndexingErrors: boolean;
}> {
	const response = await client.request<{
		_meta: {
			block: { number: string; timestamp: string };
			deployment: string;
			hasIndexingErrors: boolean;
		};
	}>(SUBGRAPH_STATUS_QUERY);

	return {
		blockNumber: parseInt(response._meta.block.number, 10),
		blockTimestamp: parseInt(response._meta.block.timestamp, 10),
		deployment: response._meta.deployment,
		hasIndexingErrors: response._meta.hasIndexingErrors,
	};
}

/**
 * Execute a custom GraphQL query
 */
export async function customQuery<T>(
	client: GraphQLClient,
	query: string,
	variables?: Record<string, unknown>,
): Promise<T> {
	return client.request<T>(query, variables);
}

/**
 * Helper to create subgraph client from n8n credentials
 */
export function createSubgraphClientFromCredentials(
	networkCredentials: { network: string; subgraphEndpoint?: string },
	apiCredentials?: { subgraphEthereumUrl?: string; subgraphBaseUrl?: string },
): GraphQLClient {
	const { network, subgraphEndpoint } = networkCredentials;

	// Use custom endpoint if provided
	if (subgraphEndpoint) {
		return createSubgraphClient(network, subgraphEndpoint);
	}

	// Use API credentials endpoint if available
	if (apiCredentials) {
		if (network === 'ethereum' && apiCredentials.subgraphEthereumUrl) {
			return createSubgraphClient(network, apiCredentials.subgraphEthereumUrl);
		}
		if (network === 'base' && apiCredentials.subgraphBaseUrl) {
			return createSubgraphClient(network, apiCredentials.subgraphBaseUrl);
		}
	}

	// Use default endpoint
	return createSubgraphClient(network);
}
