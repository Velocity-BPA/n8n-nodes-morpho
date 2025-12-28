/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

/**
 * Morpho Protocol Contract Addresses and ABIs
 *
 * This file contains the contract addresses for Morpho Blue,
 * MetaMorpho vaults, and related protocol infrastructure.
 */

// Morpho Blue Core Contract ABI (simplified for common operations)
export const MORPHO_BLUE_ABI = [
  // View functions
  'function market(bytes32 id) view returns (tuple(uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee))',
  'function position(bytes32 id, address user) view returns (uint256 supplyShares, uint128 borrowShares, uint128 collateral)',
  'function idToMarketParams(bytes32 id) view returns (tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv))',
  'function isAuthorized(address authorizer, address authorized) view returns (bool)',
  'function nonce(address authorizer) view returns (uint256)',
  'function owner() view returns (address)',
  'function feeRecipient() view returns (address)',

  // State-changing functions
  'function supply(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsSupplied, uint256 sharesSupplied)',
  'function withdraw(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256 assetsWithdrawn, uint256 sharesWithdrawn)',
  'function borrow(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, address receiver) returns (uint256 assetsBorrowed, uint256 sharesBorrowed)',
  'function repay(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, uint256 shares, address onBehalf, bytes data) returns (uint256 assetsRepaid, uint256 sharesRepaid)',
  'function supplyCollateral(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, bytes data)',
  'function withdrawCollateral(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets, address onBehalf, address receiver)',
  'function liquidate(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, address borrower, uint256 seizedAssets, uint256 repaidShares, bytes data) returns (uint256 seizedAssetsReturned, uint256 repaidAssetsReturned)',
  'function flashLoan(address token, uint256 assets, bytes data)',
  'function setAuthorization(address authorized, bool newIsAuthorized)',
  'function setAuthorizationWithSig(tuple(address authorizer, address authorized, bool isAuthorized, uint256 nonce, uint256 deadline) authorization, tuple(uint8 v, bytes32 r, bytes32 s) signature)',
  'function accrueInterest(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)',
  'function createMarket(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)',

  // Events
  'event Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  'event Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  'event Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
  'event Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
  'event SupplyCollateral(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets)',
  'event WithdrawCollateral(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets)',
  'event Liquidate(bytes32 indexed id, address indexed caller, address indexed borrower, uint256 repaidAssets, uint256 repaidShares, uint256 seizedAssets, uint256 badDebtAssets, uint256 badDebtShares)',
  'event CreateMarket(bytes32 indexed id, tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)',
  'event SetFee(bytes32 indexed id, uint256 newFee)',
  'event SetFeeRecipient(address indexed newFeeRecipient)',
  'event AccrueInterest(bytes32 indexed id, uint256 prevBorrowRate, uint256 interest, uint256 feeShares)',
];

// MetaMorpho Vault ABI (simplified for common operations)
export const META_MORPHO_ABI = [
  // ERC4626 standard view functions
  'function asset() view returns (address)',
  'function totalAssets() view returns (uint256)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function convertToShares(uint256 assets) view returns (uint256)',
  'function convertToAssets(uint256 shares) view returns (uint256)',
  'function maxDeposit(address receiver) view returns (uint256)',
  'function maxMint(address receiver) view returns (uint256)',
  'function maxWithdraw(address owner) view returns (uint256)',
  'function maxRedeem(address owner) view returns (uint256)',
  'function previewDeposit(uint256 assets) view returns (uint256)',
  'function previewMint(uint256 shares) view returns (uint256)',
  'function previewWithdraw(uint256 assets) view returns (uint256)',
  'function previewRedeem(uint256 shares) view returns (uint256)',

  // ERC4626 state-changing functions
  'function deposit(uint256 assets, address receiver) returns (uint256)',
  'function mint(uint256 shares, address receiver) returns (uint256)',
  'function withdraw(uint256 assets, address receiver, address owner) returns (uint256)',
  'function redeem(uint256 shares, address receiver, address owner) returns (uint256)',

  // MetaMorpho specific view functions
  'function curator() view returns (address)',
  'function guardian() view returns (address)',
  'function fee() view returns (uint96)',
  'function feeRecipient() view returns (address)',
  'function skimRecipient() view returns (address)',
  'function timelock() view returns (uint256)',
  'function supplyQueue(uint256 index) view returns (bytes32)',
  'function supplyQueueLength() view returns (uint256)',
  'function withdrawQueue(uint256 index) view returns (bytes32)',
  'function withdrawQueueLength() view returns (uint256)',
  'function config(bytes32 id) view returns (uint184 cap, bool enabled, uint64 removableAt)',
  'function pendingCap(bytes32 id) view returns (uint192 value, uint64 validAt)',
  'function pendingGuardian() view returns (address value, uint64 validAt)',
  'function pendingTimelock() view returns (uint192 value, uint64 validAt)',
  'function lastTotalAssets() view returns (uint256)',
  'function idle() view returns (uint256)',

  // MetaMorpho state-changing functions
  'function submitCap(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 newSupplyCap)',
  'function acceptCap(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)',
  'function setSupplyQueue(bytes32[] newSupplyQueue)',
  'function updateWithdrawQueue(uint256[] indexes)',
  'function reallocate(tuple(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, uint256 assets)[] allocations)',
  'function skim(address token)',

  // Events
  'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
  'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
  'event SubmitCap(address indexed caller, bytes32 indexed id, uint256 cap)',
  'event AcceptCap(address indexed caller, bytes32 indexed id, uint256 cap)',
  'event SetSupplyQueue(address indexed caller, bytes32[] newSupplyQueue)',
  'event SetWithdrawQueue(address indexed caller, bytes32[] newWithdrawQueue)',
  'event Reallocate(address indexed caller, bytes32 indexed id, uint256 suppliedAssets, uint256 suppliedShares)',
];

