/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * MetaMorpho Vault Client
 *
 * Client for interacting with MetaMorpho vaults (curated lending pools).
 * Handles vault deposits, withdrawals, and information queries.
 */

import { ethers } from 'ethers';
import { META_MORPHO_ABI } from '../constants/contracts';
import type { MorphoClientConfig } from './morphoClient';
import { createProvider, createSigner } from './morphoClient';
import { isValidAddress } from '../utils/marketUtils';

/**
 * Vault information
 */
export interface VaultInfo {
  address: string;
  asset: string;
  totalAssets: bigint;
  totalSupply: bigint;
  curator: string;
  guardian: string;
  fee: bigint;
  feeRecipient: string;
  timelock: bigint;
}

/**
 * Vault allocation to a market
 */
export interface VaultAllocation {
  marketId: string;
  cap: bigint;
  enabled: boolean;
  assets: bigint;
}

/**
 * Get MetaMorpho vault contract instance
 */
export function getVaultContract(
  vaultAddress: string,
  config: MorphoClientConfig,
  useSigner: boolean = false,
): ethers.Contract {
  if (!isValidAddress(vaultAddress)) {
    throw new Error(`Invalid vault address: ${vaultAddress}`);
  }

  const signerOrProvider = useSigner ? createSigner(config) : createProvider(config);

  if (!signerOrProvider) {
    throw new Error('Cannot create signer: private key not provided');
  }

  return new ethers.Contract(vaultAddress, META_MORPHO_ABI, signerOrProvider);
}

/**
 * Fetch vault information
 */
export async function getVaultInfo(
  config: MorphoClientConfig,
  vaultAddress: string,
): Promise<VaultInfo> {
  const contract = getVaultContract(vaultAddress, config);

  const [asset, totalAssets, totalSupply, curator, guardian, fee, feeRecipient, timelock] =
    await Promise.all([
      contract.asset(),
      contract.totalAssets(),
      contract.totalSupply(),
      contract.curator(),
      contract.guardian(),
      contract.fee(),
      contract.feeRecipient(),
      contract.timelock(),
    ]);

  return {
    address: vaultAddress,
    asset,
    totalAssets: BigInt(totalAssets),
    totalSupply: BigInt(totalSupply),
    curator,
    guardian,
    fee: BigInt(fee),
    feeRecipient,
    timelock: BigInt(timelock),
  };
}

/**
 * Fetch vault balance for a user
 */
export async function getVaultBalance(
  config: MorphoClientConfig,
  vaultAddress: string,
  userAddress: string,
): Promise<{
  shares: bigint;
  assets: bigint;
}> {
  if (!isValidAddress(userAddress)) {
    throw new Error(`Invalid user address: ${userAddress}`);
  }

  const contract = getVaultContract(vaultAddress, config);

  const shares = await contract.balanceOf(userAddress);
  const assets = await contract.convertToAssets(shares);

  return {
    shares: BigInt(shares),
    assets: BigInt(assets),
  };
}

/**
 * Get vault supply queue
 */
export async function getSupplyQueue(
  config: MorphoClientConfig,
  vaultAddress: string,
): Promise<string[]> {
  const contract = getVaultContract(vaultAddress, config);
  const length = await contract.supplyQueueLength();

  const queue: string[] = [];
  for (let i = 0; i < Number(length); i++) {
    const marketId = await contract.supplyQueue(i);
    queue.push(marketId);
  }

  return queue;
}

/**
 * Get vault withdraw queue
 */
export async function getWithdrawQueue(
  config: MorphoClientConfig,
  vaultAddress: string,
): Promise<string[]> {
  const contract = getVaultContract(vaultAddress, config);
  const length = await contract.withdrawQueueLength();

  const queue: string[] = [];
  for (let i = 0; i < Number(length); i++) {
    const marketId = await contract.withdrawQueue(i);
    queue.push(marketId);
  }

  return queue;
}

/**
 * Get vault market configuration
 */
export async function getMarketConfig(
  config: MorphoClientConfig,
  vaultAddress: string,
  marketId: string,
): Promise<{
  cap: bigint;
  enabled: boolean;
  removableAt: bigint;
}> {
  const contract = getVaultContract(vaultAddress, config);
  const marketConfig = await contract.config(marketId);

  return {
    cap: BigInt(marketConfig.cap),
    enabled: marketConfig.enabled,
    removableAt: BigInt(marketConfig.removableAt),
  };
}

