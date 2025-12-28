# n8n-nodes-morpho

> **[Velocity BPA Licensing Notice]**
>
> This n8n node is licensed under the Business Source License 1.1 (BSL 1.1).
>
> Use of this node by for-profit organizations in production environments requires a commercial license from Velocity BPA.
>
> For licensing information, visit https://velobpa.com/licensing or contact licensing@velobpa.com.

A comprehensive n8n community node for the **Morpho DeFi lending protocol**, providing 20 resources and 200+ operations for decentralized lending, borrowing, MetaMorpho vaults, and DeFi analytics. Supports Morpho Blue, liquidations, governance, bundled transactions, and multi-network deployment.

![n8n Community Node](https://img.shields.io/badge/n8n-Community%20Node-blue)
![Morpho Blue](https://img.shields.io/badge/Morpho-Blue-green)
![MetaMorpho](https://img.shields.io/badge/Meta-Morpho-purple)
![License](https://img.shields.io/badge/license-BSL--1.1-blue)
![TypeScript](https://img.shields.io/badge/TypeScript-5.3-blue)
![Ethereum](https://img.shields.io/badge/Ethereum-Mainnet-blueviolet)
![Base](https://img.shields.io/badge/Base-8453-0052FF)

## Features

- **Complete Morpho Blue Integration** - Access the permissionless lending primitive with full market, position, and liquidation support
- **MetaMorpho Vault Operations** - Deposit, withdraw, and manage curated vault strategies
- **Multi-Network Support** - Ethereum Mainnet and Base with custom endpoint configuration
- **Real-Time Monitoring** - Trigger node for supply, borrow, liquidation, and governance events
- **200+ Operations** - Comprehensive coverage of all Morpho protocol functions
- **Bundled Transactions** - Create atomic multi-action bundles for complex operations
- **Risk Analytics** - Health factor monitoring, liquidation alerts, and protocol risk assessment
- **Subgraph Integration** - Query historical data, analytics, and indexed events

## Installation

### Community Nodes (Recommended)

1. Open n8n
2. Go to **Settings** → **Community Nodes**
3. Click **Install a community node**
4. Enter `n8n-nodes-morpho`
5. Click **Install**

### Manual Installation

```bash
# Navigate to your n8n installation
cd ~/.n8n

# Install the package
npm install n8n-nodes-morpho
```

### Development Installation

```bash
# Clone the repository
git clone https://github.com/Velocity-BPA/n8n-nodes-morpho.git
cd n8n-nodes-morpho

# Install dependencies
npm install

# Build the project
npm run build

# Create symlink to n8n custom nodes
mkdir -p ~/.n8n/custom
ln -s $(pwd) ~/.n8n/custom/n8n-nodes-morpho

# Restart n8n
n8n start
```

## Credentials Setup

### Morpho Network Credentials

Configure network access for blockchain interactions:

| Field | Description | Required |
|-------|-------------|----------|
| Network | Ethereum Mainnet, Base, or Custom | Yes |
| RPC Endpoint | Your RPC provider URL (Alchemy, Infura, etc.) | Yes |
| Private Key | Wallet private key for transactions | For write operations |
| Chain ID | Auto-populated based on network | Auto |

### Morpho API Credentials

Configure API and subgraph access:

| Field | Description | Required |
|-------|-------------|----------|
| Subgraph URL | Morpho subgraph endpoint | For analytics |
| API Key | Optional API authentication | No |

## Resources & Operations

### 1. Market Resource (13 operations)
| Operation | Description |
|-----------|-------------|
| Get Markets | List all Morpho Blue markets |
| Get Market Info | Detailed market information |
| Get Market by ID | Query specific market |
| Get Market APY | Current supply/borrow APY |
| Get Market Utilization | Utilization rate and status |
| Get Market Liquidity | Available liquidity |
| Get Market TVL | Total value locked |
| Get Market Parameters | LLTV, oracle, IRM config |
| Get Market Oracle Price | Current oracle price |
| Get Market Caps | Supply/borrow caps |
| Get Whitelisted Markets | Curated market list |
| Search Markets | Filter by token or parameters |
| Get Market History | Historical data from subgraph |

### 2. Supply Resource (12 operations)
| Operation | Description |
|-----------|-------------|
| Supply Assets | Deposit assets to earn yield |
| Supply Collateral | Add collateral to position |
| Get Supply Balance | Current supply balance |
| Get Supply APY | Earning rate |
| Get Supply Shares | Share balance |
| Get Supplied Amount | Assets from shares |
| Withdraw Assets | Remove supplied assets |
| Withdraw Collateral | Remove collateral |
| Withdraw Max | Withdraw all available |
| Get Available to Withdraw | Maximum withdrawable |
| Get Supply Positions | All supply positions |
| Get Supply History | Historical supply events |

### 3. Borrow Resource (11 operations)
| Operation | Description |
|-----------|-------------|
| Borrow Assets | Borrow against collateral |
| Get Borrow Balance | Current borrow balance |
| Get Borrow APY | Borrowing rate |
| Get Borrow Shares | Debt share balance |
| Get Borrowed Amount | Debt from shares |
| Repay Borrow | Repay debt |
| Repay Max | Repay all debt |
| Get Available to Borrow | Maximum borrowable |
| Get Borrow Positions | All borrow positions |
| Get Borrow Capacity | Based on collateral |
| Get Borrow History | Historical borrow events |

### 4. Collateral Resource (8 operations)
| Operation | Description |
|-----------|-------------|
| Supply Collateral | Add collateral |
| Withdraw Collateral | Remove collateral |
| Get Collateral Balance | Current collateral |
| Get Collateral Value | USD value |
| Get Collateral Factor | LLTV percentage |
| Get Liquidation LTV | Liquidation threshold |
| Get Collateral Markets | Markets for asset |
| Get Collateral Positions | All collateral positions |

### 5. Position Resource (11 operations)
| Operation | Description |
|-----------|-------------|
| Get Position | Complete position data |
| Get Positions by User | All user positions |
| Get Position Health | Health factor |
| Get Position Value | Total value |
| Get Collateralization Ratio | LTV ratio |
| Get Liquidation Price | Price at HF=1 |
| Get Position APY | Net APY |
| Get Position PnL | Profit/Loss |
| Get Position History | Historical changes |
| Get All Positions | Protocol-wide positions |
| Close Position | Repay and withdraw |

### 6. Vault Resource - MetaMorpho (16 operations)
| Operation | Description |
|-----------|-------------|
| Get Vaults | List all vaults |
| Get Vault Info | Detailed vault data |
| Get Vault by Address | Query specific vault |
| Get Vault APY | Current yield |
| Get Vault TVL | Total deposits |
| Get Vault Allocation | Market allocations |
| Get Vault Markets | Underlying markets |
| Get Vault Cap | Deposit capacity |
| Get Vault Queue | Reallocation queue |
| Get Vault Fee | Performance fee |
| Get Vault Curator | Curator address |
| Get Vault Performance | Historical returns |
| Deposit to Vault | Deposit assets |
| Withdraw from Vault | Withdraw assets |
| Get Vault Balance | User balance |
| Get Vault Shares | Share balance |

### 7. Curator Resource (7 operations)
| Operation | Description |
|-----------|-------------|
| Get Curators | List all curators |
| Get Curator Info | Curator details |
| Get Curator Vaults | Managed vaults |
| Get Curator Markets | Whitelisted markets |
| Get Curator Performance | Track record |
| Get Curator Fee | Fee structure |
| Get Curator History | Historical actions |

### 8. Liquidation Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Liquidatable Positions | Positions below HF 1 |
| Get Liquidation Info | Position liquidation data |
| Liquidate Position | Execute liquidation |
| Get Liquidation Bonus | Liquidator incentive |
| Get Liquidation History | Past liquidations |
| Get Bad Debt | Protocol bad debt |
| Calculate Liquidation Amount | Max repayable |
| Simulate Liquidation | Preview outcome |
| Get Liquidation Parameters | Market LTV settings |

### 9. Oracle Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Oracle Price | Current price feed |
| Get Oracle Info | Oracle configuration |
| Get Price Feed | Underlying feed |
| Get Historical Prices | Price history |
| Get Oracle by Market | Market's oracle |
| Validate Oracle | Check oracle health |
| Get Price Confidence | Price reliability |
| Get TWAP | Time-weighted price |
| Get Oracle Deviation | Price vs TWAP |

### 10. Interest Rate Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Supply Rate | Current supply rate |
| Get Borrow Rate | Current borrow rate |
| Get Utilization Rate | Market utilization |
| Get Rate at Utilization | Simulate rate |
| Get IRM | Interest rate model |
| Get Rate Parameters | IRM configuration |
| Get Rate History | Historical rates |
| Calculate Rate | Custom calculation |
| Get Optimal Utilization | Target utilization |

### 11. Rewards Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Rewards Info | Rewards program data |
| Get Claimable Rewards | Pending rewards |
| Claim Rewards | Claim to wallet |
| Get Reward Rate | Emission rate |
| Get Reward Token | Token details |
| Get Reward History | Past distributions |
| Get Total Distributed | All-time rewards |
| Get Reward by Market | Market rewards |
| Get Reward by Vault | Vault rewards |

### 12. MORPHO Token Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get MORPHO Balance | Token balance |
| Transfer MORPHO | Send tokens |
| Get MORPHO Price | Current price |
| Get MORPHO Supply | Total supply |
| Get MORPHO Circulating | Circulating supply |
| Get Token Distribution | Allocation data |
| Get Vesting Schedule | Unlock schedule |
| Delegate MORPHO | Delegate voting |
| Get Voting Power | Governance power |

### 13. Governance Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Proposals | All proposals |
| Get Proposal | Specific proposal |
| Get Proposal State | Current state |
| Vote on Proposal | Cast vote |
| Get Voting Power | User voting power |
| Get Vote History | Past votes |
| Get Quorum | Required votes |
| Get Governance Stats | Protocol stats |
| Delegate Votes | Delegate voting |

### 14. Risk Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Risk Parameters | Market risk settings |
| Get LLTV | Liquidation threshold |
| Get Market Risk | Risk assessment score |
| Get Protocol Risk | Protocol-wide risk |
| Get Collateral Risk | Asset-specific risk |
| Get Oracle Risk | Price feed risk |
| Get Bad Debt Risk | Bad debt exposure |
| Calculate Health Factor | Position safety |
| Get Risk History | Historical risk data |

### 15. Analytics Resource (10 operations)
| Operation | Description |
|-----------|-------------|
| Get Protocol TVL | Total value locked |
| Get Protocol Stats | Protocol metrics |
| Get Volume Stats | Transaction volumes |
| Get User Stats | User activity |
| Get Market Rankings | Sorted markets |
| Get Top Suppliers | Largest suppliers |
| Get Top Borrowers | Largest borrowers |
| Get Historical Data | Time-series data |
| Export Analytics | Full data export |
| Get Yield Comparison | Compare APYs |

### 16. Blue Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Get Blue Markets | All Morpho Blue markets |
| Get Blue Market | Specific market |
| Supply to Blue | Direct supply |
| Borrow from Blue | Direct borrow |
| Get Blue Position | Position data |
| Get Blue Parameters | Market config |
| Get Blue Utilization | Utilization rate |
| Get Blue APY | Supply/borrow APY |
| Get Blue Liquidity | Available liquidity |

### 17. Migration Resource (6 operations)
| Operation | Description |
|-----------|-------------|
| Check Migration Eligibility | Can migrate position |
| Migrate from Aave | Aave → Morpho |
| Migrate from Compound | Compound → Morpho |
| Get Migration Quote | Estimate costs |
| Get Migration Status | Check migration |
| Estimate Gas Savings | Morpho gas benefits |

### 18. Bundler Resource (8 operations)
| Operation | Description |
|-----------|-------------|
| Create Bundle | Initialize bundle |
| Add Supply Action | Add supply to bundle |
| Add Borrow Action | Add borrow to bundle |
| Add Repay Action | Add repay to bundle |
| Add Withdraw Action | Add withdraw to bundle |
| Execute Bundle | Execute atomically |
| Get Bundle Status | Check bundle state |
| Estimate Bundle Gas | Gas estimation |

### 19. Subgraph Resource (7 operations)
| Operation | Description |
|-----------|-------------|
| Query Markets | GraphQL market query |
| Query Positions | Position history |
| Query Transactions | Transaction history |
| Query Vaults | Vault data |
| Query Liquidations | Liquidation events |
| Custom GraphQL Query | Arbitrary query |
| Get Subgraph Status | Connection status |

### 20. Utility Resource (9 operations)
| Operation | Description |
|-----------|-------------|
| Convert Shares to Assets | Share conversion |
| Convert Assets to Shares | Asset conversion |
| Calculate APY | Rate to APY |
| Calculate Health Factor | Position health |
| Calculate Liquidation Price | Liquidation price |
| Validate Market ID | Check market exists |
| Get Contract Addresses | Protocol addresses |
| Estimate Gas | Gas estimation |
| Get Network Status | Network health |

## Trigger Node

The **Morpho Trigger** node monitors real-time protocol events:

### Event Categories

| Category | Events |
|----------|--------|
| **Supply** | Supply, Withdraw, SupplyCollateral, WithdrawCollateral, LargeSupply |
| **Borrow** | Borrow, Repay, LargeBorrow |
| **Position** | HealthFactorAlert, PositionAtRisk, PositionUpdated |
| **Liquidation** | Liquidate, BadDebt, LiquidationOpportunity |
| **Market** | CreateMarket, HighUtilization, APYChange, OracleUpdate |
| **Vault** | Deposit, Withdraw, Reallocate, SetFee |
| **Risk** | LowHealthFactor, CriticalUtilization, OracleDeviation, BadDebtAlert |

### Trigger Configuration

| Field | Description |
|-------|-------------|
| Event Type | Category of events to monitor |
| Event Name | Specific event within category |
| Market ID | Filter by market (optional) |
| User Address | Filter by user (optional) |
| Vault Address | Filter by vault (optional) |
| Min Amount | Minimum transaction amount |
| Health Threshold | Health factor alert threshold |
| Poll Interval | Polling frequency (min 10s) |

## Usage Examples

### Supply Assets to a Market

```javascript
// Morpho Node Configuration
{
  "resource": "supply",
  "operation": "supplyAssets",
  "marketId": "0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41",
  "amount": "1000000000000000000", // 1 ETH in wei
  "onBehalfOf": "0xYourAddress"
}
```

### Monitor Health Factor

```javascript
// Morpho Trigger Configuration
{
  "eventType": "position",
  "eventName": "HealthFactorAlert",
  "userAddress": "0xYourAddress",
  "healthThreshold": "1.1"
}
```

### Deposit to MetaMorpho Vault

```javascript
// Morpho Node Configuration
{
  "resource": "vault",
  "operation": "depositToVault",
  "vaultAddress": "0xBEEF01735c132Ada46AA9aA4c54623cAA92A64CB",
  "amount": "1000000", // 1 USDC (6 decimals)
  "receiver": "0xYourAddress"
}
```

### Get Position Health

```javascript
// Morpho Node Configuration
{
  "resource": "position",
  "operation": "getPositionHealth",
  "marketId": "0xc54d7acf14de29e0e5527cabd7a576506870346a78a11a6762e2cca66322ec41",
  "userAddress": "0xYourAddress"
}
```

### Execute Bundled Transaction

```javascript
// Step 1: Create Bundle
{
  "resource": "bundler",
  "operation": "createBundle"
}

// Step 2: Add Actions
{
  "resource": "bundler",
  "operation": "addSupplyAction",
  "bundleId": "{{ $json.bundleId }}",
  "marketId": "0x...",
  "amount": "1000000000000000000"
}

// Step 3: Execute
{
  "resource": "bundler",
  "operation": "executeBundle",
  "bundleId": "{{ $json.bundleId }}"
}
```

## Morpho Protocol Concepts

### Morpho Blue
The permissionless lending primitive allowing anyone to create markets with any collateral, loan token, oracle, and interest rate model.

### MetaMorpho
The curated vault layer built on top of Morpho Blue. Curators manage risk by selecting markets and setting allocations.

### Key Terms

| Term | Description |
|------|-------------|
| **LLTV** | Liquidation Loan-to-Value - maximum LTV before liquidation |
| **Health Factor** | Position safety metric (HF < 1 = liquidatable) |
| **Shares** | Proportional ownership of supply/borrow pools |
| **IRM** | Interest Rate Model - determines rates based on utilization |
| **Curator** | Entity managing vault allocations and risk |
| **Bad Debt** | Uncollateralized debt from underwater liquidations |
| **Bundler** | Smart contract for atomic multi-action transactions |

## Networks

| Network | Chain ID | Morpho Blue Address |
|---------|----------|---------------------|
| Ethereum Mainnet | 1 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |
| Base | 8453 | `0xBBBBBbbBBb9cC5e90e3b3Af64bdAF62C37EEFFCb` |

Morpho uses CREATE2 for deterministic addresses across networks.

## Error Handling

The node provides descriptive error messages for common scenarios:

| Error | Description | Solution |
|-------|-------------|----------|
| Invalid Market ID | Market doesn't exist | Verify market ID format (0x + 64 hex chars) |
| Insufficient Collateral | Not enough collateral for borrow | Add more collateral |
| Health Factor Too Low | Position at risk of liquidation | Repay debt or add collateral |
| Exceeds Supply Cap | Market supply cap reached | Try different market |
| Invalid Oracle Price | Oracle not responding | Check oracle configuration |
| Insufficient Liquidity | Not enough to withdraw/borrow | Wait for liquidity or reduce amount |

## Security Best Practices

1. **Never share private keys** - Use environment variables for credentials
2. **Monitor health factors** - Set up alerts before liquidation threshold
3. **Validate market IDs** - Always verify market existence before operations
4. **Check oracle prices** - Ensure oracle is functioning before large operations
5. **Use test networks first** - Validate workflows on testnets
6. **Set reasonable caps** - Limit transaction amounts
7. **Monitor gas costs** - Estimate gas before execution
8. **Review bundled transactions** - Verify all actions before execution

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Lint
npm run lint

# Format code
npm run format

# Watch mode
npm run dev
```

## Author

**Velocity BPA**
- Website: [velobpa.com](https://velobpa.com)
- GitHub: [Velocity-BPA](https://github.com/Velocity-BPA)

## Licensing

This n8n community node is licensed under the **Business Source License 1.1**.

### Free Use
Permitted for personal, educational, research, and internal business use.

### Commercial Use
Use of this node within any SaaS, PaaS, hosted platform, managed service, or paid automation offering requires a commercial license.

For licensing inquiries: **licensing@velobpa.com**

See [LICENSE](LICENSE), [COMMERCIAL_LICENSE.md](COMMERCIAL_LICENSE.md), and [LICENSING_FAQ.md](LICENSING_FAQ.md) for details.

## Contributing

Contributions are welcome! Please ensure:

1. Code follows existing style conventions
2. All tests pass (`npm test`)
3. Linting passes (`npm run lint`)
4. Documentation is updated for new features
5. Commit messages are descriptive

## Support

- **Issues**: [GitHub Issues](https://github.com/Velocity-BPA/n8n-nodes-morpho/issues)
- **Documentation**: [Morpho Docs](https://docs.morpho.org/)
- **Morpho Discord**: [discord.morpho.org](https://discord.morpho.org)

## Acknowledgments

- [Morpho Labs](https://morpho.org) - Protocol development
- [n8n](https://n8n.io) - Workflow automation platform
- [ethers.js](https://docs.ethers.org) - Ethereum library
- [The Graph](https://thegraph.com) - Subgraph indexing
