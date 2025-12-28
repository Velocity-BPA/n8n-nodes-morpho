/**
 * Position Resource Actions
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
	getBorrowRate,
} from '../transport/morphoClient';
import { toSupplyAssets, toBorrowAssets } from '../utils/sharesUtils';
import { formatTokenAmount, calculateCollateralValue } from '../utils/marketUtils';
import {
	calculateHealthFactor,
	calculateLiquidationPrice,
	calculateLTV,
	formatHealthFactor,
	getHealthStatus,
	isLiquidatable,
} from '../utils/healthUtils';
import { borrowRateToAPY, calculateSupplyAPY, calculateUtilization } from '../utils/rateUtils';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
		case 'getPosition': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;
			const includeUsd = this.getNodeParameter('includeUsd', itemIndex, true) as boolean;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const supplyAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			let healthFactor = null;
			let liquidationPrice = null;
			let collateralValue = null;
			let ltv = null;

			if (position.collateral > BigInt(0) || borrowAssets > BigInt(0)) {
				let oraclePrice;
				try {
					oraclePrice = await getOraclePrice(config, marketParams.oracle);
				} catch {
					oraclePrice = BigInt(1e36);
				}

				if (borrowAssets > BigInt(0)) {
					healthFactor = calculateHealthFactor(
						position.collateral,
						oraclePrice,
						marketParams.lltv,
						borrowAssets,
					);
					liquidationPrice = calculateLiquidationPrice(
						position.collateral,
						oraclePrice,
						marketParams.lltv,
						borrowAssets,
					);
					ltv = calculateLTV(position.collateral, oraclePrice, borrowAssets);
				}

				if (position.collateral > BigInt(0)) {
					collateralValue = calculateCollateralValue(position.collateral, oraclePrice);
				}
			}

			const result: any = {
				marketId,
				userAddress,
				supply: {
					shares: position.supplyShares.toString(),
					assets: supplyAssets.toString(),
					assetsFormatted: formatTokenAmount(supplyAssets, 18),
				},
				borrow: {
					shares: position.borrowShares.toString(),
					assets: borrowAssets.toString(),
					assetsFormatted: formatTokenAmount(borrowAssets, 18),
				},
				collateral: {
					amount: position.collateral.toString(),
					amountFormatted: formatTokenAmount(position.collateral, 18),
				},
			};

			if (healthFactor !== null) {
				result.healthFactor = formatHealthFactor(healthFactor);
				result.healthFactorRaw = healthFactor;
				result.healthStatus = getHealthStatus(healthFactor);
				result.isLiquidatable = healthFactor < 1;
			}

			if (liquidationPrice !== null) {
				result.liquidationPrice = liquidationPrice.toString();
			}

			if (ltv !== null) {
				result.ltv = `${(ltv * 100).toFixed(2)}%`;
				result.ltvRaw = ltv;
			}

			if (collateralValue !== null) {
				result.collateral.value = collateralValue.toString();
				result.collateral.valueFormatted = formatTokenAmount(collateralValue, 18);
			}

			return result;
		}

		case 'getPositionsByUser': {
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				userAddress,
				note: 'To get all positions for a user across markets, use the Subgraph resource with queryPositions operation.',
			};
		}

		case 'getPositionHealth': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets === BigInt(0)) {
				return {
					marketId,
					userAddress,
					healthFactor: 'Infinity',
					status: 'SAFE',
					message: 'No active borrow position',
				};
			}

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				throw new Error('Could not fetch oracle price');
			}

			const healthFactor = calculateHealthFactor(
				position.collateral,
				oraclePrice,
				marketParams.lltv,
				borrowAssets,
			);

			return {
				marketId,
				userAddress,
				collateral: position.collateral.toString(),
				borrowAssets: borrowAssets.toString(),
				lltv: (Number(marketParams.lltv) / 1e18 * 100).toFixed(2) + '%',
				healthFactor: formatHealthFactor(healthFactor),
				healthFactorRaw: healthFactor,
				status: getHealthStatus(healthFactor),
				isLiquidatable: healthFactor < 1,
				safetyMargin: healthFactor > 1 ? `${((healthFactor - 1) * 100).toFixed(2)}%` : '0%',
			};
		}

		case 'getPositionValue': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const supplyAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				oraclePrice = BigInt(1e36);
			}

			const collateralValue = calculateCollateralValue(position.collateral, oraclePrice);

			// Net position value = supply + collateral value - borrow
			const netValue = supplyAssets + collateralValue - borrowAssets;

			return {
				marketId,
				userAddress,
				supplyValue: supplyAssets.toString(),
				collateralValue: collateralValue.toString(),
				borrowValue: borrowAssets.toString(),
				netValue: netValue.toString(),
				netValueFormatted: formatTokenAmount(netValue, 18),
			};
		}

		case 'getCollateralizationRatio': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets === BigInt(0)) {
				return {
					marketId,
					userAddress,
					collateralizationRatio: 'Infinity',
					message: 'No borrow position - fully collateralized',
				};
			}

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				oraclePrice = BigInt(1e36);
			}

			const collateralValue = calculateCollateralValue(position.collateral, oraclePrice);
			const ratio = Number(collateralValue) / Number(borrowAssets);

			return {
				marketId,
				userAddress,
				collateralValue: collateralValue.toString(),
				borrowValue: borrowAssets.toString(),
				collateralizationRatio: `${(ratio * 100).toFixed(2)}%`,
				collateralizationRatioRaw: ratio,
				minRequired: (Number(marketParams.lltv) / 1e18 * 100).toFixed(2) + '%',
			};
		}

		case 'getLiquidationPrice': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets === BigInt(0)) {
				return {
					marketId,
					userAddress,
					liquidationPrice: 'N/A',
					message: 'No borrow position',
				};
			}

			let oraclePrice;
			try {
				oraclePrice = await getOraclePrice(config, marketParams.oracle);
			} catch {
				throw new Error('Could not fetch oracle price');
			}

			const liquidationPrice = calculateLiquidationPrice(
				position.collateral,
				oraclePrice,
				marketParams.lltv,
				borrowAssets,
			);

			const currentPriceDecimal = Number(oraclePrice) / 1e36;
			const liquidationPriceDecimal = Number(liquidationPrice) / 1e36;
			const dropToLiquidation = ((currentPriceDecimal - liquidationPriceDecimal) / currentPriceDecimal) * 100;

			return {
				marketId,
				userAddress,
				currentPrice: currentPriceDecimal.toString(),
				liquidationPrice: liquidationPriceDecimal.toString(),
				priceDropToLiquidation: `${dropToLiquidation.toFixed(2)}%`,
			};
		}

		case 'getPositionAPY': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const position = await getPosition(config, marketId, userAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const supplyAssets = toSupplyAssets(
				position.supplyShares,
				marketData.totalSupplyAssets,
				marketData.totalSupplyShares,
			);

			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

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

			// Calculate net APY based on position
			const supplyEarnings = Number(supplyAssets) * supplyAPY;
			const borrowCost = Number(borrowAssets) * borrowAPY;
			const netAPY = supplyAssets > BigInt(0)
				? (supplyEarnings - borrowCost) / Number(supplyAssets)
				: 0;

			return {
				marketId,
				userAddress,
				supplyAPY: `${(supplyAPY * 100).toFixed(2)}%`,
				borrowAPY: `${(borrowAPY * 100).toFixed(2)}%`,
				netAPY: `${(netAPY * 100).toFixed(2)}%`,
				supplyValue: supplyAssets.toString(),
				borrowValue: borrowAssets.toString(),
			};
		}

		case 'getPositionPnL': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				marketId,
				userAddress,
				note: 'PnL calculation requires historical entry data. Use the Subgraph resource to query transaction history and calculate PnL.',
			};
		}

		case 'getPositionHistory': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				marketId,
				userAddress,
				note: 'Position history requires subgraph integration. Use the Subgraph resource for transaction history.',
			};
		}

		case 'getAllPositions': {
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			return {
				userAddress,
				note: 'To get all positions across all markets, use the Subgraph resource with queryPositions operation.',
			};
		}

		case 'closePosition': {
			const marketId = this.getNodeParameter('marketId', itemIndex) as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();

			const position = await getPosition(config, marketId, signerAddress);
			const marketData = await getMarketData(config, marketId);
			const marketParams = await getMarketParams(config, marketId);

			const results: any = {
				marketId,
				userAddress: signerAddress,
				steps: [],
			};

			const morpho = getMorphoBlueContract(config).connect(signer) as ethers.Contract;

			// Step 1: Repay all borrow if any
			const borrowAssets = toBorrowAssets(
				position.borrowShares,
				marketData.totalBorrowAssets,
				marketData.totalBorrowShares,
			);

			if (borrowAssets > BigInt(0)) {
				const repayAmount = borrowAssets + (borrowAssets / BigInt(100)); // Add 1% buffer
				await approveToken(config, marketParams.loanToken, config.morphoBlue, repayAmount);

				const repayTx = await morpho.repay(
					marketParams,
					0,
					position.borrowShares,
					signerAddress,
					'0x',
				);
				const repayReceipt = await waitForTransaction(config, repayTx.hash);
				results.steps.push({
					action: 'repay',
					amount: borrowAssets.toString(),
					txHash: repayTx.hash,
				});
			}

			// Step 2: Withdraw all collateral
			if (position.collateral > BigInt(0)) {
				const withdrawCollateralTx = await morpho.withdrawCollateral(
					marketParams,
					position.collateral,
					signerAddress,
					signerAddress,
				);
				await waitForTransaction(config, withdrawCollateralTx.hash);
				results.steps.push({
					action: 'withdrawCollateral',
					amount: position.collateral.toString(),
					txHash: withdrawCollateralTx.hash,
				});
			}

			// Step 3: Withdraw all supply
			if (position.supplyShares > BigInt(0)) {
				const supplyAssets = toSupplyAssets(
					position.supplyShares,
					marketData.totalSupplyAssets,
					marketData.totalSupplyShares,
				);

				const withdrawTx = await morpho.withdraw(
					marketParams,
					0,
					position.supplyShares,
					signerAddress,
					signerAddress,
				);
				await waitForTransaction(config, withdrawTx.hash);
				results.steps.push({
					action: 'withdraw',
					amount: supplyAssets.toString(),
					txHash: withdrawTx.hash,
				});
			}

			results.success = true;
			results.message = 'Position closed successfully';

			return results;
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
