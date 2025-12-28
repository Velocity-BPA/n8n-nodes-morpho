/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Bundler Client
 *
 * Client for creating and executing bundled (batched) transactions.
 * The bundler allows multiple Morpho operations to be executed atomically.
 */

import { ethers } from 'ethers';
import { BUNDLER_ABI, MORPHO_BLUE_ABI, ERC20_ABI } from '../constants/contracts';
import { getNetworkConfig } from '../constants/networks';
import type { MorphoClientConfig } from './morphoClient';
import { createProvider, createSigner } from './morphoClient';

/**
 * Bundle action types
 */
export type BundleActionType =
  | 'approve'
  | 'supply'
  | 'supplyCollateral'
  | 'borrow'
  | 'repay'
  | 'withdraw'
  | 'withdrawCollateral';

/**
 * Bundle action definition
 */
export interface BundleAction {
  type: BundleActionType;
  params: Record<string, unknown>;
}

/**
 * Bundle builder for creating multicall transactions
 */
export class BundleBuilder {
  private actions: string[] = [];
  private config: MorphoClientConfig;
  private morphoInterface: ethers.Interface;
  private erc20Interface: ethers.Interface;

  constructor(config: MorphoClientConfig) {
    this.config = config;
    this.morphoInterface = new ethers.Interface(MORPHO_BLUE_ABI);
    this.erc20Interface = new ethers.Interface(ERC20_ABI);
  }

  /**
   * Add a supply action to the bundle
   */
  addSupply(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    shares: bigint,
    onBehalf: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('supply', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      shares,
      onBehalf,
      '0x', // Empty callback data
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Add a supply collateral action to the bundle
   */
  addSupplyCollateral(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    onBehalf: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('supplyCollateral', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      onBehalf,
      '0x', // Empty callback data
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Add a borrow action to the bundle
   */
  addBorrow(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    shares: bigint,
    onBehalf: string,
    receiver: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('borrow', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      shares,
      onBehalf,
      receiver,
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Add a repay action to the bundle
   */
  addRepay(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    shares: bigint,
    onBehalf: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('repay', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      shares,
      onBehalf,
      '0x', // Empty callback data
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Add a withdraw action to the bundle
   */
  addWithdraw(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    shares: bigint,
    onBehalf: string,
    receiver: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('withdraw', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      shares,
      onBehalf,
      receiver,
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Add a withdraw collateral action to the bundle
   */
  addWithdrawCollateral(
    marketParams: {
      loanToken: string;
      collateralToken: string;
      oracle: string;
      irm: string;
      lltv: bigint;
    },
    assets: bigint,
    onBehalf: string,
    receiver: string,
  ): BundleBuilder {
    const calldata = this.morphoInterface.encodeFunctionData('withdrawCollateral', [
      [
        marketParams.loanToken,
        marketParams.collateralToken,
        marketParams.oracle,
        marketParams.irm,
        marketParams.lltv,
      ],
      assets,
      onBehalf,
      receiver,
    ]);

    this.actions.push(calldata);
    return this;
  }

  /**
   * Get all actions in the bundle
   */
  getActions(): string[] {
    return [...this.actions];
  }

  /**
   * Get the number of actions in the bundle
   */
  getActionCount(): number {
    return this.actions.length;
  }

  /**
   * Clear all actions from the bundle
   */
  clear(): BundleBuilder {
    this.actions = [];
    return this;
  }

  /**
   * Execute the bundle
   */
  async execute(): Promise<ethers.TransactionResponse> {
    if (this.config.readOnly) {
      throw new Error('Cannot execute bundle in read-only mode');
    }

    if (this.actions.length === 0) {
      throw new Error('Bundle is empty');
    }

    const networkConfig = getNetworkConfig(this.config.network);
    const signer = createSigner(this.config);

    if (!signer) {
      throw new Error('Cannot create signer: private key not provided');
    }

    const bundler = new ethers.Contract(networkConfig.contracts.bundler, BUNDLER_ABI, signer);

    const tx = await bundler.multicall(this.actions);

    return tx;
  }

  /**
   * Estimate gas for the bundle
   */
  async estimateGas(): Promise<bigint> {
    if (this.actions.length === 0) {
      return 0n;
    }

    const networkConfig = getNetworkConfig(this.config.network);
    const provider = createProvider(this.config);

    const bundler = new ethers.Contract(networkConfig.contracts.bundler, BUNDLER_ABI, provider);

    const gasEstimate = await bundler.multicall.estimateGas(this.actions);

    return gasEstimate;
  }
}

/**
 * Get bundler contract instance
 */
export function getBundlerContract(
  config: MorphoClientConfig,
  useSigner: boolean = false,
): ethers.Contract {
  const networkConfig = getNetworkConfig(config.network);
  const signerOrProvider = useSigner ? createSigner(config) : createProvider(config);

  if (!signerOrProvider) {
    throw new Error('Cannot create signer: private key not provided');
  }

  return new ethers.Contract(networkConfig.contracts.bundler, BUNDLER_ABI, signerOrProvider);
}

/**
 * Create a new bundle builder
 */
export function createBundleBuilder(config: MorphoClientConfig): BundleBuilder {
  return new BundleBuilder(config);
}

/**
 * Execute a raw multicall
 */
export async function executeMulticall(
  config: MorphoClientConfig,
  calls: string[],
  value: bigint = 0n,
): Promise<ethers.TransactionResponse> {
  if (config.readOnly) {
    throw new Error('Cannot execute multicall in read-only mode');
  }

  const bundler = getBundlerContract(config, true);
  const tx = await bundler.multicall(calls, { value });

  return tx;
}
