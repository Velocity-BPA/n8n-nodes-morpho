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
 * Morpho API Credentials
 *
 * Provides access to Morpho's API and subgraph endpoints
 * for querying protocol data, analytics, and historical information.
 */
export class MorphoApi implements ICredentialType {
  name = 'morphoApi';
  displayName = 'Morpho API';
  documentationUrl = 'https://docs.morpho.org';
  properties: INodeProperties[] = [
    {
      displayName: 'API Endpoint',
      name: 'apiEndpoint',
      type: 'string',
      default: 'https://blue-api.morpho.org/graphql',
      description: 'The Morpho API endpoint URL',
    },
    {
      displayName: 'Subgraph URL (Ethereum)',
      name: 'subgraphUrlEthereum',
      type: 'string',
      default:
        'https://api.thegraph.com/subgraphs/name/morpho-org/morpho-blue',
      description: 'The Morpho subgraph endpoint for Ethereum Mainnet',
    },
    {
      displayName: 'Subgraph URL (Base)',
      name: 'subgraphUrlBase',
      type: 'string',
      default:
        'https://api.studio.thegraph.com/query/48129/morpho-blue-base/version/latest',
      description: 'The Morpho subgraph endpoint for Base',
    },
    {
      displayName: 'API Key',
      name: 'apiKey',
      type: 'string',
      typeOptions: {
        password: true,
      },
      default: '',
      description:
        'Optional: API key for authenticated access (if applicable)',
    },
    {
      displayName: 'Request Timeout (ms)',
      name: 'timeout',
      type: 'number',
      default: 30000,
      description: 'Request timeout in milliseconds',
    },
    {
      displayName: 'Retry Count',
      name: 'retryCount',
      type: 'number',
      default: 3,
      description: 'Number of retry attempts for failed requests',
    },
  ];

  authenticate: IAuthenticateGeneric = {
    type: 'generic',
    properties: {
      headers: {
        Authorization: '={{$credentials.apiKey ? "Bearer " + $credentials.apiKey : ""}}',
      },
    },
  };

  test: ICredentialTestRequest = {
    request: {
      baseURL: '={{$credentials.apiEndpoint}}',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        query: '{ __typename }',
      }),
    },
  };
}
