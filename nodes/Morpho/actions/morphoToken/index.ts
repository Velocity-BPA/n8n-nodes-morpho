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

// ERC20 ABI for basic token operations
const ERC20_ABI = [
	'function balanceOf(address) view returns (uint256)',
	'function totalSupply() view returns (uint256)',
	'function transfer(address to, uint256 amount) returns (bool)',
	'function decimals() view returns (uint8)',
	'function symbol() view returns (string)',
	'function name() view returns (string)',
];

// MORPHO Token ABI (includes delegation)
const MORPHO_TOKEN_ABI = [
	...ERC20_ABI,
	'function delegates(address) view returns (address)',
	'function delegate(address delegatee)',
	'function getVotes(address) view returns (uint256)',
	'function getPastVotes(address, uint256) view returns (uint256)',
];

/**
 * Get MORPHO token balance
 */
export async function getMORPHOBalance(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const morphoToken = CONTRACTS[network]?.MORPHO;

	if (!morphoToken) {
		throw new NodeOperationError(
			this.getNode(),
			`MORPHO token address not configured for network: ${network}`,
		);
	}

	const balance = await morphoClient.getTokenBalance(morphoToken, userAddress);

	return [
		{
			json: {
				userAddress,
				network,
				tokenAddress: morphoToken,
				balance: balance.toString(),
				balanceFormatted: (Number(balance) / 1e18).toString(),
				symbol: 'MORPHO',
				decimals: 18,
			},
		},
	];
}

/**
 * Transfer MORPHO tokens
 */
export async function transferMORPHO(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const recipientAddress = this.getNodeParameter('recipientAddress', index) as string;
	const amount = this.getNodeParameter('amount', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const config = morphoClient.getConfig();

	if (config.readOnly) {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot transfer: No private key provided. Configure credentials with a private key to transfer tokens.',
		);
	}

	const morphoToken = CONTRACTS[network]?.MORPHO;

	if (!morphoToken) {
		throw new NodeOperationError(
			this.getNode(),
			`MORPHO token address not configured for network: ${network}`,
		);
	}

	const tx = await morphoClient.transferToken(morphoToken, recipientAddress, BigInt(amount));

	return [
		{
			json: {
				success: true,
				operation: 'transfer',
				tokenAddress: morphoToken,
				symbol: 'MORPHO',
				recipient: recipientAddress,
				amount,
				amountFormatted: (Number(amount) / 1e18).toString(),
				transactionHash: tx.hash,
				blockNumber: tx.blockNumber,
				gasUsed: tx.gasUsed?.toString(),
			},
		},
	];
}

/**
 * Get MORPHO token price
 */
export async function getMORPHOPrice(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				symbol: 'MORPHO',
				note: 'MORPHO token price is available from DEX aggregators and price APIs.',
				sources: [
					{
						name: 'CoinGecko',
						url: 'https://api.coingecko.com/api/v3/simple/price?ids=morpho&vs_currencies=usd',
					},
					{
						name: 'DeFi Llama',
						url: 'https://coins.llama.fi/prices/current/ethereum:' + CONTRACTS[network]?.MORPHO,
					},
				],
				tokenAddress: CONTRACTS[network]?.MORPHO,
			},
		},
	];
}

/**
 * Get MORPHO total supply
 */
export async function getMORPHOSupply(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const morphoToken = CONTRACTS[network]?.MORPHO;

	if (!morphoToken) {
		return [
			{
				json: {
					network,
					note: 'MORPHO token address not configured for this network',
				},
			},
		];
	}

	const totalSupply = await morphoClient.getTokenTotalSupply(morphoToken);

	return [
		{
			json: {
				network,
				tokenAddress: morphoToken,
				symbol: 'MORPHO',
				totalSupply: totalSupply.toString(),
				totalSupplyFormatted: (Number(totalSupply) / 1e18).toString(),
				decimals: 18,
			},
		},
	];
}

/**
 * Get MORPHO circulating supply
 */
