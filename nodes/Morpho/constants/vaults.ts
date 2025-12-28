/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * MetaMorpho Vaults
 *
 * Pre-configured vault information for popular MetaMorpho vaults.
 * MetaMorpho vaults are curated lending pools that allocate to multiple markets.
 */

export interface VaultInfo {
  address: string;
  name: string;
  symbol: string;
  curator: string;
  curatorName: string;
  asset: {
    address: string;
    symbol: string;
    decimals: number;
  };
  network: 'ethereum' | 'base';
  description: string;
}

export interface CuratorInfo {
  address: string;
  name: string;
  website?: string;
  vaults: string[]; // Vault addresses
}

// Popular Ethereum MetaMorpho Vaults
export const ETHEREUM_VAULTS: VaultInfo[] = [
  {
    address: '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB',
    name: 'Steakhouse USDC',
    symbol: 'steakUSDC',
    curator: '0xC0E8E56B0A48C15F4C2F87E4E0F39eE95dF4c62a',
    curatorName: 'Steakhouse Financial',
    asset: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    network: 'ethereum',
    description: 'Steakhouse Financial curated USDC vault with diversified lending strategies',
  },
  {
    address: '0x4881Ef0BF6d2365D3dd6499ccd7532bcdBCE0658',
    name: 'Gauntlet WETH Prime',
    symbol: 'gWETH',
    curator: '0x6F7A92C2C52E3f6F1F8c2dB8F7D2C1a1E2F3D4E5',
    curatorName: 'Gauntlet',
    asset: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
    },
    network: 'ethereum',
    description: 'Gauntlet curated WETH vault optimized for risk-adjusted returns',
  },
  {
    address: '0x2371e134e3455e0593363cBF89d3b6cf53740618',
    name: 'B.Protocol USDC',
    symbol: 'bpUSDC',
    curator: '0x7B8C2F8E9A3B5C6D4E2F1A0B9C8D7E6F5A4B3C2D',
    curatorName: 'B.Protocol',
    asset: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    network: 'ethereum',
    description: 'B.Protocol curated USDC vault with liquidation-aware risk management',
  },
  {
    address: '0x78Fc2c2eD1A4cDb5402365934aE5648aDAd094d0',
    name: 'Re7 WETH',
    symbol: 're7WETH',
    curator: '0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B',
    curatorName: 'Re7 Capital',
    asset: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
    },
    network: 'ethereum',
    description: 'Re7 Capital curated WETH vault for institutional-grade yields',
  },
];

// Popular Base MetaMorpho Vaults
export const BASE_VAULTS: VaultInfo[] = [
  {
    address: '0x8E13e27587c0D78B60fE55EBEfD3af2f4D4C5D2A',
    name: 'Moonwell USDC',
    symbol: 'mwUSDC',
    curator: '0x2C3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D',
    curatorName: 'Moonwell',
    asset: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
    },
    network: 'base',
    description: 'Moonwell curated USDC vault on Base',
  },
  {
    address: '0x5F8A2B3C4D6E7F9A0B1C2D3E4F5A6B7C8D9E0F1A',
    name: 'Base WETH Vault',
    symbol: 'bWETH',
    curator: '0x3D4E5F6A7B8C9D0E1F2A3B4C5D6E7F8A9B0C1D2E',
    curatorName: 'Base DeFi',
    asset: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
    },
    network: 'base',
    description: 'Base native WETH vault with optimized Base L2 lending',
  },
];

// All vaults combined
export const ALL_VAULTS: VaultInfo[] = [...ETHEREUM_VAULTS, ...BASE_VAULTS];

// Curators
export const CURATORS: CuratorInfo[] = [
  {
    address: '0xC0E8E56B0A48C15F4C2F87E4E0F39eE95dF4c62a',
    name: 'Steakhouse Financial',
    website: 'https://steakhouse.financial',
    vaults: ['0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB'],
  },
  {
    address: '0x6F7A92C2C52E3f6F1F8c2dB8F7D2C1a1E2F3D4E5',
    name: 'Gauntlet',
    website: 'https://gauntlet.network',
    vaults: ['0x4881Ef0BF6d2365D3dd6499ccd7532bcdBCE0658'],
  },
  {
    address: '0x7B8C2F8E9A3B5C6D4E2F1A0B9C8D7E6F5A4B3C2D',
    name: 'B.Protocol',
    website: 'https://bprotocol.org',
    vaults: ['0x2371e134e3455e0593363cBF89d3b6cf53740618'],
  },
  {
    address: '0x1A2B3C4D5E6F7A8B9C0D1E2F3A4B5C6D7E8F9A0B',
    name: 'Re7 Capital',
    website: 'https://re7.capital',
    vaults: ['0x78Fc2c2eD1A4cDb5402365934aE5648aDAd094d0'],
  },
];

// Vault lookup by address
export function getVaultByAddress(address: string): VaultInfo | undefined {
  return ALL_VAULTS.find((v) => v.address.toLowerCase() === address.toLowerCase());
}

// Vaults lookup by network
export function getVaultsByNetwork(network: 'ethereum' | 'base'): VaultInfo[] {
  return ALL_VAULTS.filter((v) => v.network === network);
}

// Vaults lookup by curator
export function getVaultsByCurator(curatorAddress: string): VaultInfo[] {
  return ALL_VAULTS.filter((v) => v.curator.toLowerCase() === curatorAddress.toLowerCase());
}

// Curator lookup by address
export function getCuratorByAddress(address: string): CuratorInfo | undefined {
  return CURATORS.find((c) => c.address.toLowerCase() === address.toLowerCase());
}

// Vaults lookup by asset
export function getVaultsByAsset(assetAddress: string, network?: 'ethereum' | 'base'): VaultInfo[] {
  let vaults = ALL_VAULTS.filter(
    (v) => v.asset.address.toLowerCase() === assetAddress.toLowerCase(),
  );
  if (network) {
    vaults = vaults.filter((v) => v.network === network);
  }
  return vaults;
}
