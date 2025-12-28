/**
 * @file Bundler Actions for Morpho DeFi Protocol
 * @description Batch transaction operations via Morpho Bundler
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { getBundlerClient } from '../../transport/bundlerClient';

/**
 * Bundler Actions
 * The Morpho Bundler allows batching multiple actions into a single transaction
 *
 * Benefits:
 * - Atomicity: All actions succeed or all fail
 * - Gas efficiency: Single transaction overhead
 * - Complex operations: Migration, leverage, etc.
 */

// Bundle storage for building complex transactions
interface BundleAction {
	type: string;
	params: any;
}

const pendingBundles: Map<string, BundleAction[]> = new Map();

export async function createBundle(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = `bundle_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

	pendingBundles.set(bundleId, []);

	return [{
		json: {
			bundleId,
			status: 'CREATED',
			actions: [],
			message: 'Bundle created. Add actions using addSupplyAction, addBorrowAction, etc.',
			usage: {
				addAction: 'Use add*Action operations to add actions to the bundle',
				execute: 'Use executeBundle to execute all actions atomically',
			},
		},
	}];
}

export async function addSupplyAction(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const onBehalfOf = executeFunctions.getNodeParameter('onBehalfOf', itemIndex, '') as string;

	const bundle = pendingBundles.get(bundleId);
	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found. Create a bundle first.`);
	}

	const action: BundleAction = {
		type: 'SUPPLY',
		params: {
			marketId,
			amount,
			onBehalfOf: onBehalfOf || 'self',
		},
	};

	bundle.push(action);

	return [{
		json: {
			bundleId,
			actionAdded: action,
			totalActions: bundle.length,
			allActions: bundle,
		},
	}];
}

export async function addBorrowAction(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const receiver = executeFunctions.getNodeParameter('recipientAddress', itemIndex, '') as string;

	const bundle = pendingBundles.get(bundleId);
	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found. Create a bundle first.`);
	}

	const action: BundleAction = {
		type: 'BORROW',
		params: {
			marketId,
			amount,
			receiver: receiver || 'self',
		},
	};

	bundle.push(action);

	return [{
		json: {
			bundleId,
			actionAdded: action,
			totalActions: bundle.length,
			allActions: bundle,
		},
	}];
}

export async function addRepayAction(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const onBehalfOf = executeFunctions.getNodeParameter('onBehalfOf', itemIndex, '') as string;

	const bundle = pendingBundles.get(bundleId);
	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found. Create a bundle first.`);
	}

	const action: BundleAction = {
		type: 'REPAY',
		params: {
			marketId,
			amount,
			onBehalfOf: onBehalfOf || 'self',
		},
	};

	bundle.push(action);

	return [{
		json: {
			bundleId,
			actionAdded: action,
			totalActions: bundle.length,
			allActions: bundle,
		},
	}];
}

export async function addWithdrawAction(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const receiver = executeFunctions.getNodeParameter('recipientAddress', itemIndex, '') as string;

	const bundle = pendingBundles.get(bundleId);
	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found. Create a bundle first.`);
	}

	const action: BundleAction = {
		type: 'WITHDRAW',
		params: {
			marketId,
			amount,
			receiver: receiver || 'self',
		},
	};

	bundle.push(action);

	return [{
		json: {
			bundleId,
			actionAdded: action,
			totalActions: bundle.length,
			allActions: bundle,
		},
	}];
}

export async function executeBundle(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;

	const bundle = pendingBundles.get(bundleId);
	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found.`);
	}

	if (bundle.length === 0) {
		throw new Error('Bundle is empty. Add actions before executing.');
	}

	const morpho = await getMorphoClient(executeFunctions);

	if (morpho.config.readOnly) {
		throw new Error('Bundle execution requires a private key. Currently in read-only mode.');
	}

	// Get bundler client
	const bundler = await getBundlerClient(executeFunctions);

	// Build multicall data
	const multicallData: string[] = [];

	for (const action of bundle) {
		const params = await morpho.morphoContract.idToMarketParams(action.params.marketId);
		const marketParams = [
			params.loanToken,
			params.collateralToken,
			params.oracle,
			params.irm,
			params.lltv,
		];

		switch (action.type) {
			case 'SUPPLY':
				// Encode supply call
				multicallData.push(
					bundler.bundlerContract.interface.encodeFunctionData('morphoSupply', [
						marketParams,
						BigInt(action.params.amount),
						0n,
						0n,
						action.params.onBehalfOf === 'self'
							? await morpho.signer!.getAddress()
							: action.params.onBehalfOf,
						'0x',
					])
				);
				break;

			case 'BORROW':
				multicallData.push(
					bundler.bundlerContract.interface.encodeFunctionData('morphoBorrow', [
						marketParams,
						BigInt(action.params.amount),
						0n,
						0n,
						action.params.receiver === 'self'
							? await morpho.signer!.getAddress()
							: action.params.receiver,
					])
				);
				break;

			case 'REPAY':
				multicallData.push(
					bundler.bundlerContract.interface.encodeFunctionData('morphoRepay', [
						marketParams,
						BigInt(action.params.amount),
						0n,
						0n,
						action.params.onBehalfOf === 'self'
							? await morpho.signer!.getAddress()
							: action.params.onBehalfOf,
						'0x',
					])
				);
				break;

			case 'WITHDRAW':
				multicallData.push(
					bundler.bundlerContract.interface.encodeFunctionData('morphoWithdraw', [
						marketParams,
						BigInt(action.params.amount),
						0n,
						0n,
						action.params.receiver === 'self'
							? await morpho.signer!.getAddress()
							: action.params.receiver,
					])
				);
				break;
		}
	}

	// Execute multicall
	const tx = await bundler.bundlerContract.multicall(multicallData);
	const receipt = await tx.wait();

	// Clean up bundle
	pendingBundles.delete(bundleId);

	return [{
		json: {
			bundleId,
			status: 'EXECUTED',
			actionsExecuted: bundle.length,
			actions: bundle,
			transaction: {
				hash: receipt.hash,
				blockNumber: receipt.blockNumber,
				gasUsed: receipt.gasUsed.toString(),
			},
		},
	}];
}

