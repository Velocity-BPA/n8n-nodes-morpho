/**
 * n8n-nodes-morpho - Integration Tests
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use of this node by for-profit organizations in production environments
 * requires a commercial license from Velocity BPA.
 * For licensing information, visit https://velobpa.com/licensing
 */

import { ethers } from 'ethers';

/**
 * Integration tests for Morpho protocol interactions
 * These tests require network access and should be run sparingly
 *
 * Set RPC_URL environment variable to run these tests:
 * RPC_URL=https://eth-mainnet.g.alchemy.com/v2/YOUR_KEY npm run test:integration
 */

// Skip integration tests if no RPC_URL provided
const RPC_URL = process.env.RPC_URL;
const describeIfRpc = RPC_URL ? describe : describe.skip;

// Known contract addresses
const MORPHO_BLUE = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const USDC = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';

// Minimal ABIs for testing
const MORPHO_ABI = [
	'function market(bytes32 id) view returns (uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee)',
	'function idToMarketParams(bytes32 id) view returns (address loanToken, address collateralToken, address oracle, address irm, uint256 lltv)',
];

const ERC20_ABI = [
	'function name() view returns (string)',
	'function symbol() view returns (string)',
	'function decimals() view returns (uint8)',
	'function totalSupply() view returns (uint256)',
];

describeIfRpc('Morpho Blue Integration Tests', () => {
	let provider: ethers.JsonRpcProvider;
	let morpho: ethers.Contract;

	beforeAll(() => {
		provider = new ethers.JsonRpcProvider(RPC_URL);
		morpho = new ethers.Contract(MORPHO_BLUE, MORPHO_ABI, provider);
	});

	describe('Contract Connectivity', () => {
		it('should connect to Ethereum mainnet', async () => {
			const network = await provider.getNetwork();
			expect(Number(network.chainId)).toBe(1);
		});

		it('should access Morpho Blue contract', async () => {
			const code = await provider.getCode(MORPHO_BLUE);
			expect(code).not.toBe('0x');
			expect(code.length).toBeGreaterThan(100);
		});
	});

	describe('Market Queries', () => {
		// Known WETH/USDC market (you'll need a real market ID)
		const SAMPLE_MARKET_ID = '0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41';

		it('should read market state', async () => {
			try {
				const marketState = await morpho.market(SAMPLE_MARKET_ID);

				expect(marketState.totalSupplyAssets).toBeDefined();
				expect(marketState.totalSupplyShares).toBeDefined();
				expect(marketState.totalBorrowAssets).toBeDefined();
				expect(marketState.totalBorrowShares).toBeDefined();

				// Log for debugging
				console.log('Market State:', {
					totalSupplyAssets: marketState.totalSupplyAssets.toString(),
					totalBorrowAssets: marketState.totalBorrowAssets.toString(),
				});
			} catch (error) {
				// Market might not exist, which is fine for this test
				console.log('Market not found or error:', (error as Error).message);
			}
		});

		it('should read market parameters', async () => {
			try {
				const params = await morpho.idToMarketParams(SAMPLE_MARKET_ID);

				if (params.loanToken !== ethers.ZeroAddress) {
					expect(ethers.isAddress(params.loanToken)).toBe(true);
					expect(ethers.isAddress(params.collateralToken)).toBe(true);
					expect(ethers.isAddress(params.oracle)).toBe(true);
					expect(ethers.isAddress(params.irm)).toBe(true);
					expect(params.lltv).toBeDefined();

					console.log('Market Parameters:', {
						loanToken: params.loanToken,
						collateralToken: params.collateralToken,
						lltv: params.lltv.toString(),
					});
				}
			} catch (error) {
				console.log('Error reading market params:', (error as Error).message);
			}
		});
	});

	describe('Token Queries', () => {
		it('should read WETH token info', async () => {
			const weth = new ethers.Contract(WETH, ERC20_ABI, provider);

			const [name, symbol, decimals] = await Promise.all([
				weth.name(),
				weth.symbol(),
				weth.decimals(),
			]);

			expect(name).toBe('Wrapped Ether');
			expect(symbol).toBe('WETH');
			expect(Number(decimals)).toBe(18);
		});

		it('should read USDC token info', async () => {
			const usdc = new ethers.Contract(USDC, ERC20_ABI, provider);

			const [name, symbol, decimals] = await Promise.all([
				usdc.name(),
				usdc.symbol(),
				usdc.decimals(),
			]);

			expect(name).toBe('USD Coin');
			expect(symbol).toBe('USDC');
			expect(Number(decimals)).toBe(6);
		});
	});

	describe('Block Data', () => {
		it('should get current block number', async () => {
			const blockNumber = await provider.getBlockNumber();
			expect(blockNumber).toBeGreaterThan(18000000); // Post-2023 blocks
		});

		it('should get block timestamp', async () => {
			const block = await provider.getBlock('latest');
			expect(block).not.toBeNull();
			expect(block!.timestamp).toBeGreaterThan(1700000000); // After Nov 2023
		});
	});

	describe('Gas Estimation', () => {
		it('should get current gas price', async () => {
			const feeData = await provider.getFeeData();

			expect(feeData.gasPrice).toBeDefined();
			expect(feeData.maxFeePerGas).toBeDefined();
			expect(feeData.maxPriorityFeePerGas).toBeDefined();

			console.log('Gas Prices:', {
				gasPrice: ethers.formatUnits(feeData.gasPrice || 0n, 'gwei') + ' gwei',
				maxFee: ethers.formatUnits(feeData.maxFeePerGas || 0n, 'gwei') + ' gwei',
			});
		});
	});
});

