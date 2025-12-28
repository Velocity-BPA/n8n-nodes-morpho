/**
 * Supply Resource Actions
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use of this node by for-profit organizations in production environments
 * requires a commercial license from Velocity BPA.
 * For licensing information, visit https://velobpa.com/licensing
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { ethers } from 'ethers';
import {
	getConfigFromCredentials,
	getMarketData,
	getMarketParams,
	getPosition,
	getMorphoBlueContract,
	getERC20Contract,
	createSigner,
	approveToken,
	waitForTransaction,
	getBorrowRate,
} from '../transport/morphoClient';
import { toSupplyAssets, toSupplyShares } from '../utils/sharesUtils';
import { calculateUtilization, borrowRateToAPY, calculateSupplyAPY } from '../utils/rateUtils';
import { formatTokenAmount, calculateAvailableLiquidity } from '../utils/marketUtils';
import { MORPHO_BLUE_ABI } from '../constants/contracts';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
		case 'supplyAssets': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const recipient = onBehalfOf || signerAddress;

			// Get market params to know the loan token
			const marketParams = await getMarketParams(config, marketId);
			const amountWei = ethers.parseUnits(amount, 18); // Assuming 18 decimals

			// Approve token spending
			await approveToken(config, marketParams.loanToken, config.morphoBlue, amountWei);

			// Supply to market
			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.supply(
				marketParams,
				amountWei,
				0, // shares (0 = use assets)
				recipient,
				'0x', // data
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amount,
				amountWei: amountWei.toString(),
				recipient,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'supplyCollateral': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const recipient = onBehalfOf || signerAddress;

			const marketParams = await getMarketParams(config, marketId);
			const amountWei = ethers.parseUnits(amount, 18);

			// Approve collateral token spending
			await approveToken(config, marketParams.collateralToken, config.morphoBlue, amountWei);

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.supplyCollateral(
				marketParams,
				amountWei,
				recipient,
				'0x',
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amount,
				amountWei: amountWei.toString(),
				recipient,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'getSupplyBalance': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);

			// Convert shares to assets
			const supplyAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			return {
				marketId,
				userAddress,
				supplyShares: position.supplyShares.toString(),
				supplyAssets: supplyAssets.toString(),
				supplyAssetsFormatted: formatTokenAmount(supplyAssets, 18),
			};
		}

		case 'getSupplyAPY': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			let borrowRate;
			try {
				borrowRate = await getBorrowRate(config, marketParams.irm, marketId);
			} catch {
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
				supplyAPY: `${(supplyAPY * 100).toFixed(2)}%`,
				supplyAPYRaw: supplyAPY,
				utilization: `${(utilization * 100).toFixed(2)}%`,
				fee: `${(Number(marketData.fee) / 1e16).toFixed(2)}%`,
			};
		}

		case 'getSupplyShares': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);

			return {
				marketId,
				userAddress,
				supplyShares: position.supplyShares.toString(),
			};
		}

		case 'getSuppliedAmount': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);

			const supplyAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			return {
				marketId,
				userAddress,
				suppliedAmount: supplyAssets.toString(),
				suppliedAmountFormatted: formatTokenAmount(supplyAssets, 18),
			};
		}

		case 'withdrawAssets': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const onBehalf = onBehalfOf || signerAddress;

			const marketParams = await getMarketParams(config, marketId);
			const amountWei = ethers.parseUnits(amount, 18);

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.withdraw(
				marketParams,
				amountWei,
				0, // shares
				onBehalf,
				signerAddress, // receiver
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amount,
				amountWei: amountWei.toString(),
				receiver: signerAddress,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'withdrawCollateral': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const onBehalf = onBehalfOf || signerAddress;

			const marketParams = await getMarketParams(config, marketId);
			const amountWei = ethers.parseUnits(amount, 18);

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.withdrawCollateral(
				marketParams,
				amountWei,
				onBehalf,
				signerAddress,
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amount,
				amountWei: amountWei.toString(),
				receiver: signerAddress,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'withdrawMax': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();

			// Get current position
			const position = await getPosition(config, marketId, signerAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			// Calculate max withdrawable
			const availableLiquidity = calculateAvailableLiquidity(
				marketData.totalSupplyAssets,
				marketData.totalBorrowAssets,
			);

			const userAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			const maxWithdraw = userAssets < availableLiquidity ? userAssets : availableLiquidity;

			if (maxWithdraw === BigInt(0)) {
				return {
					success: false,
					message: 'No assets available to withdraw',
					userSupply: userAssets.toString(),
					availableLiquidity: availableLiquidity.toString(),
				};
			}

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.withdraw(
				marketParams,
				maxWithdraw,
				0,
				signerAddress,
				signerAddress,
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amountWithdrawn: maxWithdraw.toString(),
				amountFormatted: formatTokenAmount(maxWithdraw, 18),
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'getAvailableToWithdraw': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);

			const userAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			const availableLiquidity = calculateAvailableLiquidity(
				marketData.totalSupplyAssets,
				marketData.totalBorrowAssets,
			);

			const maxWithdraw = userAssets < availableLiquidity ? userAssets : availableLiquidity;

			return {
				marketId,
				userAddress,
				userSupply: userAssets.toString(),
				userSupplyFormatted: formatTokenAmount(userAssets, 18),
				availableLiquidity: availableLiquidity.toString(),
				availableLiquidityFormatted: formatTokenAmount(availableLiquidity, 18),
				maxWithdrawable: maxWithdraw.toString(),
				maxWithdrawableFormatted: formatTokenAmount(maxWithdraw, 18),
			};
		}

		case 'getSupplyPositions': {
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			// This requires subgraph to get all positions
			return {
				userAddress,
				note: 'To get all supply positions across markets, use the Subgraph resource with queryPositions operation.',
			};
		}

		case 'getSupplyHistory': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				marketId,
				userAddress,
				note: 'Supply history requires subgraph integration. Use the Subgraph resource for transaction history.',
			};
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
