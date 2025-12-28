/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Network Configuration for Morpho Protocol
 *
 * Morpho Blue is deployed on Ethereum Mainnet and Base.
 * Each network has its own contract addresses and subgraph endpoints.
 */

export interface NetworkConfig {
  chainId: number;
  name: string;
  displayName: string;
  rpcUrl: string;
  explorerUrl: string;
  subgraphUrl: string;
  apiUrl: string;
  nativeCurrency: {
    name: string;
    symbol: string;
    decimals: number;
  };
  contracts: {
    morphoBlue: string;
    bundler: string;
    publicAllocator: string;
    morphoToken: string;
    adaptiveCurveIrm: string;
  };
}

export const NETWORKS: Record<string, NetworkConfig> = {
  ethereum: {
    chainId: 1,
    name: 'ethereum',
    displayName: 'Ethereum Mainnet',
    rpcUrl: 'https://eth.llamarpc.com',
    explorerUrl: 'https://etherscan.io',
    subgraphUrl: 'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue',
    apiUrl: 'https://blue-api.morpho.org/graphql',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    contracts: {
      morphoBlue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
      bundler: '0x4095F064B8d3c3548A3bebfd0Bbfd04750E30077',
      publicAllocator: '0xfd32fA2ca22c76dD6E550706Ad913FC8c9C1789e',
      morphoToken: '0x9994E35Db50125E0DF82e4c2dde62496CE330999',
      adaptiveCurveIrm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    },
  },
  base: {
    chainId: 8453,
    name: 'base',
    displayName: 'Base',
    rpcUrl: 'https://mainnet.base.org',
    explorerUrl: 'https://basescan.org',
    subgraphUrl: 'https://api.studio.thegraph.com/query/48129/morpho-blue-base/version/latest',
    apiUrl: 'https://blue-api.morpho.org/graphql',
    nativeCurrency: {
      name: 'Ether',
      symbol: 'ETH',
      decimals: 18,
    },
    contracts: {
      morphoBlue: '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb',
      bundler: '0x23055618898e202386e6c13955a58D3C68200BFB',
      publicAllocator: '0xA090dD1a701408Df1d4d0B85b716c87565f90467',
      morphoToken: '0x0000000000000000000000000000000000000000', // Not deployed on Base
      adaptiveCurveIrm: '0x46415998764C29aB2a25CbeA6254146D50D22687',
    },
  },
};

export const DEFAULT_NETWORK = 'ethereum';

export function getNetworkConfig(network: string): NetworkConfig {
  const config = NETWORKS[network.toLowerCase()];
  if (!config) {
    throw new Error(`Unsupported network: ${network}. Supported networks: ${Object.keys(NETWORKS).join(', ')}`);
  }
  return config;
}

export function getChainIdFromNetwork(network: string): number {
  return getNetworkConfig(network).chainId;
}

export function getNetworkFromChainId(chainId: number): string | undefined {
  return Object.values(NETWORKS).find((n) => n.chainId === chainId)?.name;
}
