/**
 * Morpho DeFi Lending Protocol - n8n Community Node
 *
 * [Velocity BPA Licensing Notice]
 *
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 *
 * Use of this node by for-profit organizations in production environments
 * requires a commercial license from Velocity BPA.
 *
 * For licensing information, visit https://velobpa.com/licensing
 * or contact licensing@velobpa.com.
 */

import {
	IExecuteFunctions,
	INodeType,
	INodeTypeDescription,
	INodeExecutionData,
	NodeConnectionType,
} from 'n8n-workflow';

// License notice logging - once per session
let licenseNoticeShown = false;
function showLicenseNotice(): void {
	if (!licenseNoticeShown) {
		console.warn(`
[Velocity BPA Licensing Notice]

This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).

Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.

For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.
`);
		licenseNoticeShown = true;
	}
}

// Import action handlers
import * as market from './actions/market';
import * as supply from './actions/supply';
import * as borrow from './actions/borrow';
import * as collateral from './actions/collateral';
import * as position from './actions/position';
import * as vault from './actions/vault';
import * as curator from './actions/curator';
import * as liquidation from './actions/liquidation';
import * as oracle from './actions/oracle';
import * as interestRate from './actions/interestRate';
import * as rewards from './actions/rewards';
import * as morphoToken from './actions/morphoToken';
import * as governance from './actions/governance';
import * as risk from './actions/risk';
import * as analytics from './actions/analytics';
import * as blue from './actions/blue';
import * as migration from './actions/migration';
import * as bundler from './actions/bundler';
import * as subgraph from './actions/subgraph';
import * as utility from './actions/utility';

