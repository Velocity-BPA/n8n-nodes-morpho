/*
 * Copyright (c) Velocity BPA, LLC
 * Licensed under the Business Source License 1.1
 * Commercial use requires a separate commercial license.
 * See LICENSE file for details.
 */

import type {
  IAuthenticateGeneric,
  ICredentialTestRequest,
  ICredentialType,
  INodeProperties,
} from 'n8n-workflow';

/**
 * Morpho Network Credentials
 *
 * Provides connectivity to Morpho Blue protocol on supported networks.
 * Supports Ethereum Mainnet, Base, and custom RPC endpoints.
 *
 * SECURITY WARNING: Never share or expose your private key.
 * Use hardware wallets or secure key management in production.
 */
export class MorphoNetwork implements ICredentialType {
  name = 'morphoNetwork';
  displayName = 'Morpho Network';
  documentationUrl = 'https://docs.morpho.org';
  properties: INodeProperties[] = [
    {
      displayName: 'Network',
      name: 'network',
      type: 'options',
      default: 'ethereum',
      options: [
        {
          name: 'Ethereum Mainnet',
          value: 'ethereum',
        },
        {
          name: 'Base',
          value: 'base',
        },
        {
          name: 'Custom',
          value: 'custom',
        },
      ],
      description: 'The blockchain network to connect to',
    },
    {
      displayName: 'RPC Endpoint URL',
      name: 'rpcUrl',
      type: 'string',
      default: '',
      placeholder: 'https://eth-mainnet.g.alchemy.com/v2/YOUR-API-KEY',
      description:
        'The RPC endpoint URL. For Ethereum/Base, leave empty to use defaults, or provide your own RPC (recommended for production).',
    },
    {
      displayName: 'Private Key',
      name: 'privateKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description:
        'Your wallet private key for signing transactions. NEVER share this with anyone. Required for write operations (supply, borrow, etc.).',
    },
    {
      displayName: 'Chain ID',
      name: 'chainId',
      type: 'number',
      default: 1,
      description:
        'The chain ID of the network. Auto-populated based on network selection (Ethereum: 1, Base: 8453).',
    },
    {
      displayName: 'Subgraph Endpoint',
      name: 'subgraphUrl',
      type: 'string',
      default: '',
      placeholder: 'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue',
      description:
        'Optional: Custom Morpho subgraph endpoint for historical data queries. Leave empty to use default.',
    },
    {
      displayName: 'Read-Only Mode',
      name: 'readOnly',
      type: 'boolean',
      default: false,
      description:
        'Whether to operate in read-only mode (no private key required for queries only)',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {},
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.rpcUrl || "https://eth.llamarpc.com"}}',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        method: 'eth_chainId',
        params: [],
        id: 1,
      }),
    },
  };
}
