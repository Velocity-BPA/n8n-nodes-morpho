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
 * Get all governance proposals
 */
export async function getProposals(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;
	const limit = this.getNodeParameter('limit', index, 100) as number;

	return [
		{
			json: {
				network,
				note: 'Governance proposals are stored on-chain and indexed via subgraph. Morpho uses a DAO governance structure.',
				governanceInfo: {
					type: 'Token-weighted voting',
					token: 'MORPHO',
					proposalThreshold: 'Minimum MORPHO required to create proposals',
					votingPeriod: 'Time allowed for voting',
					timelockDelay: 'Delay before execution after passing',
				},
				suggestedQuery: `{
  proposals(first: ${limit}, orderBy: createdAt, orderDirection: desc) {
    id
    proposalId
    proposer
    description
    forVotes
    againstVotes
    abstainVotes
    startBlock
    endBlock
    state
    createdAt
  }
}`,
				externalResources: [
					{
						name: 'Snapshot',
						url: 'https://snapshot.org/#/morpho.eth',
						description: 'Off-chain signaling votes',
					},
					{
						name: 'Tally',
						url: 'https://www.tally.xyz/gov/morpho',
						description: 'On-chain governance dashboard',
					},
				],
			},
		},
	];
}

/**
 * Get a specific proposal
 */
export async function getProposal(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const proposalId = this.getNodeParameter('proposalId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				proposalId,
				network,
				note: 'Query specific proposal from the governance subgraph or contract.',
				suggestedQuery: `{
  proposal(id: "${proposalId}") {
    id
    proposalId
    proposer
    description
    forVotes
    againstVotes
    abstainVotes
    startBlock
    endBlock
    state
    createdAt
    targets
    values
    calldatas
  }
}`,
			},
		},
	];
}

/**
 * Get proposal state
 */
export async function getProposalState(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const proposalId = this.getNodeParameter('proposalId', index) as string;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				proposalId,
				network,
				states: {
					0: 'Pending - Waiting for voting to begin',
					1: 'Active - Currently in voting period',
					2: 'Canceled - Proposal was canceled',
					3: 'Defeated - Did not reach quorum or majority against',
					4: 'Succeeded - Passed and awaiting execution',
					5: 'Queued - In timelock queue',
					6: 'Expired - Timelock expired without execution',
					7: 'Executed - Successfully executed',
				},
				note: 'Query the governance contract state() function with the proposal ID to get current state.',
			},
		},
	];
}

/**
 * Vote on a proposal
 */
export async function voteOnProposal(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const proposalId = this.getNodeParameter('proposalId', index) as string;
	const voteSupport = this.getNodeParameter('voteSupport', index) as number;
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	const morphoClient = getMorphoClient(this, network);
	const config = morphoClient.getConfig();

	if (config.readOnly) {
		throw new NodeOperationError(
			this.getNode(),
			'Cannot vote: No private key provided. Configure credentials with a private key to vote on proposals.',
		);
	}

	const supportTypes = {
		0: 'Against',
		1: 'For',
		2: 'Abstain',
	};

	return [
		{
			json: {
				proposalId,
				voteSupport,
				voteSupportType: supportTypes[voteSupport as keyof typeof supportTypes] || 'Unknown',
				network,
				note: 'Voting requires calling castVote() on the governance contract.',
				governanceContract: CONTRACTS[network]?.GOVERNOR,
				steps: [
					'1. Ensure you have delegated voting power (delegate to self if needed)',
					'2. Check proposal is in Active state',
					'3. Call castVote(proposalId, support) or castVoteWithReason()',
				],
			},
		},
	];
}

/**
 * Get voting power for governance
 */
export async function getGovernanceVotingPower(
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

	const balance = await morphoClient.getTokenBalance(morphoToken, userAddress);
	const votingPower = await morphoClient.getVotingPower(morphoToken, userAddress);
	const delegate = await morphoClient.getDelegate(morphoToken, userAddress);

	return [
		{
			json: {
				userAddress,
				network,
				tokenBalance: balance.toString(),
				tokenBalanceFormatted: (Number(balance) / 1e18).toString(),
				votingPower: votingPower.toString(),
				votingPowerFormatted: (Number(votingPower) / 1e18).toString(),
				delegatedTo: delegate,
				note: votingPower === BigInt(0)
					? 'No voting power. You need to delegate your tokens (can delegate to yourself).'
					: 'Voting power is active and can be used for governance votes.',
			},
		},
	];
}

/**
 * Get vote history for a user
 */
export async function getVoteHistory(
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
				note: 'Vote history is indexed in the governance subgraph.',
				suggestedQuery: `{
  votes(where: { voter: "${userAddress.toLowerCase()}" }, first: ${limit}, orderBy: blockNumber, orderDirection: desc) {
    id
    proposalId
    voter
    support
    weight
    reason
    blockNumber
    transactionHash
  }
}`,
			},
		},
	];
}

/**
 * Get quorum requirements
 */
export async function getQuorum(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				note: 'Quorum is the minimum votes required for a proposal to pass. Query the governance contract for current quorum.',
				quorumInfo: {
					description: 'Minimum percentage of total voting power that must participate',
					typical: '4% of total supply',
					calculation: 'quorum = quorumNumerator * totalSupply / quorumDenominator',
				},
				governanceContract: CONTRACTS[network]?.GOVERNOR,
			},
		},
	];
}

/**
 * Get governance statistics
 */
export async function getGovernanceStats(
	this: IExecuteFunctions,
	index: number,
): Promise<INodeExecutionData[]> {
	const network = this.getNodeParameter('network', index, 'ethereum') as string;

	return [
		{
			json: {
				network,
				note: 'Governance statistics can be aggregated from the subgraph.',
				suggestedQuery: `{
  governance(id: "governance") {
    id
    proposalCount
    currentQuorum
    totalVoters
    totalVotes
  }
  proposals(where: { state: "Executed" }) {
    id
  }
}`,
				externalResources: [
					{
						name: 'Tally Dashboard',
						url: 'https://www.tally.xyz/gov/morpho',
						description: 'Comprehensive governance analytics',
					},
				],
			},
		},
	];
}

/**
 * Delegate votes to another address
 */
export async function delegateVotes(
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
			'Cannot delegate: No private key provided. Configure credentials with a private key to delegate votes.',
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
				operation: 'delegateVotes',
				delegateTo: delegateAddress,
				network,
				transactionHash: tx.hash,
				blockNumber: tx.blockNumber,
				gasUsed: tx.gasUsed?.toString(),
				note: delegateAddress === (await morphoClient.getSignerAddress())
					? 'Delegated voting power to yourself'
					: `Delegated voting power to ${delegateAddress}`,
			},
		},
	];
}

/**
 * Route governance operations
 */
export async function executeGovernanceOperation(
	this: IExecuteFunctions,
	operation: string,
	index: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getProposals':
			return getProposals.call(this, index);
		case 'getProposal':
			return getProposal.call(this, index);
		case 'getProposalState':
			return getProposalState.call(this, index);
		case 'voteOnProposal':
			return voteOnProposal.call(this, index);
		case 'getVotingPower':
			return getGovernanceVotingPower.call(this, index);
		case 'getVoteHistory':
			return getVoteHistory.call(this, index);
		case 'getQuorum':
			return getQuorum.call(this, index);
		case 'getGovernanceStats':
			return getGovernanceStats.call(this, index);
		case 'delegateVotes':
			return delegateVotes.call(this, index);
		default:
			throw new NodeOperationError(
				this.getNode(),
				`Unknown governance operation: ${operation}`,
			);
	}
}
