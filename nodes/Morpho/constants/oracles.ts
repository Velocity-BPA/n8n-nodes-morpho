/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Oracles
 *
 * Oracle configurations for Morpho Blue markets.
 * Morpho uses Chainlink-compatible oracles for price feeds.
 */

export interface OracleInfo {
  address: string;
  name: string;
  baseFeed1?: string;
  baseFeed2?: string;
  quoteFeed1?: string;
  quoteFeed2?: string;
  baseToken: string;
  quoteToken: string;
  network: 'ethereum' | 'base';
}

// Common Chainlink Price Feeds on Ethereum
export const CHAINLINK_FEEDS_ETHEREUM: Record<string, string> = {
  'ETH/USD': '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419',
  'BTC/USD': '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c',
  'USDC/USD': '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6',
  'USDT/USD': '0x3E7d1eAB13ad0104d2750B8863b489D65364e32D',
  'DAI/USD': '0xAed0c38402a5d19df6E4c03F4E2DceD6e29c1ee9',
  'wstETH/ETH': '0x905b216D9E00fF5BfE15d3F20DAe16e9cE7BaB36',
  'stETH/ETH': '0x86392dC19c0b719886221c78AB11eb8Cf5c52812',
  'rETH/ETH': '0x536218f9E9Eb48863970252233c8F271f554C2d0',
  'cbETH/ETH': '0xF017fcB346A1885194689bA23Eff2fE6fA5C483b',
};

// Common Chainlink Price Feeds on Base
export const CHAINLINK_FEEDS_BASE: Record<string, string> = {
  'ETH/USD': '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70',
  'USDC/USD': '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B',
  'cbETH/ETH': '0x806b4Ac04501c29769051e42783cF04dCE41440b',
  'wstETH/ETH': '0x43a5C292A453A3bF3606fa856197f09D7B74251a',
};

// Morpho Oracle Adapters on Ethereum
export const MORPHO_ORACLES_ETHEREUM: OracleInfo[] = [
  {
    address: '0x48F7E36EB6B826B2dF4B2E630B62Cd25e89E40e2',
    name: 'WETH/USDC Oracle',
    baseFeed1: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
    quoteFeed1: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
    baseToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    quoteToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    network: 'ethereum',
  },
  {
    address: '0x2a01EB9496094dA03c4E364Def50f5aD1280AD72',
    name: 'wstETH/USDC Oracle',
    baseFeed1: '0x905b216D9E00fF5BfE15d3F20DAe16e9cE7BaB36', // wstETH/ETH
    baseFeed2: '0x5f4eC3Df9cbd43714FE2740f5E3616155c5b8419', // ETH/USD
    quoteFeed1: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
    baseToken: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
    quoteToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    network: 'ethereum',
  },
  {
    address: '0xbD60A6770b27E084E8617f557c32e51893a233E5',
    name: 'wstETH/WETH Oracle',
    baseFeed1: '0x905b216D9E00fF5BfE15d3F20DAe16e9cE7BaB36', // wstETH/ETH
    baseToken: '0x7f39C581F595B53c5cb19bD0b3f8dA6c935E2Ca0', // wstETH
    quoteToken: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', // WETH
    network: 'ethereum',
  },
  {
    address: '0xDddd770BADd886dF3864029e4B377B5F6a2B6b83',
    name: 'WBTC/USDC Oracle',
    baseFeed1: '0xF4030086522a5bEEa4988F8cA5B36dbC97BeE88c', // BTC/USD
    quoteFeed1: '0x8fFfFfd4AfB6115b954Bd326cbe7B4BA576818f6', // USDC/USD
    baseToken: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599', // WBTC
    quoteToken: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', // USDC
    network: 'ethereum',
  },
];

// Morpho Oracle Adapters on Base
export const MORPHO_ORACLES_BASE: OracleInfo[] = [
  {
    address: '0x9E6C4B10C37B81c0b3e8f9b0F1e08f0F3a0C0F1a',
    name: 'WETH/USDbC Oracle',
    baseFeed1: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // ETH/USD
    quoteFeed1: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B', // USDC/USD
    baseToken: '0x4200000000000000000000000000000000000006', // WETH
    quoteToken: '0xd9aAEc86B65D86f6A7B5B1b0c42FFA531710b6CA', // USDbC
    network: 'base',
  },
  {
    address: '0x0Ddb4CE02D9ae8C2c38Fe7D238b60A0eA7D23E8B',
    name: 'cbETH/USDC Oracle',
    baseFeed1: '0x806b4Ac04501c29769051e42783cF04dCE41440b', // cbETH/ETH
    baseFeed2: '0x71041dddad3595F9CEd3DcCFBe3D1F4b0a16Bb70', // ETH/USD
    quoteFeed1: '0x7e860098F58bBFC8648a4311b374B1D669a2bc6B', // USDC/USD
    baseToken: '0x2Ae3F1Ec7F1F5012CFEab0185bfc7aa3cf0DEc22', // cbETH
    quoteToken: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', // USDC
    network: 'base',
  },
];

// All oracles combined
export const ALL_ORACLES: OracleInfo[] = [...MORPHO_ORACLES_ETHEREUM, ...MORPHO_ORACLES_BASE];

// Oracle lookup by address
export function getOracleByAddress(address: string): OracleInfo | undefined {
  return ALL_ORACLES.find((o) => o.address.toLowerCase() === address.toLowerCase());
}

// Oracles lookup by network
export function getOraclesByNetwork(network: 'ethereum' | 'base'): OracleInfo[] {
  return ALL_ORACLES.filter((o) => o.network === network);
}

// Get oracle for a specific token pair
export function getOracleForPair(
  baseToken: string,
  quoteToken: string,
  network: 'ethereum' | 'base',
): OracleInfo | undefined {
  return ALL_ORACLES.find(
    (o) =>
      o.baseToken.toLowerCase() === baseToken.toLowerCase() &&
      o.quoteToken.toLowerCase() === quoteToken.toLowerCase() &&
      o.network === network,
  );
}

// Oracle scale factor (36 decimals for Morpho)
export const ORACLE_PRICE_SCALE = 10n ** 36n;

// Chainlink decimals (typically 8 for USD pairs)
export const CHAINLINK_DECIMALS = 8;
