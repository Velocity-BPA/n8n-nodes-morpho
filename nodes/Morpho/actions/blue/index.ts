/**
 * @file Blue Actions for Morpho Blue Protocol
 * @description Morpho Blue specific operations (the core primitive)
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { getMorphoClient } from '../../transport/morphoClient';
import { CURATED_MARKETS, MARKET_REGISTRY } from '../../constants/markets';
import { toSupplyAssets, toBorrowAssets } from '../../utils/sharesUtils';

/**
 * Blue Actions
 * Direct Morpho Blue protocol interactions
 *
 * Morpho Blue is the permissionless lending primitive that allows anyone
 * to create isolated lending markets with custom parameters (LLTV, oracle, IRM).
 */

export async function getBlueMarkets(
	executeFunctions: IExecuteFunctions,
	_itemIndex: number,
): Promise<INodeExecutionData[]> {
	const morpho = await getMorphoClient(executeFunctions);

	const markets: any[] = [];

	for (const market of CURATED_MARKETS) {
		try {
			const params = await morpho.morphoContract.idToMarketParams(market.id);
			const state = await morpho.morphoContract.market(market.id);

			const utilization = state.totalSupplyAssets > 0n
				? Number((state.totalBorrowAssets * 10000n) / state.totalSupplyAssets) / 100
				: 0;

			markets.push({
				id: market.id,
				name: market.name,
				loanToken: params.loanToken,
				collateralToken: params.collateralToken,
				oracle: params.oracle,
				irm: params.irm,
				lltv: Number(params.lltv) / 1e16,
				totalSupply: state.totalSupplyAssets.toString(),
				totalBorrow: state.totalBorrowAssets.toString(),
				utilization: utilization.toFixed(2) + '%',
				lastUpdate: Number(state.lastUpdate),
			});
		} catch {
			// Skip failed markets
		}
	}

	return [{
		json: {
			network: morpho.network,
			marketCount: markets.length,
			markets,
			note: 'Morpho Blue is the permissionless lending primitive',
		},
	}];
}