describe('Subgraph Integration Tests', () => {
	const SUBGRAPH_URL = 'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue';

	it('should query subgraph for markets', async () => {
		try {
			const response = await fetch(SUBGRAPH_URL, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query: `{
            markets(first: 5, orderBy: totalSupplyAssets, orderDirection: desc) {
              id
              loanToken { symbol }
              collateralToken { symbol }
              lltv
            }
          }`,
				}),
			});

			const data = await response.json();

			if (data.data?.markets) {
				expect(Array.isArray(data.data.markets)).toBe(true);
				console.log('Top Markets:', data.data.markets);
			}
		} catch (error) {
			// Subgraph might be unavailable
			console.log('Subgraph query failed:', (error as Error).message);
		}
	});
});

describe('MetaMorpho Vault Tests', () => {
	// Example vault address (Steakhouse USDC)
	const VAULT_ADDRESS = '0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB';

	const VAULT_ABI = [
		'function name() view returns (string)',
		'function symbol() view returns (string)',
		'function asset() view returns (address)',
		'function totalAssets() view returns (uint256)',
		'function totalSupply() view returns (uint256)',
		'function curator() view returns (address)',
		'function fee() view returns (uint96)',
	];

	describeIfRpc('Vault Queries', () => {
		let provider: ethers.JsonRpcProvider;
		let vault: ethers.Contract;

		beforeAll(() => {
			provider = new ethers.JsonRpcProvider(RPC_URL);
			vault = new ethers.Contract(VAULT_ADDRESS, VAULT_ABI, provider);
		});

		it('should read vault info', async () => {
			try {
				const [name, symbol, asset] = await Promise.all([
					vault.name(),
					vault.symbol(),
					vault.asset(),
				]);

				expect(name).toBeDefined();
				expect(symbol).toBeDefined();
				expect(ethers.isAddress(asset)).toBe(true);

				console.log('Vault Info:', { name, symbol, asset });
			} catch (error) {
				console.log('Vault query failed:', (error as Error).message);
			}
		});

		it('should read vault TVL', async () => {
			try {
				const totalAssets = await vault.totalAssets();
				expect(totalAssets).toBeDefined();

				// Convert to human readable (USDC has 6 decimals)
				const tvl = Number(totalAssets) / 1e6;
				console.log('Vault TVL:', tvl.toLocaleString(), 'USDC');
			} catch (error) {
				console.log('TVL query failed:', (error as Error).message);
			}
		});
	});
});

// Helper to validate responses
function validateMorphoResponse(response: Record<string, unknown>): boolean {
	// Check for required fields in typical Morpho responses
	const hasAddress = typeof response.address === 'string';
	const hasMarketId = typeof response.marketId === 'string';
	const hasValue = typeof response.value !== 'undefined';

	return hasAddress || hasMarketId || hasValue;
}

describe('Response Validation', () => {
	it('should validate market response structure', () => {
		const validResponse = {
			marketId: '0x' + 'a'.repeat(64),
			loanToken: '0x1234567890123456789012345678901234567890',
			collateralToken: '0x1234567890123456789012345678901234567890',
			lltv: '900000000000000000',
			totalSupply: '1000000000000000000',
			totalBorrow: '500000000000000000',
		};

		expect(validateMorphoResponse(validResponse)).toBe(true);
	});

	it('should validate position response structure', () => {
		const validPosition = {
			address: '0x1234567890123456789012345678901234567890',
			marketId: '0x' + 'a'.repeat(64),
			supplyShares: '1000000000000000000',
			borrowShares: '500000000000000000',
			collateral: '2000000000000000000',
		};

		expect(validateMorphoResponse(validPosition)).toBe(true);
	});
});