export async function getBundleStatus(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;

	const bundle = pendingBundles.get(bundleId);

	if (!bundle) {
		return [{
			json: {
				bundleId,
				status: 'NOT_FOUND',
				message: 'Bundle not found or already executed',
			},
		}];
	}

	return [{
		json: {
			bundleId,
			status: 'PENDING',
			actionCount: bundle.length,
			actions: bundle,
			canExecute: bundle.length > 0,
		},
	}];
}

export async function estimateBundleGas(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const bundleId = executeFunctions.getNodeParameter('bundleId', itemIndex) as string;

	const bundle = pendingBundles.get(bundleId);

	if (!bundle) {
		throw new Error(`Bundle ${bundleId} not found.`);
	}

	if (bundle.length === 0) {
		return [{
			json: {
				bundleId,
				estimatedGas: 0,
				message: 'Bundle is empty',
			},
		}];
	}

	// Estimate gas based on action types
	const gasPerAction: Record<string, number> = {
		SUPPLY: 150000,
		BORROW: 200000,
		REPAY: 180000,
		WITHDRAW: 160000,
	};

	// Base multicall overhead
	let totalGas = 50000;

	for (const action of bundle) {
		totalGas += gasPerAction[action.type] || 200000;
	}

	const morpho = await getMorphoClient(executeFunctions);
	const gasPrice = await morpho.provider.getFeeData();
	const gasPriceGwei = gasPrice.gasPrice
		? Number(gasPrice.gasPrice) / 1e9
		: 30;

	const estimatedCostWei = BigInt(totalGas) * (gasPrice.gasPrice || 30000000000n);
	const estimatedCostEth = Number(estimatedCostWei) / 1e18;

	return [{
		json: {
			bundleId,
			actionCount: bundle.length,
			estimatedGas: totalGas,
			gasPrice: gasPriceGwei.toFixed(2) + ' gwei',
			estimatedCost: estimatedCostEth.toFixed(6) + ' ETH',
			breakdown: bundle.map(a => ({
				type: a.type,
				estimatedGas: gasPerAction[a.type] || 200000,
			})),
			note: 'Gas estimate is approximate. Actual gas may vary.',
		},
	}];
}

/**
 * Execute bundler action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'createBundle':
			return createBundle(executeFunctions, itemIndex);
		case 'addSupplyAction':
			return addSupplyAction(executeFunctions, itemIndex);
		case 'addBorrowAction':
			return addBorrowAction(executeFunctions, itemIndex);
		case 'addRepayAction':
			return addRepayAction(executeFunctions, itemIndex);
		case 'addWithdrawAction':
			return addWithdrawAction(executeFunctions, itemIndex);
		case 'executeBundle':
			return executeBundle(executeFunctions, itemIndex);
		case 'getBundleStatus':
			return getBundleStatus(executeFunctions, itemIndex);
		case 'estimateBundleGas':
			return estimateBundleGas(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown bundler operation: ${operation}`);
	}
}