export class Morpho implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Morpho',
		name: 'morpho',
		icon: 'file:morpho.svg',
		group: ['transform'],
		version: 1,
		subtitle: '={{$parameter["operation"] + ": " + $parameter["resource"]}}',
		description: 'Interact with Morpho DeFi lending protocol - Morpho Blue & MetaMorpho vaults',
		defaults: {
			name: 'Morpho',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'morphoNetwork',
				required: true,
			},
			{
				name: 'morphoApi',
				required: false,
			},
		],
		properties: [
			// Resource selector
			{
				displayName: 'Resource',
				name: 'resource',
				type: 'options',
				noDataExpression: true,
				options: [
					{ name: 'Analytics', value: 'analytics' },
					{ name: 'Blue', value: 'blue' },
					{ name: 'Borrow', value: 'borrow' },
					{ name: 'Bundler', value: 'bundler' },
					{ name: 'Collateral', value: 'collateral' },
					{ name: 'Curator', value: 'curator' },
					{ name: 'Governance', value: 'governance' },
					{ name: 'Interest Rate', value: 'interestRate' },
					{ name: 'Liquidation', value: 'liquidation' },
					{ name: 'Market', value: 'market' },
					{ name: 'Migration', value: 'migration' },
					{ name: 'MORPHO Token', value: 'morphoToken' },
					{ name: 'Oracle', value: 'oracle' },
					{ name: 'Position', value: 'position' },
					{ name: 'Rewards', value: 'rewards' },
					{ name: 'Risk', value: 'risk' },
					{ name: 'Subgraph', value: 'subgraph' },
					{ name: 'Supply', value: 'supply' },
					{ name: 'Utility', value: 'utility' },
					{ name: 'Vault', value: 'vault' },
				],
				default: 'market',
				description: 'The Morpho resource to interact with',
			},

			// ========== MARKET OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['market'] },
				},
				options: [
					{ name: 'Get Market APY', value: 'getMarketAPY', description: 'Get supply and borrow APY for a market', action: 'Get market APY' },
					{ name: 'Get Market By ID', value: 'getMarketById', description: 'Get a specific market by its ID', action: 'Get market by ID' },
					{ name: 'Get Market Caps', value: 'getMarketCaps', description: 'Get supply and borrow caps for a market', action: 'Get market caps' },
					{ name: 'Get Market History', value: 'getMarketHistory', description: 'Get historical data for a market', action: 'Get market history' },
					{ name: 'Get Market Info', value: 'getMarketInfo', description: 'Get detailed information about a market', action: 'Get market info' },
					{ name: 'Get Market Liquidity', value: 'getMarketLiquidity', description: 'Get available liquidity in a market', action: 'Get market liquidity' },
					{ name: 'Get Market Oracle Price', value: 'getMarketOraclePrice', description: 'Get the oracle price for a market', action: 'Get market oracle price' },
					{ name: 'Get Market Parameters', value: 'getMarketParameters', description: 'Get market parameters (LLTV, IRM, etc.)', action: 'Get market parameters' },
					{ name: 'Get Market TVL', value: 'getMarketTVL', description: 'Get total value locked in a market', action: 'Get market TVL' },
					{ name: 'Get Market Utilization', value: 'getMarketUtilization', description: 'Get utilization rate of a market', action: 'Get market utilization' },
					{ name: 'Get Markets', value: 'getMarkets', description: 'Get all available markets', action: 'Get markets' },
					{ name: 'Get Whitelisted Markets', value: 'getWhitelistedMarkets', description: 'Get markets whitelisted by curators', action: 'Get whitelisted markets' },
					{ name: 'Search Markets', value: 'searchMarkets', description: 'Search markets by token or criteria', action: 'Search markets' },
				],
				default: 'getMarkets',
			},

			// ========== SUPPLY OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['supply'] },
				},
				options: [
					{ name: 'Get Available to Withdraw', value: 'getAvailableToWithdraw', description: 'Get maximum withdrawable amount', action: 'Get available to withdraw' },
					{ name: 'Get Supply APY', value: 'getSupplyAPY', description: 'Get current supply APY', action: 'Get supply APY' },
					{ name: 'Get Supply Balance', value: 'getSupplyBalance', description: 'Get supply balance for an address', action: 'Get supply balance' },
					{ name: 'Get Supply History', value: 'getSupplyHistory', description: 'Get supply transaction history', action: 'Get supply history' },
					{ name: 'Get Supply Positions', value: 'getSupplyPositions', description: 'Get all supply positions for an address', action: 'Get supply positions' },
					{ name: 'Get Supply Shares', value: 'getSupplyShares', description: 'Get supply shares for an address', action: 'Get supply shares' },
					{ name: 'Get Supplied Amount', value: 'getSuppliedAmount', description: 'Get total supplied amount in assets', action: 'Get supplied amount' },
					{ name: 'Supply Assets', value: 'supplyAssets', description: 'Supply assets to a market', action: 'Supply assets' },
					{ name: 'Supply Collateral', value: 'supplyCollateral', description: 'Supply collateral to a market', action: 'Supply collateral' },
					{ name: 'Withdraw Assets', value: 'withdrawAssets', description: 'Withdraw supplied assets', action: 'Withdraw assets' },
					{ name: 'Withdraw Collateral', value: 'withdrawCollateral', description: 'Withdraw collateral from a market', action: 'Withdraw collateral' },
					{ name: 'Withdraw Max', value: 'withdrawMax', description: 'Withdraw maximum available amount', action: 'Withdraw max' },
				],
				default: 'getSupplyBalance',
			},

			// ========== BORROW OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['borrow'] },
				},
				options: [
					{ name: 'Borrow Assets', value: 'borrowAssets', description: 'Borrow assets from a market', action: 'Borrow assets' },
					{ name: 'Get Available to Borrow', value: 'getAvailableToBorrow', description: 'Get maximum borrowable amount', action: 'Get available to borrow' },
					{ name: 'Get Borrow APY', value: 'getBorrowAPY', description: 'Get current borrow APY', action: 'Get borrow APY' },
					{ name: 'Get Borrow Balance', value: 'getBorrowBalance', description: 'Get borrow balance for an address', action: 'Get borrow balance' },
					{ name: 'Get Borrow Capacity', value: 'getBorrowCapacity', description: 'Get total borrowing capacity', action: 'Get borrow capacity' },
					{ name: 'Get Borrow History', value: 'getBorrowHistory', description: 'Get borrow transaction history', action: 'Get borrow history' },
					{ name: 'Get Borrow Positions', value: 'getBorrowPositions', description: 'Get all borrow positions for an address', action: 'Get borrow positions' },
					{ name: 'Get Borrow Shares', value: 'getBorrowShares', description: 'Get borrow shares for an address', action: 'Get borrow shares' },
					{ name: 'Get Borrowed Amount', value: 'getBorrowedAmount', description: 'Get total borrowed amount in assets', action: 'Get borrowed amount' },
					{ name: 'Repay Borrow', value: 'repayBorrow', description: 'Repay borrowed assets', action: 'Repay borrow' },
					{ name: 'Repay Max', value: 'repayMax', description: 'Repay maximum owed amount', action: 'Repay max' },
				],
				default: 'getBorrowBalance',
			},

			// ========== COLLATERAL OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['collateral'] },
				},
				options: [
					{ name: 'Get Collateral Balance', value: 'getCollateralBalance', description: 'Get collateral balance for an address', action: 'Get collateral balance' },
					{ name: 'Get Collateral Factor', value: 'getCollateralFactor', description: 'Get LLTV (collateral factor) for a market', action: 'Get collateral factor' },
					{ name: 'Get Collateral Markets', value: 'getCollateralMarkets', description: 'Get markets accepting a collateral token', action: 'Get collateral markets' },
					{ name: 'Get Collateral Positions', value: 'getCollateralPositions', description: 'Get all collateral positions for an address', action: 'Get collateral positions' },
					{ name: 'Get Collateral Value', value: 'getCollateralValue', description: 'Get USD value of collateral', action: 'Get collateral value' },
					{ name: 'Get Liquidation LTV', value: 'getLiquidationLTV', description: 'Get liquidation LTV threshold', action: 'Get liquidation LTV' },
					{ name: 'Supply Collateral', value: 'supplyCollateral', description: 'Supply collateral to a market', action: 'Supply collateral' },
					{ name: 'Withdraw Collateral', value: 'withdrawCollateral', description: 'Withdraw collateral from a market', action: 'Withdraw collateral' },
				],
				default: 'getCollateralBalance',
			},

			// ========== POSITION OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['position'] },
				},
				options: [
					{ name: 'Close Position', value: 'closePosition', description: 'Close a lending/borrowing position', action: 'Close position' },
					{ name: 'Get All Positions', value: 'getAllPositions', description: 'Get all positions across all markets', action: 'Get all positions' },
					{ name: 'Get Collateralization Ratio', value: 'getCollateralizationRatio', description: 'Get current collateralization ratio', action: 'Get collateralization ratio' },
					{ name: 'Get Liquidation Price', value: 'getLiquidationPrice', description: 'Get price at which position is liquidatable', action: 'Get liquidation price' },
					{ name: 'Get Position', value: 'getPosition', description: 'Get position details for a market', action: 'Get position' },
					{ name: 'Get Position APY', value: 'getPositionAPY', description: 'Get net APY for a position', action: 'Get position APY' },
					{ name: 'Get Position Health', value: 'getPositionHealth', description: 'Get health factor for a position', action: 'Get position health' },
					{ name: 'Get Position History', value: 'getPositionHistory', description: 'Get historical position changes', action: 'Get position history' },
					{ name: 'Get Position PnL', value: 'getPositionPnL', description: 'Get profit/loss for a position', action: 'Get position PnL' },
					{ name: 'Get Position Value', value: 'getPositionValue', description: 'Get total value of a position', action: 'Get position value' },
					{ name: 'Get Positions By User', value: 'getPositionsByUser', description: 'Get all positions for a user', action: 'Get positions by user' },
				],
				default: 'getPosition',
			},

			// ========== VAULT OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['vault'] },
				},
				options: [
					{ name: 'Deposit to Vault', value: 'depositToVault', description: 'Deposit assets into a MetaMorpho vault', action: 'Deposit to vault' },
					{ name: 'Get Vault Allocation', value: 'getVaultAllocation', description: 'Get vault allocation across markets', action: 'Get vault allocation' },
					{ name: 'Get Vault APY', value: 'getVaultAPY', description: 'Get current vault APY', action: 'Get vault APY' },
					{ name: 'Get Vault Balance', value: 'getVaultBalance', description: 'Get user balance in a vault', action: 'Get vault balance' },
					{ name: 'Get Vault By Address', value: 'getVaultByAddress', description: 'Get vault details by address', action: 'Get vault by address' },
					{ name: 'Get Vault Cap', value: 'getVaultCap', description: 'Get vault deposit cap', action: 'Get vault cap' },
					{ name: 'Get Vault Curator', value: 'getVaultCurator', description: 'Get vault curator information', action: 'Get vault curator' },
					{ name: 'Get Vault Fee', value: 'getVaultFee', description: 'Get vault performance fee', action: 'Get vault fee' },
					{ name: 'Get Vault Info', value: 'getVaultInfo', description: 'Get detailed vault information', action: 'Get vault info' },
					{ name: 'Get Vault Markets', value: 'getVaultMarkets', description: 'Get markets in vault allocation', action: 'Get vault markets' },
					{ name: 'Get Vault Performance', value: 'getVaultPerformance', description: 'Get vault performance metrics', action: 'Get vault performance' },
					{ name: 'Get Vault Queue', value: 'getVaultQueue', description: 'Get vault supply/withdraw queue', action: 'Get vault queue' },
					{ name: 'Get Vault Shares', value: 'getVaultShares', description: 'Get user shares in a vault', action: 'Get vault shares' },
					{ name: 'Get Vault TVL', value: 'getVaultTVL', description: 'Get total value locked in vault', action: 'Get vault TVL' },
					{ name: 'Get Vaults', value: 'getVaults', description: 'Get all MetaMorpho vaults', action: 'Get vaults' },
					{ name: 'Withdraw from Vault', value: 'withdrawFromVault', description: 'Withdraw assets from a vault', action: 'Withdraw from vault' },
				],
				default: 'getVaults',
			},

			// ========== CURATOR OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['curator'] },
				},
				options: [
					{ name: 'Get Curator Fee', value: 'getCuratorFee', description: 'Get curator performance fee', action: 'Get curator fee' },
					{ name: 'Get Curator History', value: 'getCuratorHistory', description: 'Get curator activity history', action: 'Get curator history' },
					{ name: 'Get Curator Info', value: 'getCuratorInfo', description: 'Get detailed curator information', action: 'Get curator info' },
					{ name: 'Get Curator Markets', value: 'getCuratorMarkets', description: 'Get markets managed by curator', action: 'Get curator markets' },
					{ name: 'Get Curator Performance', value: 'getCuratorPerformance', description: 'Get curator performance metrics', action: 'Get curator performance' },
					{ name: 'Get Curator Vaults', value: 'getCuratorVaults', description: 'Get vaults managed by curator', action: 'Get curator vaults' },
					{ name: 'Get Curators', value: 'getCurators', description: 'Get all registered curators', action: 'Get curators' },
				],
				default: 'getCurators',
			},

			// ========== LIQUIDATION OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['liquidation'] },
				},
				options: [
					{ name: 'Calculate Liquidation Amount', value: 'calculateLiquidationAmount', description: 'Calculate optimal liquidation amount', action: 'Calculate liquidation amount' },
					{ name: 'Get Bad Debt', value: 'getBadDebt', description: 'Get bad debt in a market', action: 'Get bad debt' },
					{ name: 'Get Liquidatable Positions', value: 'getLiquidatablePositions', description: 'Get positions eligible for liquidation', action: 'Get liquidatable positions' },
					{ name: 'Get Liquidation Bonus', value: 'getLiquidationBonus', description: 'Get liquidation incentive bonus', action: 'Get liquidation bonus' },
					{ name: 'Get Liquidation History', value: 'getLiquidationHistory', description: 'Get historical liquidations', action: 'Get liquidation history' },
					{ name: 'Get Liquidation Info', value: 'getLiquidationInfo', description: 'Get liquidation details for a position', action: 'Get liquidation info' },
					{ name: 'Get Liquidation Parameters', value: 'getLiquidationParameters', description: 'Get liquidation parameters', action: 'Get liquidation parameters' },
					{ name: 'Liquidate Position', value: 'liquidatePosition', description: 'Execute a liquidation', action: 'Liquidate position' },
					{ name: 'Simulate Liquidation', value: 'simulateLiquidation', description: 'Simulate a liquidation without executing', action: 'Simulate liquidation' },
				],
				default: 'getLiquidatablePositions',
			},

			// ========== ORACLE OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['oracle'] },
				},
				options: [
					{ name: 'Get Historical Prices', value: 'getHistoricalPrices', description: 'Get historical oracle prices', action: 'Get historical prices' },
					{ name: 'Get Oracle By Market', value: 'getOracleByMarket', description: 'Get oracle used by a market', action: 'Get oracle by market' },
					{ name: 'Get Oracle Info', value: 'getOracleInfo', description: 'Get oracle configuration details', action: 'Get oracle info' },
					{ name: 'Get Oracle Price', value: 'getOraclePrice', description: 'Get current price from oracle', action: 'Get oracle price' },
					{ name: 'Get Price Confidence', value: 'getPriceConfidence', description: 'Get price confidence metrics', action: 'Get price confidence' },
					{ name: 'Get Price Feed', value: 'getPriceFeed', description: 'Get price feed address', action: 'Get price feed' },
					{ name: 'Get TWAP', value: 'getTWAP', description: 'Get time-weighted average price', action: 'Get TWAP' },
					{ name: 'Validate Oracle', value: 'validateOracle', description: 'Validate oracle configuration', action: 'Validate oracle' },
				],
				default: 'getOraclePrice',
			},

			// ========== INTEREST RATE OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['interestRate'] },
				},
				options: [
					{ name: 'Calculate Rate', value: 'calculateRate', description: 'Calculate interest rate for parameters', action: 'Calculate rate' },
					{ name: 'Get Borrow Rate', value: 'getBorrowRate', description: 'Get current borrow interest rate', action: 'Get borrow rate' },
					{ name: 'Get IRM', value: 'getIRM', description: 'Get Interest Rate Model details', action: 'Get IRM' },
					{ name: 'Get Optimal Utilization', value: 'getOptimalUtilization', description: 'Get target utilization rate', action: 'Get optimal utilization' },
					{ name: 'Get Rate at Utilization', value: 'getRateAtUtilization', description: 'Get rate at specific utilization', action: 'Get rate at utilization' },
					{ name: 'Get Rate History', value: 'getRateHistory', description: 'Get historical interest rates', action: 'Get rate history' },
					{ name: 'Get Rate Parameters', value: 'getRateParameters', description: 'Get IRM parameters', action: 'Get rate parameters' },
					{ name: 'Get Supply Rate', value: 'getSupplyRate', description: 'Get current supply interest rate', action: 'Get supply rate' },
					{ name: 'Get Utilization Rate', value: 'getUtilizationRate', description: 'Get current utilization rate', action: 'Get utilization rate' },
				],
				default: 'getBorrowRate',
			},

			// ========== REWARDS OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['rewards'] },
				},
				options: [
					{ name: 'Claim Rewards', value: 'claimRewards', description: 'Claim accrued rewards', action: 'Claim rewards' },
					{ name: 'Get Claimable Rewards', value: 'getClaimableRewards', description: 'Get rewards available to claim', action: 'Get claimable rewards' },
					{ name: 'Get Reward By Market', value: 'getRewardByMarket', description: 'Get rewards for a specific market', action: 'Get reward by market' },
					{ name: 'Get Reward By Vault', value: 'getRewardByVault', description: 'Get rewards for a specific vault', action: 'Get reward by vault' },
					{ name: 'Get Reward History', value: 'getRewardHistory', description: 'Get reward distribution history', action: 'Get reward history' },
					{ name: 'Get Reward Rate', value: 'getRewardRate', description: 'Get current reward emission rate', action: 'Get reward rate' },
					{ name: 'Get Reward Token', value: 'getRewardToken', description: 'Get reward token information', action: 'Get reward token' },
					{ name: 'Get Rewards Info', value: 'getRewardsInfo', description: 'Get rewards program information', action: 'Get rewards info' },
					{ name: 'Get Total Distributed', value: 'getTotalDistributed', description: 'Get total rewards distributed', action: 'Get total distributed' },
				],
				default: 'getClaimableRewards',
			},

			// ========== MORPHO TOKEN OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['morphoToken'] },
				},
				options: [
					{ name: 'Delegate MORPHO', value: 'delegateMORPHO', description: 'Delegate voting power', action: 'Delegate MORPHO' },
					{ name: 'Get MORPHO Balance', value: 'getMORPHOBalance', description: 'Get MORPHO token balance', action: 'Get MORPHO balance' },
					{ name: 'Get MORPHO Circulating', value: 'getMORPHOCirculating', description: 'Get circulating supply', action: 'Get MORPHO circulating' },
					{ name: 'Get MORPHO Price', value: 'getMORPHOPrice', description: 'Get MORPHO token price', action: 'Get MORPHO price' },
					{ name: 'Get MORPHO Supply', value: 'getMORPHOSupply', description: 'Get total token supply', action: 'Get MORPHO supply' },
					{ name: 'Get Token Distribution', value: 'getTokenDistribution', description: 'Get token distribution breakdown', action: 'Get token distribution' },
					{ name: 'Get Vesting Schedule', value: 'getVestingSchedule', description: 'Get token vesting schedule', action: 'Get vesting schedule' },
					{ name: 'Get Voting Power', value: 'getVotingPower', description: 'Get voting power for address', action: 'Get voting power' },
					{ name: 'Transfer MORPHO', value: 'transferMORPHO', description: 'Transfer MORPHO tokens', action: 'Transfer MORPHO' },
				],
				default: 'getMORPHOBalance',
			},

			// ========== GOVERNANCE OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['governance'] },
				},
				options: [
					{ name: 'Delegate Votes', value: 'delegateVotes', description: 'Delegate voting power', action: 'Delegate votes' },
					{ name: 'Get Governance Stats', value: 'getGovernanceStats', description: 'Get governance statistics', action: 'Get governance stats' },
					{ name: 'Get Proposal', value: 'getProposal', description: 'Get proposal details', action: 'Get proposal' },
					{ name: 'Get Proposal State', value: 'getProposalState', description: 'Get current proposal state', action: 'Get proposal state' },
					{ name: 'Get Proposals', value: 'getProposals', description: 'Get all governance proposals', action: 'Get proposals' },
					{ name: 'Get Quorum', value: 'getQuorum', description: 'Get quorum requirements', action: 'Get quorum' },
					{ name: 'Get Vote History', value: 'getVoteHistory', description: 'Get voting history for address', action: 'Get vote history' },
					{ name: 'Get Voting Power', value: 'getVotingPower', description: 'Get voting power for address', action: 'Get voting power' },
					{ name: 'Vote on Proposal', value: 'voteOnProposal', description: 'Cast vote on a proposal', action: 'Vote on proposal' },
				],
				default: 'getProposals',
			},

			// ========== RISK OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['risk'] },
				},
				options: [
					{ name: 'Calculate Health Factor', value: 'calculateHealthFactor', description: 'Calculate position health factor', action: 'Calculate health factor' },
					{ name: 'Get Bad Debt Risk', value: 'getBadDebtRisk', description: 'Get bad debt risk assessment', action: 'Get bad debt risk' },
					{ name: 'Get Collateral Risk', value: 'getCollateralRisk', description: 'Get collateral asset risk', action: 'Get collateral risk' },
					{ name: 'Get LLTV', value: 'getLLTV', description: 'Get liquidation loan-to-value', action: 'Get LLTV' },
					{ name: 'Get Market Risk', value: 'getMarketRisk', description: 'Get market risk assessment', action: 'Get market risk' },
					{ name: 'Get Oracle Risk', value: 'getOracleRisk', description: 'Get oracle risk assessment', action: 'Get oracle risk' },
					{ name: 'Get Protocol Risk', value: 'getProtocolRisk', description: 'Get protocol-level risk', action: 'Get protocol risk' },
					{ name: 'Get Risk History', value: 'getRiskHistory', description: 'Get historical risk metrics', action: 'Get risk history' },
					{ name: 'Get Risk Parameters', value: 'getRiskParameters', description: 'Get risk parameters for market', action: 'Get risk parameters' },
				],
				default: 'getRiskParameters',
			},

			// ========== ANALYTICS OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['analytics'] },
				},
				options: [
					{ name: 'Export Analytics', value: 'exportAnalytics', description: 'Export analytics data', action: 'Export analytics' },
					{ name: 'Get Historical Data', value: 'getHistoricalData', description: 'Get historical protocol data', action: 'Get historical data' },
					{ name: 'Get Market Rankings', value: 'getMarketRankings', description: 'Get markets ranked by metrics', action: 'Get market rankings' },
					{ name: 'Get Protocol Stats', value: 'getProtocolStats', description: 'Get protocol statistics', action: 'Get protocol stats' },
					{ name: 'Get Protocol TVL', value: 'getProtocolTVL', description: 'Get total protocol TVL', action: 'Get protocol TVL' },
					{ name: 'Get Top Borrowers', value: 'getTopBorrowers', description: 'Get top borrowers by volume', action: 'Get top borrowers' },
					{ name: 'Get Top Suppliers', value: 'getTopSuppliers', description: 'Get top suppliers by volume', action: 'Get top suppliers' },
					{ name: 'Get User Stats', value: 'getUserStats', description: 'Get statistics for a user', action: 'Get user stats' },
					{ name: 'Get Volume Stats', value: 'getVolumeStats', description: 'Get volume statistics', action: 'Get volume stats' },
					{ name: 'Get Yield Comparison', value: 'getYieldComparison', description: 'Compare yields across markets', action: 'Get yield comparison' },
				],
				default: 'getProtocolTVL',
			},

			// ========== BLUE OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['blue'] },
				},
				options: [
					{ name: 'Borrow from Blue', value: 'borrowFromBlue', description: 'Borrow from Morpho Blue market', action: 'Borrow from Blue' },
					{ name: 'Get Blue APY', value: 'getBlueAPY', description: 'Get Morpho Blue market APY', action: 'Get Blue APY' },
					{ name: 'Get Blue Liquidity', value: 'getBlueLiquidity', description: 'Get available liquidity', action: 'Get Blue liquidity' },
					{ name: 'Get Blue Market', value: 'getBlueMarket', description: 'Get specific Morpho Blue market', action: 'Get Blue market' },
					{ name: 'Get Blue Markets', value: 'getBlueMarkets', description: 'Get all Morpho Blue markets', action: 'Get Blue markets' },
					{ name: 'Get Blue Parameters', value: 'getBlueParameters', description: 'Get Morpho Blue parameters', action: 'Get Blue parameters' },
					{ name: 'Get Blue Position', value: 'getBluePosition', description: 'Get position in Morpho Blue', action: 'Get Blue position' },
					{ name: 'Get Blue Utilization', value: 'getBlueUtilization', description: 'Get market utilization', action: 'Get Blue utilization' },
					{ name: 'Supply to Blue', value: 'supplyToBlue', description: 'Supply to Morpho Blue market', action: 'Supply to Blue' },
				],
				default: 'getBlueMarkets',
			},

			// ========== MIGRATION OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['migration'] },
				},
				options: [
					{ name: 'Check Migration Eligibility', value: 'checkMigrationEligibility', description: 'Check if position can be migrated', action: 'Check migration eligibility' },
					{ name: 'Estimate Gas Savings', value: 'estimateGasSavings', description: 'Estimate gas savings from migration', action: 'Estimate gas savings' },
					{ name: 'Get Migration Quote', value: 'getMigrationQuote', description: 'Get quote for migration', action: 'Get migration quote' },
					{ name: 'Get Migration Status', value: 'getMigrationStatus', description: 'Get status of migration', action: 'Get migration status' },
					{ name: 'Migrate from Aave', value: 'migrateFromAave', description: 'Migrate position from Aave', action: 'Migrate from Aave' },
					{ name: 'Migrate from Compound', value: 'migrateFromCompound', description: 'Migrate position from Compound', action: 'Migrate from Compound' },
				],
				default: 'checkMigrationEligibility',
			},

			// ========== BUNDLER OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['bundler'] },
				},
				options: [
					{ name: 'Add Borrow Action', value: 'addBorrowAction', description: 'Add borrow to bundle', action: 'Add borrow action' },
					{ name: 'Add Repay Action', value: 'addRepayAction', description: 'Add repay to bundle', action: 'Add repay action' },
					{ name: 'Add Supply Action', value: 'addSupplyAction', description: 'Add supply to bundle', action: 'Add supply action' },
					{ name: 'Add Withdraw Action', value: 'addWithdrawAction', description: 'Add withdraw to bundle', action: 'Add withdraw action' },
					{ name: 'Create Bundle', value: 'createBundle', description: 'Create new transaction bundle', action: 'Create bundle' },
					{ name: 'Estimate Bundle Gas', value: 'estimateBundleGas', description: 'Estimate gas for bundle', action: 'Estimate bundle gas' },
					{ name: 'Execute Bundle', value: 'executeBundle', description: 'Execute transaction bundle', action: 'Execute bundle' },
					{ name: 'Get Bundle Status', value: 'getBundleStatus', description: 'Get bundle execution status', action: 'Get bundle status' },
				],
				default: 'createBundle',
			},

			// ========== SUBGRAPH OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['subgraph'] },
				},
				options: [
					{ name: 'Custom GraphQL Query', value: 'customGraphQLQuery', description: 'Execute custom GraphQL query', action: 'Custom GraphQL query' },
					{ name: 'Get Subgraph Status', value: 'getSubgraphStatus', description: 'Get subgraph sync status', action: 'Get subgraph status' },
					{ name: 'Query Liquidations', value: 'queryLiquidations', description: 'Query liquidation events', action: 'Query liquidations' },
					{ name: 'Query Markets', value: 'queryMarkets', description: 'Query markets from subgraph', action: 'Query markets' },
					{ name: 'Query Positions', value: 'queryPositions', description: 'Query positions from subgraph', action: 'Query positions' },
					{ name: 'Query Transactions', value: 'queryTransactions', description: 'Query transactions from subgraph', action: 'Query transactions' },
					{ name: 'Query Vaults', value: 'queryVaults', description: 'Query vaults from subgraph', action: 'Query vaults' },
				],
				default: 'queryMarkets',
			},

			// ========== UTILITY OPERATIONS ==========
			{
				displayName: 'Operation',
				name: 'operation',
				type: 'options',
				noDataExpression: true,
				displayOptions: {
					show: { resource: ['utility'] },
				},
				options: [
					{ name: 'Calculate APY', value: 'calculateAPY', description: 'Calculate APY from rate', action: 'Calculate APY' },
					{ name: 'Calculate Health Factor', value: 'calculateHealthFactor', description: 'Calculate health factor', action: 'Calculate health factor' },
					{ name: 'Calculate Liquidation Price', value: 'calculateLiquidationPrice', description: 'Calculate liquidation price', action: 'Calculate liquidation price' },
					{ name: 'Convert Assets to Shares', value: 'convertAssetsToShares', description: 'Convert assets to shares', action: 'Convert assets to shares' },
					{ name: 'Convert Shares to Assets', value: 'convertSharesToAssets', description: 'Convert shares to assets', action: 'Convert shares to assets' },
					{ name: 'Estimate Gas', value: 'estimateGas', description: 'Estimate gas for operation', action: 'Estimate gas' },
					{ name: 'Get Contract Addresses', value: 'getContractAddresses', description: 'Get Morpho contract addresses', action: 'Get contract addresses' },
					{ name: 'Get Network Status', value: 'getNetworkStatus', description: 'Get network connectivity status', action: 'Get network status' },
					{ name: 'Validate Market ID', value: 'validateMarketId', description: 'Validate market ID format', action: 'Validate market ID' },
				],
				default: 'getContractAddresses',
			},

			// ========== COMMON PARAMETERS ==========
			// Market ID - used across multiple resources
			{
				displayName: 'Market ID',
				name: 'marketId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['market', 'supply', 'borrow', 'collateral', 'position', 'liquidation', 'oracle', 'interestRate', 'risk', 'blue'],
						operation: [
							'getMarketById', 'getMarketInfo', 'getMarketAPY', 'getMarketUtilization',
							'getMarketLiquidity', 'getMarketTVL', 'getMarketParameters', 'getMarketOraclePrice',
							'getMarketCaps', 'getMarketHistory',
							'supplyAssets', 'supplyCollateral', 'getSupplyBalance', 'getSupplyAPY',
							'getSupplyShares', 'getSuppliedAmount', 'withdrawAssets', 'withdrawCollateral',
							'withdrawMax', 'getAvailableToWithdraw', 'getSupplyHistory',
							'borrowAssets', 'getBorrowBalance', 'getBorrowAPY', 'getBorrowShares',
							'getBorrowedAmount', 'repayBorrow', 'repayMax', 'getAvailableToBorrow',
							'getBorrowCapacity', 'getBorrowHistory',
							'getCollateralBalance', 'getCollateralFactor', 'getCollateralValue',
							'getLiquidationLTV',
							'getPosition', 'getPositionHealth', 'getPositionValue', 'getCollateralizationRatio',
							'getLiquidationPrice', 'getPositionAPY', 'getPositionPnL', 'getPositionHistory',
							'closePosition',
							'getLiquidatablePositions', 'getLiquidationInfo', 'liquidatePosition',
							'getLiquidationBonus', 'getLiquidationHistory', 'getBadDebt',
							'calculateLiquidationAmount', 'simulateLiquidation', 'getLiquidationParameters',
							'getOraclePrice', 'getOracleInfo', 'getPriceFeed', 'getHistoricalPrices',
							'getOracleByMarket', 'validateOracle', 'getPriceConfidence', 'getTWAP',
							'getSupplyRate', 'getBorrowRate', 'getUtilizationRate', 'getRateAtUtilization',
							'getIRM', 'getRateParameters', 'getRateHistory', 'calculateRate', 'getOptimalUtilization',
							'getRiskParameters', 'getLLTV', 'getMarketRisk', 'getCollateralRisk',
							'getOracleRisk', 'getBadDebtRisk', 'getRiskHistory',
							'getBlueMarket', 'supplyToBlue', 'borrowFromBlue', 'getBluePosition',
							'getBlueParameters', 'getBlueUtilization', 'getBlueAPY', 'getBlueLiquidity',
						],
					},
				},
				placeholder: '0x...',
				description: 'The unique identifier for the Morpho market (bytes32 hash)',
			},

			// User address - used for position and balance queries
			{
				displayName: 'User Address',
				name: 'userAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['supply', 'borrow', 'collateral', 'position', 'rewards', 'morphoToken', 'governance', 'analytics'],
						operation: [
							'getSupplyBalance', 'getSupplyShares', 'getSuppliedAmount', 'getSupplyPositions',
							'getAvailableToWithdraw', 'getSupplyHistory',
							'getBorrowBalance', 'getBorrowShares', 'getBorrowedAmount', 'getBorrowPositions',
							'getAvailableToBorrow', 'getBorrowCapacity', 'getBorrowHistory',
							'getCollateralBalance', 'getCollateralValue', 'getCollateralPositions',
							'getPosition', 'getPositionsByUser', 'getPositionHealth', 'getPositionValue',
							'getCollateralizationRatio', 'getLiquidationPrice', 'getPositionAPY',
							'getPositionPnL', 'getPositionHistory', 'getAllPositions',
							'getClaimableRewards', 'claimRewards', 'getRewardHistory',
							'getMORPHOBalance', 'getVotingPower', 'getVestingSchedule',
							'getVotingPower', 'getVoteHistory',
							'getUserStats',
						],
					},
				},
				placeholder: '0x...',
				description: 'The Ethereum address of the user',
			},

			// Vault address - used for vault operations
			{
				displayName: 'Vault Address',
				name: 'vaultAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['vault', 'rewards'],
						operation: [
							'getVaultInfo', 'getVaultByAddress', 'getVaultAPY', 'getVaultTVL',
							'getVaultAllocation', 'getVaultMarkets', 'getVaultCap', 'getVaultQueue',
							'getVaultFee', 'getVaultCurator', 'getVaultPerformance',
							'depositToVault', 'withdrawFromVault', 'getVaultBalance', 'getVaultShares',
							'getRewardByVault',
						],
					},
				},
				placeholder: '0x...',
				description: 'The address of the MetaMorpho vault',
			},

			// Amount - used for supply/borrow/withdraw operations
			{
				displayName: 'Amount',
				name: 'amount',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['supply', 'borrow', 'collateral', 'vault', 'morphoToken', 'blue'],
						operation: [
							'supplyAssets', 'supplyCollateral', 'withdrawAssets', 'withdrawCollateral',
							'borrowAssets', 'repayBorrow',
							'depositToVault', 'withdrawFromVault',
							'transferMORPHO',
							'supplyToBlue', 'borrowFromBlue',
						],
					},
				},
				placeholder: '1.0',
				description: 'The amount to supply/borrow/withdraw (in token units)',
			},

			// Recipient address - used for transfers
			{
				displayName: 'Recipient Address',
				name: 'recipientAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['morphoToken'],
						operation: ['transferMORPHO'],
					},
				},
				placeholder: '0x...',
				description: 'The address to receive the tokens',
			},

			// Curator address
			{
				displayName: 'Curator Address',
				name: 'curatorAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['curator'],
						operation: [
							'getCuratorInfo', 'getCuratorVaults', 'getCuratorMarkets',
							'getCuratorPerformance', 'getCuratorFee', 'getCuratorHistory',
						],
					},
				},
				placeholder: '0x...',
				description: 'The address of the vault curator',
			},

			// Proposal ID - used for governance
			{
				displayName: 'Proposal ID',
				name: 'proposalId',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['governance'],
						operation: ['getProposal', 'getProposalState', 'voteOnProposal'],
					},
				},
				placeholder: '1',
				description: 'The ID of the governance proposal',
			},

			// Vote support - for governance voting
			{
				displayName: 'Vote Support',
				name: 'voteSupport',
				type: 'options',
				default: 'for',
				required: true,
				displayOptions: {
					show: {
						resource: ['governance'],
						operation: ['voteOnProposal'],
					},
				},
				options: [
					{ name: 'For', value: 'for' },
					{ name: 'Against', value: 'against' },
					{ name: 'Abstain', value: 'abstain' },
				],
				description: 'Your vote on the proposal',
			},

			// Delegate address - for delegation
			{
				displayName: 'Delegate Address',
				name: 'delegateAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['morphoToken', 'governance'],
						operation: ['delegateMORPHO', 'delegateVotes'],
					},
				},
				placeholder: '0x...',
				description: 'The address to delegate voting power to',
			},

			// Borrower address - for liquidation
			{
				displayName: 'Borrower Address',
				name: 'borrowerAddress',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['liquidation'],
						operation: [
							'getLiquidationInfo', 'liquidatePosition',
							'calculateLiquidationAmount', 'simulateLiquidation',
						],
					},
				},
				placeholder: '0x...',
				description: 'The address of the borrower to liquidate',
			},

			// Seized assets - for liquidation
			{
				displayName: 'Seized Assets',
				name: 'seizedAssets',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['liquidation'],
						operation: ['liquidatePosition'],
					},
				},
				placeholder: '1000000000000000000',
				description: 'Amount of collateral to seize (in wei)',
			},

			// Collateral token - for collateral queries
			{
				displayName: 'Collateral Token',
				name: 'collateralToken',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['collateral'],
						operation: ['getCollateralMarkets'],
					},
				},
				placeholder: '0x...',
				description: 'The address of the collateral token',
			},

			// Query filters
			{
				displayName: 'Network',
				name: 'network',
				type: 'options',
				default: 'ethereum',
				displayOptions: {
					show: {
						resource: ['market', 'vault', 'curator', 'analytics', 'blue', 'subgraph'],
						operation: [
							'getMarkets', 'getWhitelistedMarkets', 'searchMarkets',
							'getVaults',
							'getCurators',
							'getProtocolTVL', 'getProtocolStats', 'getVolumeStats',
							'getMarketRankings', 'getTopSuppliers', 'getTopBorrowers',
							'getBlueMarkets',
							'queryMarkets', 'queryPositions', 'queryTransactions',
							'queryVaults', 'queryLiquidations', 'getSubgraphStatus',
						],
					},
				},
				options: [
					{ name: 'Ethereum', value: 'ethereum' },
					{ name: 'Base', value: 'base' },
				],
				description: 'The network to query',
			},

			// Time range for historical queries
			{
				displayName: 'Time Range',
				name: 'timeRange',
				type: 'options',
				default: '7d',
				displayOptions: {
					show: {
						resource: ['market', 'oracle', 'interestRate', 'analytics', 'risk'],
						operation: [
							'getMarketHistory', 'getHistoricalPrices', 'getRateHistory',
							'getHistoricalData', 'getRiskHistory',
						],
					},
				},
				options: [
					{ name: '24 Hours', value: '24h' },
					{ name: '7 Days', value: '7d' },
					{ name: '30 Days', value: '30d' },
					{ name: '90 Days', value: '90d' },
					{ name: '1 Year', value: '1y' },
					{ name: 'All Time', value: 'all' },
				],
				description: 'Time range for historical data',
			},

			// Limit for list queries
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 10,
				displayOptions: {
					show: {
						resource: ['market', 'vault', 'curator', 'liquidation', 'analytics', 'subgraph'],
						operation: [
							'getMarkets', 'searchMarkets', 'getWhitelistedMarkets',
							'getVaults',
							'getCurators',
							'getLiquidatablePositions', 'getLiquidationHistory',
							'getTopSuppliers', 'getTopBorrowers', 'getMarketRankings',
							'queryMarkets', 'queryPositions', 'queryTransactions',
							'queryVaults', 'queryLiquidations',
						],
					},
				},
				description: 'Maximum number of results to return',
			},

			// Offset for pagination
			{
				displayName: 'Offset',
				name: 'offset',
				type: 'number',
				default: 0,
				displayOptions: {
					show: {
						resource: ['market', 'vault', 'curator', 'liquidation', 'analytics', 'subgraph'],
						operation: [
							'getMarkets', 'searchMarkets', 'getWhitelistedMarkets',
							'getVaults',
							'getCurators',
							'getLiquidatablePositions', 'getLiquidationHistory',
							'getTopSuppliers', 'getTopBorrowers', 'getMarketRankings',
							'queryMarkets', 'queryPositions', 'queryTransactions',
							'queryVaults', 'queryLiquidations',
						],
					},
				},
				description: 'Number of results to skip (for pagination)',
			},

			// Search query
			{
				displayName: 'Search Query',
				name: 'searchQuery',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['market'],
						operation: ['searchMarkets'],
					},
				},
				placeholder: 'WETH, USDC, etc.',
				description: 'Search query for market tokens',
			},

			// Custom GraphQL query
			{
				displayName: 'GraphQL Query',
				name: 'graphqlQuery',
				type: 'string',
				default: '',
				required: true,
				displayOptions: {
					show: {
						resource: ['subgraph'],
						operation: ['customGraphQLQuery'],
					},
				},
				typeOptions: {
					rows: 10,
				},
				placeholder: '{ markets { id loanToken collateralToken } }',
				description: 'Custom GraphQL query to execute',
			},

			// Utilization rate for calculations
			{
				displayName: 'Utilization Rate',
				name: 'utilizationRate',
				type: 'number',
				default: 0.5,
				displayOptions: {
					show: {
						resource: ['interestRate'],
						operation: ['getRateAtUtilization', 'calculateRate'],
					},
				},
				description: 'Utilization rate (0-1) to calculate rate for',
			},

			// Health factor threshold
			{
				displayName: 'Health Factor Threshold',
				name: 'healthThreshold',
				type: 'number',
				default: 1.1,
				displayOptions: {
					show: {
						resource: ['liquidation'],
						operation: ['getLiquidatablePositions'],
					},
				},
				description: 'Maximum health factor to filter positions (below 1.0 is liquidatable)',
			},

			// Asset selection for vault
			{
				displayName: 'Asset',
				name: 'asset',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['vault'],
						operation: ['getVaults'],
					},
				},
				placeholder: '0x... or leave empty for all',
				description: 'Filter vaults by underlying asset address',
			},

			// Protocol for migration
			{
				displayName: 'Source Protocol',
				name: 'sourceProtocol',
				type: 'options',
				default: 'aave',
				displayOptions: {
					show: {
						resource: ['migration'],
						operation: ['checkMigrationEligibility', 'getMigrationQuote', 'estimateGasSavings'],
					},
				},
				options: [
					{ name: 'Aave V2', value: 'aaveV2' },
					{ name: 'Aave V3', value: 'aaveV3' },
					{ name: 'Compound V2', value: 'compoundV2' },
					{ name: 'Compound V3', value: 'compoundV3' },
				],
				description: 'The source protocol to migrate from',
			},

			// Bundle actions for bundler
			{
				displayName: 'Bundle Actions',
				name: 'bundleActions',
				type: 'json',
				default: '[]',
				displayOptions: {
					show: {
						resource: ['bundler'],
						operation: ['executeBundle', 'estimateBundleGas'],
					},
				},
				description: 'Array of bundle actions to execute',
			},

			// On-behalf-of address
			{
				displayName: 'On Behalf Of',
				name: 'onBehalfOf',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['supply', 'borrow', 'vault', 'blue'],
						operation: [
							'supplyAssets', 'supplyCollateral', 'withdrawAssets', 'withdrawCollateral',
							'borrowAssets', 'repayBorrow',
							'depositToVault', 'withdrawFromVault',
							'supplyToBlue', 'borrowFromBlue',
						],
					},
				},
				placeholder: '0x... (leave empty to use own address)',
				description: 'Execute transaction on behalf of another address (if authorized)',
			},

			// Slippage tolerance
			{
				displayName: 'Slippage Tolerance',
				name: 'slippage',
				type: 'number',
				default: 0.5,
				displayOptions: {
					show: {
						resource: ['supply', 'borrow', 'vault', 'migration', 'bundler'],
						operation: [
							'supplyAssets', 'withdrawAssets', 'borrowAssets', 'repayBorrow',
							'depositToVault', 'withdrawFromVault',
							'migrateFromAave', 'migrateFromCompound',
							'executeBundle',
						],
					},
				},
				description: 'Maximum slippage tolerance in percentage (e.g., 0.5 for 0.5%)',
			},

			// Include USD values
			{
				displayName: 'Include USD Values',
				name: 'includeUsd',
				type: 'boolean',
				default: true,
				displayOptions: {
					show: {
						resource: ['position', 'vault', 'analytics'],
						operation: [
							'getPosition', 'getPositionsByUser', 'getPositionValue',
							'getAllPositions', 'getPositionPnL',
							'getVaultInfo', 'getVaultTVL', 'getVaultBalance',
							'getProtocolTVL', 'getUserStats',
						],
					},
				},
				description: 'Include USD value conversions in response',
			},

			// Calculation inputs for utility
			{
				displayName: 'Collateral Value',
				name: 'collateralValue',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility', 'risk'],
						operation: ['calculateHealthFactor'],
					},
				},
				placeholder: '10000',
				description: 'Total collateral value in USD',
			},
			{
				displayName: 'Debt Value',
				name: 'debtValue',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility', 'risk'],
						operation: ['calculateHealthFactor'],
					},
				},
				placeholder: '5000',
				description: 'Total debt value in USD',
			},
			{
				displayName: 'LLTV',
				name: 'lltv',
				type: 'number',
				default: 0.86,
				displayOptions: {
					show: {
						resource: ['utility', 'risk'],
						operation: ['calculateHealthFactor', 'calculateLiquidationPrice'],
					},
				},
				description: 'Liquidation Loan-to-Value ratio (e.g., 0.86 for 86%)',
			},

			// Shares/Assets conversion
			{
				displayName: 'Shares Amount',
				name: 'sharesAmount',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['convertSharesToAssets'],
					},
				},
				placeholder: '1000000000000000000',
				description: 'Amount of shares to convert',
			},
			{
				displayName: 'Assets Amount',
				name: 'assetsAmount',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['convertAssetsToShares'],
					},
				},
				placeholder: '1000000000000000000',
				description: 'Amount of assets to convert',
			},
			{
				displayName: 'Total Supply Assets',
				name: 'totalSupplyAssets',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['convertSharesToAssets', 'convertAssetsToShares'],
					},
				},
				placeholder: '1000000000000000000000',
				description: 'Total supply assets in the market',
			},
			{
				displayName: 'Total Supply Shares',
				name: 'totalSupplyShares',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['convertSharesToAssets', 'convertAssetsToShares'],
					},
				},
				placeholder: '1000000000000000000000',
				description: 'Total supply shares in the market',
			},

			// Rate to APY conversion
			{
				displayName: 'Rate Per Second',
				name: 'ratePerSecond',
				type: 'string',
				default: '',
				displayOptions: {
					show: {
						resource: ['utility'],
						operation: ['calculateAPY'],
					},
				},
				placeholder: '1000000001',
				description: 'Interest rate per second (scaled by 1e18)',
			},
		],
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		showLicenseNotice();

		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const resource = this.getNodeParameter('resource', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		for (let i = 0; i < items.length; i++) {
			try {
				let result: any;

				switch (resource) {
					case 'market':
						result = await market.execute.call(this, operation, i);
						break;
					case 'supply':
						result = await supply.execute.call(this, operation, i);
						break;
					case 'borrow':
						result = await borrow.execute.call(this, operation, i);
						break;
					case 'collateral':
						result = await collateral.execute.call(this, operation, i);
						break;
					case 'position':
						result = await position.execute.call(this, operation, i);
						break;
					case 'vault':
						result = await vault.execute.call(this, operation, i);
						break;
					case 'curator':
						result = await curator.execute.call(this, operation, i);
						break;
					case 'liquidation':
						result = await liquidation.execute.call(this, operation, i);
						break;
					case 'oracle':
						result = await oracle.execute.call(this, operation, i);
						break;
					case 'interestRate':
						result = await interestRate.execute.call(this, operation, i);
						break;
					case 'rewards':
						result = await rewards.execute.call(this, operation, i);
						break;
					case 'morphoToken':
						result = await morphoToken.execute.call(this, operation, i);
						break;
					case 'governance':
						result = await governance.execute.call(this, operation, i);
						break;
					case 'risk':
						result = await risk.execute.call(this, operation, i);
						break;
					case 'analytics':
						result = await analytics.execute.call(this, operation, i);
						break;
					case 'blue':
						result = await blue.execute.call(this, operation, i);
						break;
					case 'migration':
						result = await migration.execute.call(this, operation, i);
						break;
					case 'bundler':
						result = await bundler.execute.call(this, operation, i);
						break;
					case 'subgraph':
						result = await subgraph.execute.call(this, operation, i);
						break;
					case 'utility':
						result = await utility.execute.call(this, operation, i);
						break;
					default:
						throw new Error(`Unknown resource: ${resource}`);
				}

				if (Array.isArray(result)) {
					returnData.push(...result.map(item => ({ json: item })));
				} else {
					returnData.push({ json: result });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					returnData.push({
						json: {
							error: error instanceof Error ? error.message : 'Unknown error',
						},
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
