/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Blue Markets
 *
 * Pre-configured market information for popular Morpho Blue markets.
 * Markets are identified by their unique market ID (bytes32 hash of market params).
 *
 * Market ID = keccak256(abi.encode(loanToken, collateralToken, oracle, irm, lltv))
 */

export interface MarketInfo {
  id: string;
  name: string;
  loanToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  collateralToken: {
    address: string;
    symbol: string;
    decimals: number;
  };
  oracle: string;
  irm: string;
  lltv: string; // in basis points (945000 = 94.5%)
  network: 'ethereum' | 'base';
}

// Popular Ethereum Mainnet Markets
export const ETHEREUM_MARKETS: MarketInfo[] = [
  {
    id: '0xb323495f7e4148be5643a4ea4a8221eef163e4bccfdedc2a6f4696baacbc86cc',
    name: 'WETH/USDC (94.5% LLTV)',
    loanToken: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    collateralToken: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
    },
    oracle: '0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2',
    irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    lltv: '945000000000000000', // 94.5%
    network: 'ethereum',
  },
  {
    id: '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41',
    name: 'wstETH/USDC (86% LLTV)',
    loanToken: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    collateralToken: {
      address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      symbol: 'wstETH',
      decimals: 18,
    },
    oracle: '0x2a01EB9496094dA03c4E364Def50f5aD1280AD72',
    irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    lltv: '860000000000000000', // 86%
    network: 'ethereum',
  },
  {
    id: '0xa921ef34e2fc7a27ccc50ae7e4b154e16c9799d3387076c421423ef52ac4df99',
    name: 'wstETH/WETH (96.5% LLTV)',
    loanToken: {
      address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
      symbol: 'WETH',
      decimals: 18,
    },
    collateralToken: {
      address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0',
      symbol: 'wstETH',
      decimals: 18,
    },
    oracle: '0xbD60A6770b27E084E8617f557c32e51893a233E5',
    irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    lltv: '965000000000000000', // 96.5%
    network: 'ethereum',
  },
  {
    id: '0xd5211d0e3f4a30d5c98653d988585792bb7812221f04801be73a44ceecb11e89',
    name: 'WBTC/USDC (86% LLTV)',
    loanToken: {
      address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
      symbol: 'USDC',
      decimals: 6,
    },
    collateralToken: {
      address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
      symbol: 'WBTC',
      decimals: 8,
    },
    oracle: '0xDddd770BADd886dF3864029e4B377B5F6a2B6b83',
    irm: '0x870aC11D48B15DB9a138Cf899d20F13F79Ba00BC',
    lltv: '860000000000000000', // 86%
    network: 'ethereum',
  },
];

// Popular Base Markets
export const BASE_MARKETS: MarketInfo[] = [
  {
    id: '0x104ff0b7c0d67301cb24e3a10b928b0fb0026ee26338e28553b7064fa8b659a8',
    name: 'WETH/USDbC (91.5% LLTV)',
    loanToken: {
      address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA',
      symbol: 'USDbC',
      decimals: 6,
    },
    collateralToken: {
      address: '0x4200000000000000000000000000000000000006',
      symbol: 'WETH',
      decimals: 18,
    },
    oracle: '0x9E6C4B10C37B81c0b3e8f9b0F1e08f0F3a0C0F1a',
    irm: '0x46415998764C29aB2a25CbeA6254146D50D22687',
    lltv: '915000000000000000', // 91.5%
    network: 'base',
  },
  {
    id: '0x8793cf302b8ffd655ab97bd1c695dbd967807e8367a65d2f98c1e53bc9c7b4b0',
    name: 'cbETH/USDC (86% LLTV)',
    loanToken: {
      address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      symbol: 'USDC',
      decimals: 6,
    },
    collateralToken: {
      address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22',
      symbol: 'cbETH',
      decimals: 18,
    },
    oracle: '0x0Ddb4CE02D9ae8C2c38Fe7D238b60A0eA7D23E8B',
    irm: '0x46415998764C29aB2a25CbeA6254146D50D22687',
    lltv: '860000000000000000', // 86%
    network: 'base',
  },
];

// All markets combined
export const ALL_MARKETS: MarketInfo[] = [...ETHEREUM_MARKETS, ...BASE_MARKETS];

// Market lookup by ID
export function getMarketById(id: string): MarketInfo | undefined {
  return ALL_MARKETS.find((m) => m.id.toLowerCase() === id.toLowerCase());
}

// Markets lookup by network
export function getMarketsByNetwork(network: 'ethereum' | 'base'): MarketInfo[] {
  return ALL_MARKETS.filter((m) => m.network === network);
}

// Common tokens
export const COMMON_TOKENS: Record<string, Record<string, { address: string; decimals: number }>> = {
  ethereum: {
    WETH: { address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', decimals: 18 },
    USDC: { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    USDT: { address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    DAI: { address: '0x6B175474E89094C44Da98b954EescdeCB5BE3830', decimals: 18 },
    WBTC: { address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', decimals: 8 },
    wstETH: { address: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', decimals: 18 },
    rETH: { address: '0xae78736Cd615f374D3085123A210448E74Fc6393', decimals: 18 },
    cbETH: { address: '0xBe9895146f7AF43049ca1c1AE358B0541Ea49704', decimals: 18 },
    MORPHO: { address: '0x9994E35Db50125E0DF82e4c2dde62496CE330999', decimals: 18 },
  },
  base: {
    WETH: { address: '0x4200000000000000000000000000000000000006', decimals: 18 },
    USDC: { address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    USDbC: { address: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', decimals: 6 },
    cbETH: { address: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', decimals: 18 },
    wstETH: { address: '0xc1CBa3fCea344f92D9239c08C0568f6F2F0ee452', decimals: 18 },
  },
};

// LLTV options in basis points (as BigInt strings in wei)
export const LLTV_OPTIONS: Record<string, string> = {
  '0%': '0',
  '38.5%': '385000000000000000',
  '62.5%': '625000000000000000',
  '77%': '770000000000000000',
  '80%': '800000000000000000',
  '86%': '860000000000000000',
  '90%': '900000000000000000',
  '91.5%': '915000000000000000',
  '94.5%': '945000000000000000',
  '96.5%': '965000000000000000',
  '98%': '980000000000000000',
};