/**
 * Preview deposit (get shares for assets)
 */
export async function previewDeposit(
  config: MorphoClientConfig,
  vaultAddress: string,
  assets: bigint,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const shares = await contract.previewDeposit(assets);
  return BigInt(shares);
}

/**
 * Preview withdraw (get assets for shares)
 */
export async function previewWithdraw(
  config: MorphoClientConfig,
  vaultAddress: string,
  assets: bigint,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const shares = await contract.previewWithdraw(assets);
  return BigInt(shares);
}

/**
 * Preview redeem (get assets for shares)
 */
export async function previewRedeem(
  config: MorphoClientConfig,
  vaultAddress: string,
  shares: bigint,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const assets = await contract.previewRedeem(shares);
  return BigInt(assets);
}

/**
 * Get max deposit amount
 */
export async function maxDeposit(
  config: MorphoClientConfig,
  vaultAddress: string,
  receiverAddress: string,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const max = await contract.maxDeposit(receiverAddress);
  return BigInt(max);
}

/**
 * Get max withdraw amount
 */
export async function maxWithdraw(
  config: MorphoClientConfig,
  vaultAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const max = await contract.maxWithdraw(ownerAddress);
  return BigInt(max);
}

/**
 * Get max redeem amount (shares)
 */
export async function maxRedeem(
  config: MorphoClientConfig,
  vaultAddress: string,
  ownerAddress: string,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const max = await contract.maxRedeem(ownerAddress);
  return BigInt(max);
}

/**
 * Deposit assets into vault
 */
export async function deposit(
  config: MorphoClientConfig,
  vaultAddress: string,
  assets: bigint,
  receiver: string,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot deposit in read-only mode');
  }

  const contract = getVaultContract(vaultAddress, config, true);
  const tx = await contract.deposit(assets, receiver);

  return tx;
}

/**
 * Withdraw assets from vault
 */
export async function withdraw(
  config: MorphoClientConfig,
  vaultAddress: string,
  assets: bigint,
  receiver: string,
  owner: string,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot withdraw in read-only mode');
  }

  const contract = getVaultContract(vaultAddress, config, true);
  const tx = await contract.withdraw(assets, receiver, owner);

  return tx;
}

/**
 * Redeem shares from vault
 */
export async function redeem(
  config: MorphoClientConfig,
  vaultAddress: string,
  shares: bigint,
  receiver: string,
  owner: string,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot redeem in read-only mode');
  }

  const contract = getVaultContract(vaultAddress, config, true);
  const tx = await contract.redeem(shares, receiver, owner);

  return tx;
}

/**
 * Convert shares to assets
 */
export async function convertToAssets(
  config: MorphoClientConfig,
  vaultAddress: string,
  shares: bigint,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const assets = await contract.convertToAssets(shares);
  return BigInt(assets);
}

/**
 * Convert assets to shares
 */
export async function convertToShares(
  config: MorphoClientConfig,
  vaultAddress: string,
  assets: bigint,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const shares = await contract.convertToShares(assets);
  return BigInt(shares);
}

/**
 * Get vault idle assets
 */
export async function getIdleAssets(
  config: MorphoClientConfig,
  vaultAddress: string,
): Promise<bigint> {
  const contract = getVaultContract(vaultAddress, config);
  const idle = await contract.idle();
  return BigInt(idle);
}

/**
 * Calculate vault APY based on underlying market rates
 *
 * This is a simplified calculation. Actual vault APY depends on
 * allocation weights and individual market performance.
 */
export async function estimateVaultAPY(
  config: MorphoClientConfig,
  vaultAddress: string,
): Promise<number> {
  const vaultInfo = await getVaultInfo(config, vaultAddress);
  const supplyQueue = await getSupplyQueue(config, vaultAddress);

  if (supplyQueue.length === 0) {
    return 0;
  }

  // TODO: Calculate weighted average APY based on allocations
  // This requires fetching each market's supply APY and allocation

  // For now, return a placeholder
  return 0;
}