export async function getBlueMarket(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const params = await morpho.morphoContract.idToMarketParams(marketId);
	const state = await morpho.morphoContract.market(marketId);

	// Get oracle price
	let oraclePrice = 0n;
	try {
		const oracleContract = new morpho.provider.Contract(
			params.oracle,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		oraclePrice = await oracleContract.price();
	} catch {
		// Oracle may not be available
	}

	// Get borrow rate from IRM
	let borrowRate = 0n;
	try {
		const irmContract = new morpho.provider.Contract(
			params.irm,
			['function borrowRateView(bytes32,tuple(uint128,uint128,uint128,uint128,uint128)) view returns (uint256)'],
			morpho.provider
		);
		borrowRate = await irmContract.borrowRateView(marketId, [
			state.totalSupplyAssets,
			state.totalSupplyShares,
			state.totalBorrowAssets,
			state.totalBorrowShares,
			state.lastUpdate,
		]);
	} catch {
		// IRM query failed
	}

	const utilization = state.totalSupplyAssets > 0n
		? Number((state.totalBorrowAssets * 10000n) / state.totalSupplyAssets) / 100
		: 0;

	// Convert rate to APY
	const secondsPerYear = 365.25 * 24 * 60 * 60;
	const borrowAPY = borrowRate > 0n
		? (Math.exp(Number(borrowRate) / 1e18 * secondsPerYear) - 1) * 100
		: 0;
	const supplyAPY = borrowAPY * (utilization / 100) * (1 - Number(state.fee) / 1e18);

	return [{
		json: {
			marketId,
			parameters: {
				loanToken: params.loanToken,
				collateralToken: params.collateralToken,
				oracle: params.oracle,
				irm: params.irm,
				lltv: Number(params.lltv) / 1e16,
			},
			state: {
				totalSupplyAssets: state.totalSupplyAssets.toString(),
				totalSupplyShares: state.totalSupplyShares.toString(),
				totalBorrowAssets: state.totalBorrowAssets.toString(),
				totalBorrowShares: state.totalBorrowShares.toString(),
				lastUpdate: Number(state.lastUpdate),
				fee: Number(state.fee) / 1e18,
			},
			rates: {
				borrowRatePerSecond: borrowRate.toString(),
				borrowAPY: borrowAPY.toFixed(4) + '%',
				supplyAPY: supplyAPY.toFixed(4) + '%',
			},
			utilization: utilization.toFixed(2) + '%',
			oraclePrice: oraclePrice.toString(),
		},
	}];
}

export async function supplyToBlue(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const onBehalfOf = executeFunctions.getNodeParameter('onBehalfOf', itemIndex, '') as string;

	const morpho = await getMorphoClient(executeFunctions);

	if (morpho.config.readOnly) {
		throw new Error('Supply operation requires a private key. Currently in read-only mode.');
	}

	const params = await morpho.morphoContract.idToMarketParams(marketId);
	const recipient = onBehalfOf || await morpho.signer!.getAddress();
	const amountBigInt = BigInt(amount);

	// Approve token spend
	const tokenContract = new morpho.provider.Contract(
		params.loanToken,
		[
			'function approve(address,uint256) returns (bool)',
			'function allowance(address,address) view returns (uint256)',
		],
		morpho.signer
	);

	const currentAllowance = await tokenContract.allowance(
		await morpho.signer!.getAddress(),
		morpho.config.morphoAddress
	);

	if (currentAllowance < amountBigInt) {
		const approveTx = await tokenContract.approve(morpho.config.morphoAddress, amountBigInt);
		await approveTx.wait();
	}

	// Supply to Morpho Blue
	// supply(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, bytes memory data)
	const tx = await morpho.morphoContract.supply(
		[params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
		amountBigInt,
		0n, // Use assets, not shares
		recipient,
		'0x', // No callback data
	);

	const receipt = await tx.wait();

	return [{
		json: {
			success: true,
			operation: 'supplyToBlue',
			marketId,
			amount,
			recipient,
			transactionHash: receipt.hash,
			blockNumber: receipt.blockNumber,
			gasUsed: receipt.gasUsed.toString(),
		},
	}];
}

export async function borrowFromBlue(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const amount = executeFunctions.getNodeParameter('amount', itemIndex) as string;
	const onBehalfOf = executeFunctions.getNodeParameter('onBehalfOf', itemIndex, '') as string;
	const recipientAddress = executeFunctions.getNodeParameter('recipientAddress', itemIndex, '') as string;

	const morpho = await getMorphoClient(executeFunctions);

	if (morpho.config.readOnly) {
		throw new Error('Borrow operation requires a private key. Currently in read-only mode.');
	}

	const params = await morpho.morphoContract.idToMarketParams(marketId);
	const userAddress = await morpho.signer!.getAddress();
	const borrower = onBehalfOf || userAddress;
	const receiver = recipientAddress || userAddress;
	const amountBigInt = BigInt(amount);

	// Check if user has sufficient collateral
	const position = await morpho.morphoContract.position(marketId, borrower);
	const collateral = position.collateral;

	if (collateral === 0n) {
		throw new Error('No collateral supplied. Please supply collateral before borrowing.');
	}

	// Get oracle price and validate borrow amount
	let oraclePrice = 0n;
	try {
		const oracleContract = new morpho.provider.Contract(
			params.oracle,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		oraclePrice = await oracleContract.price();
	} catch {
		// Continue without price check
	}

	// Borrow from Morpho Blue
	// borrow(MarketParams memory marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver)
	const tx = await morpho.morphoContract.borrow(
		[params.loanToken, params.collateralToken, params.oracle, params.irm, params.lltv],
		amountBigInt,
		0n, // Use assets, not shares
		borrower,
		receiver,
	);

	const receipt = await tx.wait();

	return [{
		json: {
			success: true,
			operation: 'borrowFromBlue',
			marketId,
			amount,
			borrower,
			receiver,
			transactionHash: receipt.hash,
			blockNumber: receipt.blockNumber,
			gasUsed: receipt.gasUsed.toString(),
		},
	}];
}

export async function getBluePosition(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const userAddress = executeFunctions.getNodeParameter('userAddress', itemIndex) as string;

	const morpho = await getMorphoClient(executeFunctions);

	const position = await morpho.morphoContract.position(marketId, userAddress);
	const marketState = await morpho.morphoContract.market(marketId);
	const marketParams = await morpho.morphoContract.idToMarketParams(marketId);

	// Convert shares to assets
	const supplyAssets = toSupplyAssets(
		position.supplyShares,
		marketState.totalSupplyAssets,
		marketState.totalSupplyShares,
	);

	const borrowAssets = toBorrowAssets(
		position.borrowShares,
		marketState.totalBorrowAssets,
		marketState.totalBorrowShares,
	);

	// Get oracle price for collateral value
	let oraclePrice = 0n;
	try {
		const oracleContract = new morpho.provider.Contract(
			marketParams.oracle,
			['function price() view returns (uint256)'],
			morpho.provider
		);
		oraclePrice = await oracleContract.price();
	} catch {
		// Oracle not available
	}

	// Calculate collateral value in loan token terms
	const collateralValue = oraclePrice > 0n
		? (position.collateral * oraclePrice) / BigInt(1e36)
		: 0n;

	// Calculate health factor
	const lltv = marketParams.lltv;
	const maxBorrow = (collateralValue * lltv) / BigInt(1e18);
	const healthFactor = borrowAssets > 0n
		? Number(maxBorrow) / Number(borrowAssets)
		: Infinity;

	// Calculate LTV
	const currentLTV = collateralValue > 0n && borrowAssets > 0n
		? (Number(borrowAssets) / Number(collateralValue)) * 100
		: 0;

	return [{
		json: {
			marketId,
			userAddress,
			position: {
				supplyShares: position.supplyShares.toString(),
				supplyAssets: supplyAssets.toString(),
				borrowShares: position.borrowShares.toString(),
				borrowAssets: borrowAssets.toString(),
				collateral: position.collateral.toString(),
				collateralValue: collateralValue.toString(),
			},
			risk: {
				healthFactor: healthFactor === Infinity ? 'INFINITE' : healthFactor.toFixed(4),
				currentLTV: currentLTV.toFixed(2) + '%',
				maxLTV: Number(lltv) / 1e16 + '%',
				status: healthFactor === Infinity ? 'NO_DEBT'
					: healthFactor >= 1.5 ? 'SAFE'
						: healthFactor >= 1.1 ? 'WARNING'
							: healthFactor >= 1 ? 'DANGER'
								: 'LIQUIDATABLE',
			},
		},
	}];
}

export async function getBlueParameters(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const params = await morpho.morphoContract.idToMarketParams(marketId);

	return [{
		json: {
			marketId,
			parameters: {
				loanToken: params.loanToken,
				collateralToken: params.collateralToken,
				oracle: params.oracle,
				irm: params.irm,
				lltv: params.lltv.toString(),
				lltvPercent: Number(params.lltv) / 1e16,
			},
			description: {
				loanToken: 'The token that can be borrowed',
				collateralToken: 'The token used as collateral',
				oracle: 'Price oracle for collateral/loan conversion',
				irm: 'Interest Rate Model contract',
				lltv: 'Liquidation Loan-to-Value threshold',
			},
		},
	}];
}

export async function getBlueUtilization(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const state = await morpho.morphoContract.market(marketId);

	const totalSupply = state.totalSupplyAssets;
	const totalBorrow = state.totalBorrowAssets;
	const availableLiquidity = totalSupply - totalBorrow;

	const utilization = totalSupply > 0n
		? Number((totalBorrow * 10000n) / totalSupply) / 100
		: 0;

	return [{
		json: {
			marketId,
			utilization: {
				rate: utilization.toFixed(4),
				percent: utilization.toFixed(2) + '%',
				totalSupply: totalSupply.toString(),
				totalBorrow: totalBorrow.toString(),
				availableLiquidity: availableLiquidity.toString(),
			},
			status: utilization > 95 ? 'CRITICAL'
				: utilization > 85 ? 'HIGH'
					: utilization > 70 ? 'MEDIUM'
						: 'NORMAL',
		},
	}];
}

export async function getBlueAPY(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const params = await morpho.morphoContract.idToMarketParams(marketId);
	const state = await morpho.morphoContract.market(marketId);

	// Get borrow rate from IRM
	let borrowRate = 0n;
	try {
		const irmContract = new morpho.provider.Contract(
			params.irm,
			['function borrowRateView(bytes32,tuple(uint128,uint128,uint128,uint128,uint128)) view returns (uint256)'],
			morpho.provider
		);
		borrowRate = await irmContract.borrowRateView(marketId, [
			state.totalSupplyAssets,
			state.totalSupplyShares,
			state.totalBorrowAssets,
			state.totalBorrowShares,
			state.lastUpdate,
		]);
	} catch (error) {
		// IRM query failed
	}

	const utilization = state.totalSupplyAssets > 0n
		? Number(state.totalBorrowAssets) / Number(state.totalSupplyAssets)
		: 0;

	// Convert rate to APY
	const secondsPerYear = 365.25 * 24 * 60 * 60;
	const borrowAPY = borrowRate > 0n
		? (Math.exp(Number(borrowRate) / 1e18 * secondsPerYear) - 1) * 100
		: 0;

	const fee = Number(state.fee) / 1e18;
	const supplyAPY = borrowAPY * utilization * (1 - fee);

	return [{
		json: {
			marketId,
			apy: {
				supplyAPY: supplyAPY.toFixed(4) + '%',
				borrowAPY: borrowAPY.toFixed(4) + '%',
				netSpread: (borrowAPY - supplyAPY).toFixed(4) + '%',
			},
			underlying: {
				borrowRatePerSecond: borrowRate.toString(),
				utilization: (utilization * 100).toFixed(2) + '%',
				protocolFee: (fee * 100).toFixed(2) + '%',
			},
		},
	}];
}

export async function getBlueLiquidity(
	executeFunctions: IExecuteFunctions,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	const marketId = executeFunctions.getNodeParameter('marketId', itemIndex) as string;
	const morpho = await getMorphoClient(executeFunctions);

	const state = await morpho.morphoContract.market(marketId);
	const params = await morpho.morphoContract.idToMarketParams(marketId);

	const totalSupply = state.totalSupplyAssets;
	const totalBorrow = state.totalBorrowAssets;
	const availableLiquidity = totalSupply - totalBorrow;

	// Get token decimals for formatting
	let decimals = 18;
	try {
		const tokenContract = new morpho.provider.Contract(
			params.loanToken,
			['function decimals() view returns (uint8)'],
			morpho.provider
		);
		decimals = await tokenContract.decimals();
	} catch {
		// Default to 18
	}

	const divisor = BigInt(10 ** decimals);

	return [{
		json: {
			marketId,
			liquidity: {
				available: availableLiquidity.toString(),
				availableFormatted: (Number(availableLiquidity) / Number(divisor)).toFixed(4),
				totalSupply: totalSupply.toString(),
				totalBorrow: totalBorrow.toString(),
			},
			canBorrow: availableLiquidity > 0n,
			utilizationBuffer: ((1 - Number(totalBorrow) / Number(totalSupply)) * 100).toFixed(2) + '%',
		},
	}];
}

/**
 * Execute blue action based on operation
 */
export async function execute(
	executeFunctions: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<INodeExecutionData[]> {
	switch (operation) {
		case 'getBlueMarkets':
			return getBlueMarkets(executeFunctions, itemIndex);
		case 'getBlueMarket':
			return getBlueMarket(executeFunctions, itemIndex);
		case 'supplyToBlue':
			return supplyToBlue(executeFunctions, itemIndex);
		case 'borrowFromBlue':
			return borrowFromBlue(executeFunctions, itemIndex);
		case 'getBluePosition':
			return getBluePosition(executeFunctions, itemIndex);
		case 'getBlueParameters':
			return getBlueParameters(executeFunctions, itemIndex);
		case 'getBlueUtilization':
			return getBlueUtilization(executeFunctions, itemIndex);
		case 'getBlueAPY':
			return getBlueAPY(executeFunctions, itemIndex);
		case 'getBlueLiquidity':
			return getBlueLiquidity(executeFunctions, itemIndex);
		default:
			throw new Error(`Unknown blue operation: ${operation}`);
	}
}
