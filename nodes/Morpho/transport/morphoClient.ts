/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Blue Client
 *
 * Primary client for interacting with the Morpho Blue protocol.
 * Handles market queries, supply, borrow, and position management.
 */

import { ethers } from 'ethers';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';
import {
  MORPHO_BLUE_ABI,
  ERC20_ABI,
  ADAPTIVE_CURVE_IRM_ABI,
  CHAINLINK_ORACLE_ABI,
} from '../constants/contracts';
import { getNetworkConfig } from '../constants/networks';
import type { MarketParams, MarketData } from '../utils/marketUtils';
import { calculateMarketId, isValidMarketId, isValidAddress } from '../utils/marketUtils';

/**
 * License notice - logged once per session
 */
let licenseNoticeLogged = false;

function logLicenseNotice(): void {
  if (!licenseNoticeLogged) {
    console.warn(`[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.`);
    licenseNoticeLogged = true;
  }
}

/**
 * Morpho client configuration
 */
export interface MorphoClientConfig {
  network: string;
  rpcUrl?: string;
  privateKey?: string;
  readOnly?: boolean;
}

/**
 * Create an ethers provider from configuration
 */
export function createProvider(config: MorphoClientConfig): ethers.JsonRpcProvider {
  logLicenseNotice();

  const networkConfig = getNetworkConfig(config.network);
  const rpcUrl = config.rpcUrl || networkConfig.rpcUrl;

  return new ethers.JsonRpcProvider(rpcUrl, {
    chainId: networkConfig.chainId,
    name: networkConfig.name,
  });
}

/**
 * Create an ethers signer (wallet) from configuration
 */
export function createSigner(
  config: MorphoClientConfig,
): ethers.Wallet | null {
  if (config.readOnly || !config.privateKey) {
    return null;
  }

  const provider = createProvider(config);
  return new ethers.Wallet(config.privateKey, provider);
}

/**
 * Get Morpho Blue contract instance
 */
export function getMorphoBlueContract(
  config: MorphoClientConfig,
  useSigner: boolean = false,
): ethers.Contract {
  const networkConfig = getNetworkConfig(config.network);
  const signerOrProvider = useSigner ? createSigner(config) : createProvider(config);

  if (!signerOrProvider) {
    throw new Error('Cannot create signer: private key not provided');
  }

  return new ethers.Contract(
    networkConfig.contracts.morphoBlue,
    MORPHO_BLUE_ABI,
    signerOrProvider,
  );
}

/**
 * Get ERC20 token contract instance
 */
export function getERC20Contract(
  tokenAddress: string,
  config: MorphoClientConfig,
  useSigner: boolean = false,
): ethers.Contract {
  const signerOrProvider = useSigner ? createSigner(config) : createProvider(config);

  if (!signerOrProvider) {
    throw new Error('Cannot create signer: private key not provided');
  }

  return new ethers.Contract(tokenAddress, ERC20_ABI, signerOrProvider);
}

/**
 * Get IRM (Interest Rate Model) contract instance
 */
export function getIRMContract(
  irmAddress: string,
  config: MorphoClientConfig,
): ethers.Contract {
  const provider = createProvider(config);
  return new ethers.Contract(irmAddress, ADAPTIVE_CURVE_IRM_ABI, provider);
}

/**
 * Get Oracle contract instance
 */
export function getOracleContract(
  oracleAddress: string,
  config: MorphoClientConfig,
): ethers.Contract {
  const provider = createProvider(config);
  return new ethers.Contract(oracleAddress, CHAINLINK_ORACLE_ABI, provider);
}

/**
 * Extract configuration from n8n credentials
 */
export async function getConfigFromCredentials(
  context: IExecuteFunctions | ILoadOptionsFunctions,
  credentialName: string = 'morphoNetwork',
): Promise<MorphoClientConfig> {
  const credentials = await context.getCredentials(credentialName);

  return {
    network: credentials.network as string,
    rpcUrl: credentials.rpcUrl as string | undefined,
    privateKey: credentials.privateKey as string | undefined,
    readOnly: credentials.readOnly as boolean | undefined,
  };
}

/**
 * Fetch market data from the contract
 */
export async function getMarketData(
  config: MorphoClientConfig,
  marketId: string,
): Promise<MarketData> {
  if (!isValidMarketId(marketId)) {
    throw new Error(`Invalid market ID: ${marketId}`);
  }

  const contract = getMorphoBlueContract(config);
  const data = await contract.market(marketId);

  return {
    totalSupplyAssets: BigInt(data.totalSupplyAssets),
    totalSupplyShares: BigInt(data.totalSupplyShares),
    totalBorrowAssets: BigInt(data.totalBorrowAssets),
    totalBorrowShares: BigInt(data.totalBorrowShares),
    lastUpdate: BigInt(data.lastUpdate),
    fee: BigInt(data.fee),
  };
}

/**
 * Fetch market parameters from the contract
 */
export async function getMarketParams(
  config: MorphoClientConfig,
  marketId: string,
): Promise<MarketParams> {
  if (!isValidMarketId(marketId)) {
    throw new Error(`Invalid market ID: ${marketId}`);
  }

  const contract = getMorphoBlueContract(config);
  const params = await contract.idToMarketParams(marketId);

  return {
    loanToken: params.loanToken,
    collateralToken: params.collateralToken,
    oracle: params.oracle,
    irm: params.irm,
    lltv: BigInt(params.lltv),
  };
}

