/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { NodeOperationError } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { CONTRACTS } from '../../constants';

/**
 * Get rewards info for a market or vault
 */
export async function getRewardsInfo(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index, '') as string;
	const vaultAddress = this.getNodeParameter('vaultAddress', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				marketId: marketId || undefined,
				vaultAddress: vaultAddress || undefined,
				network,
				note: 'Morpho rewards are distributed through the Universal Rewards Distributor (URD). Query the URD contract or subgraph for reward details.',
				urdAddress: CONTRACTS[network]?.URD,
				suggestedQuery: marketId
					? `{
  rewardPrograms(where: { market: "${marketId}" }) {
    id
    rewardToken
    totalDistributed
    startTime
    endTime
    rewardPerSecond
  }
}`
					: `{
  rewardPrograms(where: { vault: "${vaultAddress?.toLowerCase()}" }) {
    id
    rewardToken
    totalDistributed
    startTime
    endTime
    rewardPerSecond
  }
}`,
			},
		},
	];
}

/**
 * Get claimable rewards for a user
 */
export async function getClaimableRewards(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const urdAddress = CONTRACTS[network]?.URD;

	return [
		{
			json: {
				userAddress,
				network,
				urdAddress,
				note: 'Claimable rewards require querying the Universal Rewards Distributor. Rewards are calculated off-chain and submitted as Merkle roots.',
				howToClaim: [
					'1. Check the Morpho rewards API for your claimable amounts',
					'2. Get the Merkle proof for your rewards',
					'3. Call claim() on the URD with the proof',
				],
				rewardsApi: 'https://rewards.morpho.org/v1/users/{address}/rewards',
			},
		},
	];
}

/**
 * Claim rewards
 */
export async function claimRewards(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const config = morphoClient.getConfig();

	if (config.readOnly) {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot claim rewards: No private key provided. Configure credentials with a private key to claim rewards.',
		);
	}

	return [
		{
			json: {
				userAddress,
				network,
				note: 'Claiming rewards requires a Merkle proof from the rewards API. Implementation would need to:',
				steps: [
					'1. Fetch claimable rewards from Morpho rewards API',
					'2. Get Merkle proof for the claim',
					'3. Call URD.claim() with the proof',
				],
				urdAddress: CONTRACTS[network]?.URD,
				rewardsApi: `https://rewards.morpho.org/v1/users/${userAddress}/rewards`,
			},
		},
	];
}

/**
 * Get reward rate for a market or vault
 */
export async function getRewardRate(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index, '') as string;
	const vaultAddress = this.getNodeParameter('vaultAddress', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				marketId: marketId || undefined,
				vaultAddress: vaultAddress || undefined,
				network,
				note: 'Reward rates are set by reward program creators. Query the subgraph for active reward programs.',
				suggestedQuery: `{
  rewardPrograms(where: { active: true }) {
    id
    market { id }
    vault { address }
    rewardToken
    rewardPerSecond
    startTime
    endTime
  }
}`,
			},
		},
	];
}

/**
 * Get reward token info
 */
export async function getRewardToken(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoToken = CONTRACTS[network]?.MORPHO;

	return [
		{
			json: {
				network,
				morphoToken,
				note: 'MORPHO is the primary reward token, but reward programs can use any ERC20 token.',
				commonRewardTokens: [
					{
						symbol: 'MORPHO',
						address: morphoToken,
						description: 'Morpho governance token',
					},
				],
			},
		},
	];
}

/**
 * Get reward history
 */
export async function getRewardHistory(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const limit = this.getNodeParameter('limit', index, 100) as number;

	return [
		{
			json: {
				userAddress,
				network,
				note: 'Reward claim history can be queried from the subgraph.',
				suggestedQuery: `{
  rewardClaims(where: { user: "${userAddress.toLowerCase()}" }, first: ${limit}, orderBy: timestamp, orderDirection: desc) {
    id
    timestamp
    rewardToken
    amount
    transactionHash
  }
}`,
			},
		},
	];
}

/**
 * Get total distributed rewards
 */
export async function getTotalDistributed(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				note: 'Total distributed rewards can be aggregated from the subgraph.',
				suggestedQuery: `{
  rewardPrograms {
    id
    rewardToken
    totalDistributed
    totalClaimed
  }
  _meta {
    block { number timestamp }
  }
}`,
			},
		},
	];
}

/**
 * Get rewards by market
 */
export async function getRewardByMarket(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const marketId = this.getNodeParameter('marketId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				marketId,
				network,
				note: 'Market-specific rewards are tracked in reward programs.',
				suggestedQuery: `{
  rewardPrograms(where: { market: "${marketId}" }) {
    id
    rewardToken
    rewardPerSecond
    totalDistributed
    startTime
    endTime
    active
  }
}`,
			},
		},
	];
}

/**
 * Get rewards by vault
 */
export async function getRewardByVault(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const vaultAddress = this.getNodeParameter('vaultAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				vaultAddress,
				network,
				note: 'Vault-specific rewards are tracked in reward programs. Vault depositors receive rewards proportional to their share.',
				suggestedQuery: `{
  rewardPrograms(where: { vault: "${vaultAddress.toLowerCase()}" }) {
    id
    rewardToken
    rewardPerSecond
    totalDistributed
    startTime
    endTime
    active
  }
}`,
			},
		},
	];
}

/**
 * Route rewards operations
 */
export async function executeRewardsOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getRewardsInfo':
			return getRewardsInfo.call(this, index);
		case 'getClaimableRewards':
			return getClaimableRewards.call(this, index);
		case 'claimRewards':
			return claimRewards.call(this, index);
		case 'getRewardRate':
			return getRewardRate.call(this, index);
		case 'getRewardToken':
			return getRewardToken.call(this, index);
		case 'getRewardHistory':
			return getRewardHistory.call(this, index);
		case 'getTotalDistributed':
			return getTotalDistributed.call(this, index);
		case 'getRewardByMarket':
			return getRewardByMarket.call(this, index);
		case 'getRewardByVault':
			return getRewardByVault.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown rewards operation: ${operation}`,
			);
	}
}
