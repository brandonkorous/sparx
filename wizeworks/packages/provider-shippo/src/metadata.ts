// Marketplace metadata for the two bundles this package registers.

import type { ProviderMetadataDescriptor } from '@wizeworks/integration-framework';

export const SHIPPO_SLUG = 'shippo';
export const SPARX_SHIPPING_SLUG = 'sparx-shipping';

export const shippoMetadata: ProviderMetadataDescriptor = {
  slug: SHIPPO_SLUG,
  displayName: 'Shippo',
  description:
    'Real-time rates across 85+ carriers (USPS, UPS, FedEx, DHL, Canada Post, Royal Mail). Label printing, tracking, returns.',
  vendor: 'Shippo, Inc.',
  kinds: ['shipping'],
  supportedCurrencies: ['USD', 'CAD', 'EUR', 'GBP'],
  supportedCountries: ['US', 'CA', 'GB', 'IE', 'AU'],
  sandboxAvailable: true,
  configSchemaJson: JSON.stringify({
    type: 'object',
    required: ['apiToken'],
    properties: {
      apiToken: {
        type: 'string',
        title: 'API token',
        description: "Your Shippo API token, from Shippo's dashboard under API.",
      },
      defaultCarrierAccounts: {
        type: 'array',
        items: { type: 'string' },
        title: 'Carrier account IDs to use by default',
      },
    },
  }),
  webhookPathTemplate: '/v1/webhooks/providers/shippo/:installationId',
  // Shippo doesn't sign its webhooks — trust rides on the URL-embedded
  // installationId the ingress route already resolved before calling us.
  webhookRequiresSignature: false,
  requiredScopes: [],
  secretFields: ['apiToken'],
};

export const sparxShippingMetadata: ProviderMetadataDescriptor = {
  slug: SPARX_SHIPPING_SLUG,
  displayName: 'sparx Shipping',
  description:
    'One-click shipping with discounted USPS, UPS, and FedEx rates. No carrier accounts needed.',
  vendor: 'sparx',
  kinds: ['shipping'],
  supportedCurrencies: ['USD'],
  supportedCountries: ['US'],
  sandboxAvailable: true,
  whitelabelOf: SHIPPO_SLUG,
  configSchemaJson: JSON.stringify({
    type: 'object',
    properties: {
      preferredCarrier: {
        type: 'string',
        enum: ['usps', 'ups', 'fedex'],
        title: 'Preferred carrier',
        default: 'usps',
      },
    },
  }),
  webhookPathTemplate: '/v1/webhooks/providers/sparx-shipping/:installationId',
  webhookRequiresSignature: false,
  requiredScopes: [],
};
