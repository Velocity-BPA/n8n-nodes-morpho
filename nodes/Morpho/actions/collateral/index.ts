/**
 * Collateral Resource Actions
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
	getOraclePrice,
} from '../transport/morphoClient';
import { toBorrowAssets } from '../utils/sharesUtils';
import { formatTokenAmount, formatLLTV, calculateCollateralValue } from '../utils/marketUtils';
import { calculateHealthFactor, calculateMaxWithdrawCollateral } from '../utils/healthUtils';
import { getMarketsByNetwork } from '../constants/markets';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
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
				collateralToken: marketParams.collateralToken,
				amount,
				amountWei: amountWei.toString(),
				recipient,
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

			// Check health factor after withdrawal
			const position = await getPosition(config, marketId, onBehalf);
			const marketData = await getMarketData(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets > BigInt(0)) {
				// Need to verify withdrawal won't cause liquidation
				let oraclePrice;
				try {
					oraclePrice = await getOraclePrice(config, marketParams.oracle);
				} catch {
					oraclePrice = BigInt(1e36);
				}

				const remainingCollateral = position.collateral - amountWei;
				const newHealthFactor = calculateHealthFactor(
					remainingCollateral,
					oraclePrice,
					marketParams.lltv,
					borrowAssets,
				);

				if (newHealthFactor < 1) {
					throw new Error(
						`Withdrawal would cause liquidation. Health factor would be ${newHealthFactor.toFixed(4)}. ` +
						`Maximum safe withdrawal: ${formatTokenAmount(calculateMaxWithdrawCollateral(position.collateral, oraclePrice, marketParams.lltv, borrowAssets), 18)}`
					);
				}
			}

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
				collateralToken: marketParams.collateralToken,
				amount,
				amountWei: amountWei.toString(),
				receiver: signerAddress,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'getCollateralBalance': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketParams = await getMarketParams(config, marketId);

			return {
				marketId,
				userAddress,
				collateralToken: marketParams.collateralToken,
				collateral: position.collateral.toString(),
				collateralFormatted: formatTokenAmount(position.collateral, 18),
			};
		}

		case 'getCollateralValue': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketParams = await getMarketParams(config, marketId);

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				return {
					marketId,
					userAddress,
					collateral: position.collateral.toString(),
					error: 'Could not fetch oracle price',
				};
			}

			const collateralValue = calculateCollateralValue(position.collateral, oraclePrice);

			return {
				marketId,
				userAddress,
				collateralToken: marketParams.collateralToken,
				collateral: position.collateral.toString(),
				collateralFormatted: formatTokenAmount(position.collateral, 18),
				oraclePrice: oraclePrice.toString(),
				collateralValue: collateralValue.toString(),
				collateralValueFormatted: formatTokenAmount(collateralValue, 18),
			};
		}

		case 'getCollateralFactor': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketParams = await getMarketParams(config, marketId);

			return {
				marketId,
				lltv: marketParams.lltv.toString(),
				lltvPercent: formatLLTV(marketParams.lltv),
				description: 'LLTV (Liquidation Loan-to-Value) is the maximum LTV ratio before liquidation',
			};
		}

		case 'getLiquidationLTV': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			const marketParams = await getMarketParams(config, marketId);

			return {
				marketId,
				liquidationLTV: marketParams.lltv.toString(),
				liquidationLTVPercent: formatLLTV(marketParams.lltv),
				description: 'Position is liquidatable when LTV exceeds this threshold',
			};
		}

		case 'getCollateralMarkets': {
			const collateralToken = this.getNodeParameter('collateralToken', itemIndex) as string;

			// Search known markets for the collateral token
			const ethereumMarkets = getMarketsByNetwork('ethereum');
			const baseMarkets = getMarketsByNetwork('base');

			const allMarkets = [...ethereumMarkets, ...baseMarkets];
			const matchingMarkets = allMarkets.filter(
				m => m.collateralToken.toLowerCase() === collateralToken.toLowerCase()
			);

			return {
				collateralToken,
				marketsCount: matchingMarkets.length,
				markets: matchingMarkets.map(m => ({
					id: m.id,
					name: m.name,
					loanToken: m.loanToken,
					lltv: formatLLTV(m.lltv),
				})),
			};
		}

		case 'getCollateralPositions': {
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				userAddress,
				note: 'To get all collateral positions across markets, use the Subgraph resource with queryPositions operation.',
			};
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
