/**
 * Borrow Resource Actions
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
	createSigner,
	approveToken,
	waitForTransaction,
	getBorrowRate,
	getOraclePrice,
} from '../transport/morphoClient';
import { toBorrowAssets, toBorrowShares } from '../utils/sharesUtils';
import { borrowRateToAPY } from '../utils/rateUtils';
import { formatTokenAmount, calculateAvailableLiquidity, calculateCollateralValue } from '../utils/marketUtils';
import { calculateMaxBorrow, calculateHealthFactor } from '../utils/healthUtils';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
		case 'borrowAssets': {
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

			// Check if user has enough collateral
			const position = await getPosition(config, marketId, onBehalf);
			const marketData = await getMarketData(config, marketId);

			if (position.collateral === BigInt(0)) {
				throw new Error('No collateral supplied. Supply collateral before borrowing.');
			}

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.borrow(
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

		case 'getBorrowBalance': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			return {
				marketId,
				userAddress,
				borrowShares: position.borrowShares.toString(),
				borrowAssets: borrowAssets.toString(),
				borrowAssetsFormatted: formatTokenAmount(borrowAssets, 18),
			};
		}

		case 'getBorrowAPY': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketParams = await getMarketParams(config, marketId);

			let borrowRate;
			try {
				borrowRate = await getBorrowRate(config, marketParams.irm, marketId);
			} catch {
				borrowRate = BigInt(0);
			}

			const borrowAPY = borrowRateToAPY(borrowRate);

			return {
				marketId,
				borrowAPY: `${(borrowAPY * 100).toFixed(2)}%`,
				borrowAPYRaw: borrowAPY,
			};
		}

		case 'getBorrowShares': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);

			return {
				marketId,
				userAddress,
				borrowShares: position.borrowShares.toString(),
			};
		}

		case 'getBorrowedAmount': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			return {
				marketId,
				userAddress,
				borrowedAmount: borrowAssets.toString(),
				borrowedAmountFormatted: formatTokenAmount(borrowAssets, 18),
			};
		}

		case 'repayBorrow': {
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

			// Approve loan token for repayment
			await approveToken(config, marketParams.loanToken, config.morphoBlue, amountWei);

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			const tx = await morpho.repay(
				marketParams,
				amountWei,
				0, // shares
				onBehalf,
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
				onBehalfOf: onBehalf,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'repayMax': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();

			const position = await getPosition(config, marketId, signerAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets === BigInt(0)) {
				return {
					success: false,
					message: 'No outstanding borrow to repay',
				};
			}

			// Add small buffer for interest accrual
			const repayAmount = borrowAssets + (borrowAssets / BigInt(1000)); // +0.1%

			await approveToken(config, marketParams.loanToken, config.morphoBlue, repayAmount);

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;
			// Repay using shares to ensure full repayment
			const tx = await morpho.repay(
				marketParams,
				0, // assets
				position.borrowShares, // repay all shares
				signerAddress,
				'0x',
			);

			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				marketId,
				amountRepaid: borrowAssets.toString(),
				amountRepaidFormatted: formatTokenAmount(borrowAssets, 18),
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'getAvailableToBorrow': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			// Get oracle price
			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				oraclePrice = BigInt(1e36); // Default 1:1 if oracle fails
			}

			// Calculate current borrow
			const currentBorrow = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			// Calculate max borrow based on collateral
			const maxBorrow = calculateMaxBorrow(
				position.collateral,
				oraclePrice,
				marketParams.lltv,
				currentBorrow,
			);

			// Also check market liquidity
			const availableLiquidity = calculateAvailableLiquidity(
				marketData.totalSupplyAssets,
				marketData.totalBorrowAssets,
			);

			const effectiveMax = maxBorrow < availableLiquidity ? maxBorrow : availableLiquidity;

			return {
				marketId,
				userAddress,
				collateral: position.collateral.toString(),
				currentBorrow: currentBorrow.toString(),
				maxBorrowCapacity: maxBorrow.toString(),
				maxBorrowCapacityFormatted: formatTokenAmount(maxBorrow, 18),
				marketLiquidity: availableLiquidity.toString(),
				effectiveMaxBorrow: effectiveMax.toString(),
				effectiveMaxBorrowFormatted: formatTokenAmount(effectiveMax, 18),
			};
		}

		case 'getBorrowPositions': {
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				userAddress,
				note: 'To get all borrow positions across markets, use the Subgraph resource with queryPositions operation.',
			};
		}

		case 'getBorrowCapacity': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketParams = await getMarketParams(config, marketId);

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				oraclePrice = BigInt(1e36);
			}

			// Collateral value calculation
			const collateralValue = calculateCollateralValue(position.collateral, oraclePrice);
			// Max borrow = collateral value * LLTV
			const maxBorrowValue = (collateralValue * marketParams.lltv) / BigInt(1e18);

			return {
				marketId,
				userAddress,
				collateral: position.collateral.toString(),
				collateralValue: collateralValue.toString(),
				lltv: (Number(marketParams.lltv) / 1e18 * 100).toFixed(2) + '%',
				maxBorrowCapacity: maxBorrowValue.toString(),
				maxBorrowCapacityFormatted: formatTokenAmount(maxBorrowValue, 18),
			};
		}

		case 'getBorrowHistory': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				marketId,
				userAddress,
				note: 'Borrow history requires subgraph integration. Use the Subgraph resource for transaction history.',
			};
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