// Bundler ABI (simplified)
export const BUNDLER_ABI = [
  'function multicall(bytes[] calldata data) payable returns (bytes[] memory)',
  'function initiator() view returns (address)',
];

// Oracle ABI (ChainlinkOracle)
export const CHAINLINK_ORACLE_ABI = [
  'function price() view returns (uint256)',
  'function SCALE_FACTOR() view returns (uint256)',
  'function BASE_FEED_1() view returns (address)',
  'function BASE_FEED_2() view returns (address)',
  'function QUOTE_FEED_1() view returns (address)',
  'function QUOTE_FEED_2() view returns (address)',
];

// Interest Rate Model ABI (Adaptive Curve IRM)
export const ADAPTIVE_CURVE_IRM_ABI = [
  'function borrowRateView(tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams, tuple(uint128 totalSupplyAssets, uint128 totalSupplyShares, uint128 totalBorrowAssets, uint128 totalBorrowShares, uint128 lastUpdate, uint128 fee) market) view returns (uint256)',
  'function rateAtTarget(bytes32 id) view returns (int256)',
  'function CURVE_STEEPNESS() view returns (int256)',
  'function ADJUSTMENT_SPEED() view returns (int256)',
  'function TARGET_UTILIZATION() view returns (int256)',
  'function INITIAL_RATE_AT_TARGET() view returns (int256)',
  'function MIN_RATE_AT_TARGET() view returns (int256)',
  'function MAX_RATE_AT_TARGET() view returns (int256)',
];

// ERC20 ABI (for token interactions)
export const ERC20_ABI = [
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
];

// MORPHO Token ABI (extends ERC20 with governance)
export const MORPHO_TOKEN_ABI = [
  ...ERC20_ABI,
  'function delegate(address delegatee)',
  'function delegates(address account) view returns (address)',
  'function getVotes(address account) view returns (uint256)',
  'function getPastVotes(address account, uint256 blockNumber) view returns (uint256)',
  'function getPastTotalSupply(uint256 blockNumber) view returns (uint256)',
  'function nonces(address owner) view returns (uint256)',
  'function delegateBySig(address delegatee, uint256 nonce, uint256 expiry, uint8 v, bytes32 r, bytes32 s)',
];

// Constants
export const MORPHO_BLUE_ADDRESS = '0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb';
export const MORPHO_TOKEN_ADDRESS = '0x9994E35Db50125E0DF82e4c2dde62496CE330999';

// Max uint256 for approvals
export const MAX_UINT256 = '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

// Shares precision (1e6 for Morpho Blue)
export const SHARES_OFFSET = 6;
export const VIRTUAL_SHARES = 1_000_000n;
export const VIRTUAL_ASSETS = 1n;

// Interest rate constants
export const WAD = 10n ** 18n;
export const SECONDS_PER_YEAR = 365n * 24n * 60n * 60n; // 31536000

// Liquidation constants
export const LIQUIDATION_CURSOR = 0.3; // 30% of max liquidation incentive
export const MAX_LIQUIDATION_INCENTIVE_FACTOR = 1.15; // 15% max bonus

// Market ID calculation
export function calculateMarketId(
  loanToken: string,
  collateralToken: string,
  oracle: string,
  irm: string,
  lltv: bigint,
): string {
  const { ethers } = require('ethers');
  const abiCoder = new ethers.AbiCoder();
  const encoded = abiCoder.encode(
    ['address', 'address', 'address', 'address', 'uint256'],
    [loanToken, collateralToken, oracle, irm, lltv],
  );
  return ethers.keccak256(encoded);
}