export async function getMORPHOCirculating(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				note: 'Circulating supply requires tracking vesting schedules and locked tokens. Check CoinGecko or Morpho documentation for circulating supply data.',
				sources: [
					{
						name: 'CoinGecko',
						url: 'https://www.coingecko.com/en/coins/morpho',
					},
					{
						name: 'Morpho Docs',
						url: 'https://docs.morpho.org/governance/morpho-token',
					},
				],
			},
		},
	];
}

/**
 * Get MORPHO token distribution info
 */
export async function getTokenDistribution(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				symbol: 'MORPHO',
				distribution: {
					note: 'MORPHO token distribution is detailed in Morpho documentation',
					categories: [
						'Team & Advisors',
						'Investors',
						'Community & Ecosystem',
						'Protocol Treasury',
						'Liquidity Mining',
					],
				},
				source: 'https://docs.morpho.org/governance/morpho-token',
			},
		},
	];
}

/**
 * Get vesting schedule
 */
export async function getVestingSchedule(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index, '') as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				userAddress: userAddress || undefined,
				network,
				note: 'Vesting schedules are managed through vesting contracts. Query specific vesting contract for details.',
				vestingInfo: {
					description: 'MORPHO tokens may be subject to vesting for team, advisors, and investors',
					typicalVesting: '4 years with 1 year cliff',
				},
			},
		},
	];
}

/**
 * Delegate MORPHO tokens
 */
export async function delegateMORPHO(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const delegateAddress = this.getNodeParameter('delegateAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const config = morphoClient.getConfig();

	if (config.readOnly) {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot delegate: No private key provided. Configure credentials with a private key to delegate tokens.',
		);
	}

	const morphoToken = CONTRACTS[network]?.MORPHO;

	if (!morphoToken) {
		throw new NodeOperationError(
			this.getNode(),
			`MORPHO token address not configured for network: ${network}`,
		);
	}

	const tx = await morphoClient.delegateToken(morphoToken, delegateAddress);

	return [
		{
			json: {
				success: true,
				operation: 'delegate',
				tokenAddress: morphoToken,
				symbol: 'MORPHO',
				delegateTo: delegateAddress,
				transactionHash: tx.hash,
				blockNumber: tx.blockNumber,
				gasUsed: tx.gasUsed?.toString(),
			},
		},
	];
}

/**
 * Get voting power
 */
export async function getVotingPower(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const userAddress = this.getNodeParameter('userAddress', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const morphoToken = CONTRACTS[network]?.MORPHO;

	if (!morphoToken) {
		return [
			{
				json: {
					userAddress,
					network,
					note: 'MORPHO token address not configured for this network',
				},
			},
		];
	}

	// Get balance and delegated votes
	const balance = await morphoClient.getTokenBalance(morphoToken, userAddress);
	const votingPower = await morphoClient.getVotingPower(morphoToken, userAddress);
	const delegate = await morphoClient.getDelegate(morphoToken, userAddress);

	return [
		{
			json: {
				userAddress,
				network,
				tokenAddress: morphoToken,
				symbol: 'MORPHO',
				balance: balance.toString(),
				balanceFormatted: (Number(balance) / 1e18).toString(),
				votingPower: votingPower.toString(),
				votingPowerFormatted: (Number(votingPower) / 1e18).toString(),
				delegatedTo: delegate,
				selfDelegated:
					delegate.toLowerCase() === userAddress.toLowerCase(),
			},
		},
	];
}

/**
 * Route MORPHO token operations
 */
export async function executeMorphoTokenOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getMORPHOBalance':
			return getMORPHOBalance.call(this, index);
		case 'transferMORPHO':
			return transferMORPHO.call(this, index);
		case 'getMORPHOPrice':
			return getMORPHOPrice.call(this, index);
		case 'getMORPHOSupply':
			return getMORPHOSupply.call(this, index);
		case 'getMORPHOCirculating':
			return getMORPHOCirculating.call(this, index);
		case 'getTokenDistribution':
			return getTokenDistribution.call(this, index);
		case 'getVestingSchedule':
			return getVestingSchedule.call(this, index);
		case 'delegateMORPHO':
			return delegateMORPHO.call(this, index);
		case 'getVotingPower':
			return getVotingPower.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown MORPHO token operation: ${operation}`,
			);
	}
}