/**
 * Fetch user position in a market
 */
export async function getPosition(
  config: MorphoClientConfig,
  marketId: string,
  userAddress: string,
): Promise<{
  supplyShares: bigint;
  borrowShares: bigint;
  collateral: bigint;
}> {
  if (!isValidMarketId(marketId)) {
    throw new Error(`Invalid market ID: ${marketId}`);
  }

  if (!isValidAddress(userAddress)) {
    throw new Error(`Invalid user address: ${userAddress}`);
  }

  const contract = getMorphoBlueContract(config);
  const position = await contract.position(marketId, userAddress);

  return {
    supplyShares: BigInt(position.supplyShares),
    borrowShares: BigInt(position.borrowShares),
    collateral: BigInt(position.collateral),
  };
}

/**
 * Fetch oracle price
 */
export async function getOraclePrice(
  config: MorphoClientConfig,
  oracleAddress: string,
): Promise<bigint> {
  if (!isValidAddress(oracleAddress)) {
    throw new Error(`Invalid oracle address: ${oracleAddress}`);
  }

  const contract = getOracleContract(oracleAddress, config);
  const price = await contract.price();

  return BigInt(price);
}

/**
 * Fetch borrow rate from IRM
 */
export async function getBorrowRate(
  config: MorphoClientConfig,
  marketId: string,
): Promise<bigint> {
  const marketParams = await getMarketParams(config, marketId);
  const marketData = await getMarketData(config, marketId);

  const irmContract = getIRMContract(marketParams.irm, config);

  const marketParamsTuple = [
    marketParams.loanToken,
    marketParams.collateralToken,
    marketParams.oracle,
    marketParams.irm,
    marketParams.lltv,
  ];

  const marketTuple = [
    marketData.totalSupplyAssets,
    marketData.totalSupplyShares,
    marketData.totalBorrowAssets,
    marketData.totalBorrowShares,
    marketData.lastUpdate,
    marketData.fee,
  ];

  const rate = await irmContract.borrowRateView(marketParamsTuple, marketTuple);

  return BigInt(rate);
}

/**
 * Fetch token information
 */
export async function getTokenInfo(
  config: MorphoClientConfig,
  tokenAddress: string,
): Promise<{
  name: string;
  symbol: string;
  decimals: number;
}> {
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  const contract = getERC20Contract(tokenAddress, config);

  const [name, symbol, decimals] = await Promise.all([
    contract.name(),
    contract.symbol(),
    contract.decimals(),
  ]);

  return {
    name,
    symbol,
    decimals: Number(decimals),
  };
}

/**
 * Fetch token balance
 */
export async function getTokenBalance(
  config: MorphoClientConfig,
  tokenAddress: string,
  userAddress: string,
): Promise<bigint> {
  if (!isValidAddress(tokenAddress)) {
    throw new Error(`Invalid token address: ${tokenAddress}`);
  }

  if (!isValidAddress(userAddress)) {
    throw new Error(`Invalid user address: ${userAddress}`);
  }

  const contract = getERC20Contract(tokenAddress, config);
  const balance = await contract.balanceOf(userAddress);

  return BigInt(balance);
}

/**
 * Check if user has approved spending
 */
export async function getAllowance(
  config: MorphoClientConfig,
  tokenAddress: string,
  ownerAddress: string,
  spenderAddress: string,
): Promise<bigint> {
  const contract = getERC20Contract(tokenAddress, config);
  const allowance = await contract.allowance(ownerAddress, spenderAddress);

  return BigInt(allowance);
}

/**
 * Approve token spending
 */
export async function approveToken(
  config: MorphoClientConfig,
  tokenAddress: string,
  spenderAddress: string,
  amount: bigint,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot approve in read-only mode');
  }

  const contract = getERC20Contract(tokenAddress, config, true);
  const tx = await contract.approve(spenderAddress, amount);

  return tx;
}

/**
 * Accrue interest in a market
 */
export async function accrueInterest(
  config: MorphoClientConfig,
  marketId: string,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot accrue interest in read-only mode');
  }

  const marketParams = await getMarketParams(config, marketId);
  const contract = getMorphoBlueContract(config, true);

  const marketParamsTuple = [
    marketParams.loanToken,
    marketParams.collateralToken,
    marketParams.oracle,
    marketParams.irm,
    marketParams.lltv,
  ];

  const tx = await contract.accrueInterest(marketParamsTuple);

  return tx;
}

/**
 * Get the current block timestamp
 */
export async function getBlockTimestamp(config: MorphoClientConfig): Promise<number> {
  const provider = createProvider(config);
  const block = await provider.getBlock('latest');
  return block?.timestamp ?? Math.floor(Date.now() / 1000);
}

/**
 * Wait for transaction confirmation
 */
export async function waitForTransaction(
  tx: ethers.TransactionResponse,
  confirmations: number = 1,
): Promise<ethers.TransactionReceipt | null> {
  return tx.wait(confirmations);
}
