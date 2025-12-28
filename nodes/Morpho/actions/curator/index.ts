/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { CURATORS } from '../../constants';

/**
 * Get all known curators
 */
export async function getCurators(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const curators = CURATORS[network] || [];

	return [
		{
			json: {
				network,
				curators: curators.map((c: any) => ({
					address: c.address,
					name: c.name,
					website: c.website,
					description: c.description,
				})),
				count: curators.length,
			},
		},
	];
}

/**
 * Get curator info by address
 */
export async function getCuratorInfo(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const curators = CURATORS[network] || [];
	const curator = curators.find(
		(c: any) => c.address.toLowerCase() === curatorAddress.toLowerCase(),
	);

	if (!curator) {
		return [
			{
				json: {
					address: curatorAddress,
					name: 'Unknown Curator',
					network,
					known: false,
					note: 'Curator not found in known curators registry. May be a valid curator not yet added to the list.',
				},
			},
		];
	}

	return [
		{
			json: {
				address: curator.address,
				name: curator.name,
				website: curator.website,
				description: curator.description,
				network,
				known: true,
			},
		},
	];
}

/**
 * Get vaults managed by a curator
 */
export async function getCuratorVaults(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const { getVaultClient } = await import('../../transport/vaultClient');
	const vaultClient = getVaultClient(this, network);
	const allVaults = vaultClient.getKnownVaults();

	// Filter vaults by curator
	const curatorVaults = allVaults.filter(
		(v: any) => v.curator?.toLowerCase() === curatorAddress.toLowerCase(),
	);

	return [
		{
			json: {
				curatorAddress,
				network,
				vaults: curatorVaults,
				count: curatorVaults.length,
			},
		},
	];
}

/**
 * Get markets curated by a curator (via their vaults)
 */
export async function getCuratorMarkets(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const { getVaultClient } = await import('../../transport/vaultClient');
	const vaultClient = getVaultClient(this, network);
	const allVaults = vaultClient.getKnownVaults();

	// Get curator's vaults
	const curatorVaults = allVaults.filter(
		(v: any) => v.curator?.toLowerCase() === curatorAddress.toLowerCase(),
	);

	// Collect unique markets from curator's vaults
	const marketIds = new Set<string>();
	for (const vault of curatorVaults) {
		if (vault.markets) {
			vault.markets.forEach((m: string) => marketIds.add(m));
		}
	}

	return [
		{
			json: {
				curatorAddress,
				network,
				markets: Array.from(marketIds),
				marketCount: marketIds.size,
				vaultCount: curatorVaults.length,
			},
		},
	];
}

/**
 * Get curator performance metrics
 */
export async function getCuratorPerformance(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const { getVaultClient } = await import('../../transport/vaultClient');
	const vaultClient = getVaultClient(this, network);
	const allVaults = vaultClient.getKnownVaults();

	// Get curator's vaults
	const curatorVaults = allVaults.filter(
		(v: any) => v.curator?.toLowerCase() === curatorAddress.toLowerCase(),
	);

	// Performance metrics require subgraph for historical data
	return [
		{
			json: {
				curatorAddress,
				network,
				vaultCount: curatorVaults.length,
				vaults: curatorVaults.map((v: any) => v.address),
				note: 'Historical performance metrics require subgraph queries. Use the Subgraph resource for detailed performance data.',
			},
		},
	];
}

/**
 * Get curator fee settings
 */
export async function getCuratorFee(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const { getVaultClient } = await import('../../transport/vaultClient');
	const vaultClient = getVaultClient(this, network);
	const allVaults = vaultClient.getKnownVaults();

	// Get curator's vaults with fee info
	const curatorVaults = allVaults.filter(
		(v: any) => v.curator?.toLowerCase() === curatorAddress.toLowerCase(),
	);

	// Fetch fee info for each vault
	const vaultFees = [];
	for (const vault of curatorVaults) {
		try {
			const vaultInfo = await vaultClient.getVaultInfo(vault.address);
			vaultFees.push({
				vault: vault.address,
				vaultName: vault.name,
				fee: vaultInfo.fee,
				feeRecipient: vaultInfo.feeRecipient,
			});
		} catch {
			vaultFees.push({
				vault: vault.address,
				vaultName: vault.name,
				fee: 'Unable to fetch',
			});
		}
	}

	return [
		{
			json: {
				curatorAddress,
				network,
				vaultFees,
				note: 'Fees are set at vault level, not curator level.',
			},
		},
	];
}

/**
 * Get curator history
 */
export async function getCuratorHistory(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const curatorAddress = this.getNodeParameter('curatorAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				curatorAddress,
				network,
				note: 'Historical curator data requires subgraph queries. Use the Subgraph resource with a custom query to retrieve curator history including vault creations, reallocations, and fee changes.',
				suggestedQuery: `{
  metaMorphos(where: { curator: "${curatorAddress.toLowerCase()}" }) {
    id
    address
    name
    createdAt
    totalAssets
  }
}`,
			},
		},
	];
}

/**
 * Route curator operations
 */
export async function executeCuratorOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getCurators':
			return getCurators.call(this, index);
		case 'getCuratorInfo':
			return getCuratorInfo.call(this, index);
		case 'getCuratorVaults':
			return getCuratorVaults.call(this, index);
		case 'getCuratorMarkets':
			return getCuratorMarkets.call(this, index);
		case 'getCuratorPerformance':
			return getCuratorPerformance.call(this, index);
		case 'getCuratorFee':
			return getCuratorFee.call(this, index);
		case 'getCuratorHistory':
			return getCuratorHistory.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown curator operation: ${operation}`,
			);
	}
}
