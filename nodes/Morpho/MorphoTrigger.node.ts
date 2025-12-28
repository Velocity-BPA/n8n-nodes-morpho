/**
 * @file MorphoTrigger Node for n8n
 * @description Real-time event monitoring for Morpho DeFi protocol
 *
 * [Velocity BPA Licensing Notice]
 * This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
 * Use by for-profit organizations in production requires a commercial license.
 * For licensing: https://velobpa.com/licensing or licensing@velobpa.com
 */

import type {
	IDataObject,
	INodeType,
	INodeTypeDescription,
	ITriggerFunctions,
	ITriggerResponse,
} from 'n8n-workflow';
import { ethers } from 'ethers';
import { NETWORK_CONFIGS } from './constants/networks';
import { MORPHO_CONTRACTS } from './constants/contracts';

// License notice flag
let licenseNoticeShown = false;

export class MorphoTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'Morpho Trigger',
		name: 'morphoTrigger',
		icon: 'file:morpho.svg',
		group: ['trigger'],
		version: 1,
		subtitle: '={{$parameter["event"]}}',
		description: 'Trigger workflows on Morpho DeFi protocol events',
		defaults: {
			name: 'Morpho Trigger',
		},
		inputs: [],
		outputs: ['main'],
		credentials: [
			{
				name: 'morphoNetwork',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Event Type',
				name: 'eventType',
				type: 'options',
				options: [
					{
						name: 'Supply Events',
						value: 'supply',
					},
					{
						name: 'Borrow Events',
						value: 'borrow',
					},
					{
						name: 'Position Events',
						value: 'position',
					},
					{
						name: 'Liquidation Events',
						value: 'liquidation',
					},
					{
						name: 'Market Events',
						value: 'market',
					},
					{
						name: 'Vault Events',
						value: 'vault',
					},
					{
						name: 'Risk Alerts',
						value: 'risk',
					},
				],
				default: 'supply',
				description: 'Type of event to monitor',
			},

			// Supply Events
			{
				displayName: 'Supply Event',
				name: 'supplyEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['supply'],
					},
				},
				options: [
					{
						name: 'Supply Made',
						value: 'Supply',
					},
					{
						name: 'Supply Withdrawn',
						value: 'Withdraw',
					},
					{
						name: 'Collateral Supplied',
						value: 'SupplyCollateral',
					},
					{
						name: 'Collateral Withdrawn',
						value: 'WithdrawCollateral',
					},
					{
						name: 'Large Supply (>$100k)',
						value: 'LargeSupply',
					},
				],
				default: 'Supply',
			},

			// Borrow Events
			{
				displayName: 'Borrow Event',
				name: 'borrowEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['borrow'],
					},
				},
				options: [
					{
						name: 'Borrow Made',
						value: 'Borrow',
					},
					{
						name: 'Borrow Repaid',
						value: 'Repay',
					},
					{
						name: 'Large Borrow (>$100k)',
						value: 'LargeBorrow',
					},
				],
				default: 'Borrow',
			},

			// Position Events
			{
				displayName: 'Position Event',
				name: 'positionEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['position'],
					},
				},
				options: [
					{
						name: 'Health Factor Alert',
						value: 'HealthFactorAlert',
					},
					{
						name: 'Position at Risk',
						value: 'PositionAtRisk',
					},
					{
						name: 'Position Updated',
						value: 'PositionUpdated',
					},
				],
				default: 'HealthFactorAlert',
			},

			// Liquidation Events
			{
				displayName: 'Liquidation Event',
				name: 'liquidationEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['liquidation'],
					},
				},
				options: [
					{
						name: 'Liquidation Occurred',
						value: 'Liquidate',
					},
					{
						name: 'Bad Debt Created',
						value: 'BadDebt',
					},
					{
						name: 'Liquidation Opportunity',
						value: 'LiquidationOpportunity',
					},
				],
				default: 'Liquidate',
			},

			// Market Events
			{
				displayName: 'Market Event',
				name: 'marketEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['market'],
					},
				},
				options: [
					{
						name: 'Market Created',
						value: 'CreateMarket',
					},
					{
						name: 'High Utilization (>90%)',
						value: 'HighUtilization',
					},
					{
						name: 'APY Changed Significantly',
						value: 'APYChange',
					},
					{
						name: 'Oracle Price Updated',
						value: 'OracleUpdate',
					},
				],
				default: 'CreateMarket',
			},

			// Vault Events
			{
				displayName: 'Vault Event',
				name: 'vaultEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['vault'],
					},
				},
				options: [
					{
						name: 'Vault Deposit',
						value: 'Deposit',
					},
					{
						name: 'Vault Withdrawal',
						value: 'Withdraw',
					},
					{
						name: 'Vault Rebalanced',
						value: 'Reallocate',
					},
					{
						name: 'Fee Updated',
						value: 'SetFee',
					},
				],
				default: 'Deposit',
			},

			// Risk Alerts
			{
				displayName: 'Risk Alert',
				name: 'riskEvent',
				type: 'options',
				displayOptions: {
					show: {
						eventType: ['risk'],
					},
				},
				options: [
					{
						name: 'Low Health Factor (<1.1)',
						value: 'LowHealthFactor',
					},
					{
						name: 'High Utilization (>95%)',
						value: 'CriticalUtilization',
					},
					{
						name: 'Oracle Deviation',
						value: 'OracleDeviation',
					},
					{
						name: 'Bad Debt Accumulation',
						value: 'BadDebtAlert',
					},
				],
				default: 'LowHealthFactor',
			},

			// Filter Options
			{
				displayName: 'Market ID Filter',
				name: 'marketIdFilter',
				type: 'string',
				default: '',
				description: 'Filter events by specific market ID (leave empty for all)',
				placeholder: '0x...',
			},
			{
				displayName: 'User Address Filter',
				name: 'userAddressFilter',
				type: 'string',
				default: '',
				description: 'Filter events by specific user address (leave empty for all)',
				placeholder: '0x...',
			},
			{
				displayName: 'Vault Address Filter',
				name: 'vaultAddressFilter',
				type: 'string',
				default: '',
				description: 'Filter vault events by specific vault address',
				displayOptions: {
					show: {
						eventType: ['vault'],
					},
				},
			},
			{
				displayName: 'Minimum Amount (Wei)',
				name: 'minAmount',
				type: 'string',
				default: '',
				description: 'Minimum amount to trigger (in wei)',
			},
			{
				displayName: 'Health Factor Threshold',
				name: 'healthThreshold',
				type: 'number',
				default: 1.1,
				description: 'Health factor threshold for alerts',
				displayOptions: {
					show: {
						eventType: ['position', 'risk'],
					},
				},
			},
			{
				displayName: 'Polling Interval (seconds)',
				name: 'pollInterval',
				type: 'number',
				default: 60,
				description: 'How often to check for events (minimum 10 seconds)',
			},
		],
	};

	async trigger(this: ITriggerFunctions): Promise<ITriggerResponse> {
		// Show license notice once per session
		if (!licenseNoticeShown) {
			this.logger.warn(`
[Velocity BPA Licensing Notice]
This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
Use by for-profit organizations in production requires a commercial license.
For licensing: https://velobpa.com/licensing or licensing@velobpa.com
			`);
			licenseNoticeShown = true;
		}

		const eventType = this.getNodeParameter('eventType') as string;
		const pollInterval = Math.max(10, this.getNodeParameter('pollInterval') as number);
		const marketIdFilter = this.getNodeParameter('marketIdFilter', '') as string;
		const userAddressFilter = this.getNodeParameter('userAddressFilter', '') as string;
		const minAmount = this.getNodeParameter('minAmount', '') as string;

		// Get credentials
		const credentials = await this.getCredentials('morphoNetwork');
		const network = credentials.network as string;
		const rpcUrl = credentials.rpcEndpoint as string;

		// Create provider
		const provider = new ethers.JsonRpcProvider(rpcUrl);

		// Get contract addresses
		const networkKey = network as keyof typeof MORPHO_CONTRACTS;
		const contracts = MORPHO_CONTRACTS[networkKey];

		if (!contracts) {
			throw new Error(`Unsupported network: ${network}`);
		}

		// Morpho Blue ABI (events only)
		const morphoABI = [
			'event Supply(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
			'event Withdraw(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
			'event Borrow(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets, uint256 shares)',
			'event Repay(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets, uint256 shares)',
			'event SupplyCollateral(bytes32 indexed id, address indexed caller, address indexed onBehalf, uint256 assets)',
			'event WithdrawCollateral(bytes32 indexed id, address caller, address indexed onBehalf, address indexed receiver, uint256 assets)',
			'event Liquidate(bytes32 indexed id, address indexed caller, address indexed borrower, uint256 repaidAssets, uint256 repaidShares, uint256 seizedAssets, uint256 badDebtAssets, uint256 badDebtShares)',
			'event CreateMarket(bytes32 indexed id, tuple(address loanToken, address collateralToken, address oracle, address irm, uint256 lltv) marketParams)',
		];

		// MetaMorpho ABI (vault events)
		const vaultABI = [
			'event Deposit(address indexed sender, address indexed owner, uint256 assets, uint256 shares)',
			'event Withdraw(address indexed sender, address indexed receiver, address indexed owner, uint256 assets, uint256 shares)',
			'event Reallocate(address indexed caller, bytes32 indexed id, uint256 suppliedAssets, uint256 suppliedShares, uint256 withdrawnAssets, uint256 withdrawnShares)',
			'event SetFee(address indexed caller, uint256 newFee)',
		];

		const morphoContract = new ethers.Contract(contracts.morpho, morphoABI, provider);

		// Track last processed block
		let lastBlock = await provider.getBlockNumber();

		// Get specific event based on type
		const getEventName = (): string => {
			switch (eventType) {
				case 'supply':
					return this.getNodeParameter('supplyEvent') as string;
				case 'borrow':
					return this.getNodeParameter('borrowEvent') as string;
				case 'position':
					return this.getNodeParameter('positionEvent') as string;
				case 'liquidation':
					return this.getNodeParameter('liquidationEvent') as string;
				case 'market':
					return this.getNodeParameter('marketEvent') as string;
				case 'vault':
					return this.getNodeParameter('vaultEvent') as string;
				case 'risk':
					return this.getNodeParameter('riskEvent') as string;
				default:
					return 'Supply';
			}
		};

		const eventName = getEventName();

		// Polling function
		const checkForEvents = async () => {
			try {
				const currentBlock = await provider.getBlockNumber();

				if (currentBlock <= lastBlock) {
					return;
				}

				// Get events from last processed block to current
				const fromBlock = lastBlock + 1;
				const toBlock = currentBlock;

				let events: ethers.EventLog[] = [];

				// Query appropriate events based on type
				switch (eventName) {
					case 'Supply':
					case 'Withdraw':
					case 'Borrow':
					case 'Repay':
					case 'SupplyCollateral':
					case 'WithdrawCollateral':
					case 'Liquidate':
					case 'CreateMarket':
						const filter = morphoContract.filters[eventName]?.();
						if (filter) {
							const rawEvents = await morphoContract.queryFilter(filter, fromBlock, toBlock);
							events = rawEvents.filter((e): e is ethers.EventLog => 'args' in e);
						}
						break;

					case 'LargeSupply':
						const supplyFilter = morphoContract.filters.Supply?.();
						if (supplyFilter) {
							const supplyEvents = await morphoContract.queryFilter(supplyFilter, fromBlock, toBlock);
							events = supplyEvents.filter((e): e is ethers.EventLog => {
								if (!('args' in e)) return false;
								const amount = (e as ethers.EventLog).args?.assets;
								const minAmountBigInt = minAmount ? BigInt(minAmount) : BigInt('100000000000000000000000'); // 100k with 18 decimals
								return amount >= minAmountBigInt;
							});
						}
						break;

					case 'LargeBorrow':
						const borrowFilter = morphoContract.filters.Borrow?.();
						if (borrowFilter) {
							const borrowEvents = await morphoContract.queryFilter(borrowFilter, fromBlock, toBlock);
							events = borrowEvents.filter((e): e is ethers.EventLog => {
								if (!('args' in e)) return false;
								const amount = (e as ethers.EventLog).args?.assets;
								const minAmountBigInt = minAmount ? BigInt(minAmount) : BigInt('100000000000000000000000');
								return amount >= minAmountBigInt;
							});
						}
						break;

					case 'BadDebt':
						const liquidateFilter = morphoContract.filters.Liquidate?.();
						if (liquidateFilter) {
							const liquidateEvents = await morphoContract.queryFilter(liquidateFilter, fromBlock, toBlock);
							events = liquidateEvents.filter((e): e is ethers.EventLog => {
								if (!('args' in e)) return false;
								const badDebt = (e as ethers.EventLog).args?.badDebtAssets;
								return badDebt > 0n;
							});
						}
						break;

					default:
						// For alert-type events, we'd need to implement custom logic
						// These would typically poll state and check thresholds
						break;
				}

				// Apply filters
				if (marketIdFilter) {
					events = events.filter(e => {
						const id = e.args?.id;
						return id && id.toLowerCase() === marketIdFilter.toLowerCase();
					});
				}

				if (userAddressFilter) {
					events = events.filter(e => {
						const onBehalf = e.args?.onBehalf || e.args?.borrower || e.args?.caller;
						return onBehalf && onBehalf.toLowerCase() === userAddressFilter.toLowerCase();
					});
				}

				if (minAmount && !['LargeSupply', 'LargeBorrow'].includes(eventName)) {
					const minAmountBigInt = BigInt(minAmount);
					events = events.filter(e => {
						const assets = e.args?.assets || e.args?.repaidAssets || 0n;
						return assets >= minAmountBigInt;
					});
				}

				// Emit events
				for (const event of events) {
					const eventData: IDataObject = {
						eventType: eventName,
						network,
						blockNumber: event.blockNumber,
						transactionHash: event.transactionHash,
						logIndex: event.index,
						timestamp: new Date().toISOString(),
					};

					// Add event-specific data
					if (event.args) {
						const args = event.args;
						eventData.marketId = args.id?.toString();
						eventData.caller = args.caller?.toString();
						eventData.onBehalf = args.onBehalf?.toString();
						eventData.receiver = args.receiver?.toString();
						eventData.assets = args.assets?.toString();
						eventData.shares = args.shares?.toString();

						if (eventName === 'Liquidate') {
							eventData.borrower = args.borrower?.toString();
							eventData.repaidAssets = args.repaidAssets?.toString();
							eventData.seizedAssets = args.seizedAssets?.toString();
							eventData.badDebtAssets = args.badDebtAssets?.toString();
						}
					}

					this.emit([this.helpers.returnJsonArray([eventData])]);
				}

				lastBlock = currentBlock;
			} catch (error) {
				this.logger.error(`Error checking for events: ${error instanceof Error ? error.message : 'Unknown error'}`);
			}
		};

		// Start polling
		const intervalId = setInterval(checkForEvents, pollInterval * 1000);

		// Initial check
		await checkForEvents();

		// Cleanup function
		const closeFunction = async () => {
			clearInterval(intervalId);
		};

		return {
			closeFunction,
		};
	}
}
