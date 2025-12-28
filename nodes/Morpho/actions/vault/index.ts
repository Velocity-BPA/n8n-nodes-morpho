/**
 * Vault (MetaMorpho) Resource Actions
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use of this node by for-profit organizations in production environments
 * requires a commercial license from Velocity BPA.
 * For licensing information, visit https://velobpa.com/licensing
 */

import { IExecuteFunctions } from 'n8n-workflow';
import { ethers } from 'ethers';
import { getConfigFromCredentials, createSigner, approveToken, waitForTransaction } from '../transport/morphoClient';
import {
	getVaultContract,
	getVaultInfo,
	getVaultBalance,
	getSupplyQueue,
	getWithdrawQueue,
	getMarketConfig,
	previewDeposit,
	previewWithdraw,
	maxDeposit,
	maxWithdraw,
	deposit,
	withdraw,
	convertToAssets,
	convertToShares,
	getIdleAssets,
} from '../transport/vaultClient';
import { formatTokenAmount } from '../utils/marketUtils';
import { getVaultsByNetwork, getVaultByAddress as getVaultByAddressConst, getCuratorByAddress } from '../constants/vaults';

export async function execute(
	this: IExecuteFunctions,
	operation: string,
	itemIndex: number,
): Promise<any> {
	const config = await getConfigFromCredentials.call(this);

	switch (operation) {
		case 'getVaults': {
			const network = this.getNodeParameter('network', itemIndex, 'ethereum') as string;
			const asset = this.getNodeParameter('asset', itemIndex, '') as string;
			const limit = this.getNodeParameter('limit', itemIndex, 10) as number;

			let vaults = getVaultsByNetwork(network);

			if (asset) {
				vaults = vaults.filter(v => v.asset.toLowerCase() === asset.toLowerCase());
			}

			return vaults.slice(0, limit).map(v => ({
				address: v.address,
				name: v.name,
				symbol: v.symbol,
				asset: v.asset,
				curator: v.curator,
				network,
			}));
		}

		case 'getVaultInfo': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);
			const knownVault = getVaultByAddressConst(vaultAddress);

			return {
				address: vaultAddress,
				name: knownVault?.name || 'Unknown Vault',
				symbol: knownVault?.symbol || 'N/A',
				asset: info.asset,
				totalAssets: info.totalAssets.toString(),
				totalAssetsFormatted: formatTokenAmount(info.totalAssets, 18),
				totalSupply: info.totalSupply.toString(),
				curator: info.curator,
				guardian: info.guardian,
				fee: `${(Number(info.fee) / 1e16).toFixed(2)}%`,
				feeRecipient: info.feeRecipient,
				timelock: info.timelock.toString(),
			};
		}

		case 'getVaultByAddress': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);
			const knownVault = getVaultByAddressConst(vaultAddress);
			const curatorInfo = getCuratorByAddress(info.curator);

			return {
				address: vaultAddress,
				name: knownVault?.name || 'Unknown Vault',
				symbol: knownVault?.symbol || 'N/A',
				asset: info.asset,
				totalAssets: info.totalAssets.toString(),
				totalAssetsFormatted: formatTokenAmount(info.totalAssets, 18),
				totalSupply: info.totalSupply.toString(),
				curator: {
					address: info.curator,
					name: curatorInfo?.name || 'Unknown',
				},
				guardian: info.guardian,
				fee: `${(Number(info.fee) / 1e16).toFixed(2)}%`,
				feeRecipient: info.feeRecipient,
				timelock: info.timelock.toString(),
			};
		}

		case 'getVaultAPY': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			// APY calculation requires historical data or real-time rate tracking
			const info = await getVaultInfo(config, vaultAddress);

			return {
				vaultAddress,
				totalAssets: info.totalAssets.toString(),
				fee: `${(Number(info.fee) / 1e16).toFixed(2)}%`,
				note: 'Vault APY calculation requires integration with historical data or rate tracking. Use analytics tools for accurate APY.',
			};
		}

		case 'getVaultTVL': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);

			return {
				vaultAddress,
				tvl: info.totalAssets.toString(),
				tvlFormatted: formatTokenAmount(info.totalAssets, 18),
				asset: info.asset,
			};
		}

		case 'getVaultAllocation': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const supplyQueue = await getSupplyQueue(config, vaultAddress);
			const withdrawQueue = await getWithdrawQueue(config, vaultAddress);
			const info = await getVaultInfo(config, vaultAddress);

			return {
				vaultAddress,
				totalAssets: info.totalAssets.toString(),
				supplyQueue: supplyQueue.map(m => m.toString()),
				supplyQueueLength: supplyQueue.length,
				withdrawQueue: withdrawQueue.map(m => m.toString()),
				withdrawQueueLength: withdrawQueue.length,
			};
		}

		case 'getVaultMarkets': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const supplyQueue = await getSupplyQueue(config, vaultAddress);

			const markets = [];
			for (const marketId of supplyQueue) {
				try {
					const marketConfig = await getMarketConfig(config, vaultAddress, marketId.toString());
					markets.push({
						marketId: marketId.toString(),
						cap: marketConfig.cap.toString(),
						enabled: marketConfig.enabled,
						removableAt: marketConfig.removableAt.toString(),
					});
				} catch {
					markets.push({
						marketId: marketId.toString(),
						error: 'Could not fetch market config',
					});
				}
			}

			return {
				vaultAddress,
				marketsCount: markets.length,
				markets,
			};
		}

		case 'getVaultCap': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);
			const maxDep = await maxDeposit(config, vaultAddress, ethers.ZeroAddress);

			return {
				vaultAddress,
				currentDeposits: info.totalAssets.toString(),
				maxDeposit: maxDep.toString(),
				availableCapacity: (maxDep - info.totalAssets).toString(),
			};
		}

		case 'getVaultQueue': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const supplyQueue = await getSupplyQueue(config, vaultAddress);
			const withdrawQueue = await getWithdrawQueue(config, vaultAddress);

			return {
				vaultAddress,
				supplyQueue: supplyQueue.map((m, i) => ({
					position: i,
					marketId: m.toString(),
				})),
				withdrawQueue: withdrawQueue.map((m, i) => ({
					position: i,
					marketId: m.toString(),
				})),
			};
		}

		case 'getVaultFee': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);

			return {
				vaultAddress,
				fee: info.fee.toString(),
				feePercent: `${(Number(info.fee) / 1e16).toFixed(2)}%`,
				feeRecipient: info.feeRecipient,
			};
		}

		case 'getVaultCurator': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);
			const curatorInfo = getCuratorByAddress(info.curator);

			return {
				vaultAddress,
				curator: info.curator,
				curatorName: curatorInfo?.name || 'Unknown',
				curatorWebsite: curatorInfo?.website || 'N/A',
				guardian: info.guardian,
			};
		}

		case 'getVaultPerformance': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;

			const info = await getVaultInfo(config, vaultAddress);
			const idleAssets = await getIdleAssets(config, vaultAddress);

			return {
				vaultAddress,
				totalAssets: info.totalAssets.toString(),
				totalSupply: info.totalSupply.toString(),
				idleAssets: idleAssets.toString(),
				utilization: info.totalAssets > BigInt(0)
					? `${((1 - Number(idleAssets) / Number(info.totalAssets)) * 100).toFixed(2)}%`
					: '0%',
				note: 'Historical performance data requires subgraph integration.',
			};
		}

		case 'depositToVault': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const recipient = onBehalfOf || signerAddress;

			const info = await getVaultInfo(config, vaultAddress);
			const amountWei = ethers.parseUnits(amount, 18);

			// Preview deposit
			const expectedShares = await previewDeposit(config, vaultAddress, amountWei);

			// Approve asset spending
			await approveToken(config, info.asset, vaultAddress, amountWei);

			// Execute deposit
			const tx = await deposit(config, vaultAddress, amountWei, recipient);
			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				vaultAddress,
				amount,
				amountWei: amountWei.toString(),
				expectedShares: expectedShares.toString(),
				recipient,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'withdrawFromVault': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;
			const amount = this.getNodeParameter('amount', itemIndex) as string;
			const onBehalfOf = this.getNodeParameter('onBehalfOf', itemIndex, '') as string;

			if (config.readOnly) {
				throw new Error('Cannot execute transactions in read-only mode. Provide a private key.');
			}

			const signer = createSigner(config);
			const signerAddress = await signer.getAddress();
			const owner = onBehalfOf || signerAddress;

			const amountWei = ethers.parseUnits(amount, 18);

			// Preview withdrawal
			const expectedShares = await previewWithdraw(config, vaultAddress, amountWei);

			// Execute withdrawal
			const tx = await withdraw(config, vaultAddress, amountWei, signerAddress, owner);
			const receipt = await waitForTransaction(config, tx.hash);

			return {
				success: true,
				transactionHash: tx.hash,
				blockNumber: receipt.blockNumber,
				vaultAddress,
				amount,
				amountWei: amountWei.toString(),
				sharesBurned: expectedShares.toString(),
				receiver: signerAddress,
				gasUsed: receipt.gasUsed.toString(),
			};
		}

		case 'getVaultBalance': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const balance = await getVaultBalance(config, vaultAddress, userAddress);
			const assets = await convertToAssets(config, vaultAddress, balance.shares);

			return {
				vaultAddress,
				userAddress,
				shares: balance.shares.toString(),
				sharesFormatted: formatTokenAmount(balance.shares, 18),
				assets: assets.toString(),
				assetsFormatted: formatTokenAmount(assets, 18),
			};
		}

		case 'getVaultShares': {
			const vaultAddress = this.getNodeParameter('vaultAddress', itemIndex) as string;
			const userAddress = this.getNodeParameter('userAddress', itemIndex) as string;

			const balance = await getVaultBalance(config, vaultAddress, userAddress);

			return {
				vaultAddress,
				userAddress,
				shares: balance.shares.toString(),
				sharesFormatted: formatTokenAmount(balance.shares, 18),
			};
		}

		default:
			throw new Error(`Unknown operation: ${operation}`);
	}
}
