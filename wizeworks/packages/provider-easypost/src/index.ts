// @wizeworks/provider-easypost — EasyPost ShippingProvider with freight
// support for oversized / palletized shipments.

import type { RateOption, ShipmentRequest } from '@wizeworks/commerce-schemas';
import {
  ProviderUnsupportedError,
  registerProvider,
  WebhookVerificationError,
} from '@wizeworks/integration-framework';
import type {
  ProviderBundle,
  ProviderMetadataDescriptor,
  ProviderRunContext,
  ShippingLabel,
  ShippingProvider,
  TrackingStatus,
  WebhookEvent,
} from '@wizeworks/integration-framework';

const EASYPOST_SLUG = 'easypost';

const easypostMetadata: ProviderMetadataDescriptor = {
  slug: EASYPOST_SLUG,
  displayName: 'EasyPost',
  description:
    'Multi-carrier with deep US coverage: USPS, UPS, FedEx, DHL, Lasership, OnTrac, freight (FedEx Freight, ABF, Estes, YRC, Saia). Real-time rates, label printing, scan-based returns.',
  vendor: 'EasyPost, Inc.',
  kinds: ['shipping'],
  // Built, registered, and not yet connectable — every method throws
  // ProviderUnsupportedError. Declaring it is what lets the bundle be REGISTERED
  // instead of left out: this package shipped complete and unregistered, so the
  // catalog advertised EasyPost while nothing in the platform had ever heard of it.
  availability: 'coming_soon',
  supportedCurrencies: ['USD', 'CAD'],
  supportedCountries: ['US', 'CA'],
  sandboxAvailable: true,
  configSchemaJson: JSON.stringify({
    type: 'object',
    required: ['apiKeyRef'],
    properties: {
      apiKeyRef: {
        type: 'string',
        title: 'API key (Secret Manager ref)',
      },
      enabledCarriers: {
        type: 'array',
        items: {
          type: 'string',
          enum: ['usps', 'ups', 'fedex', 'dhl_express', 'ontrac', 'lasership', 'fedex_freight'],
        },
        title: 'Enabled carriers',
      },
      defaultPackageType: {
        type: 'string',
        title: 'Default package type',
        default: 'Parcel',
      },
    },
  }),
  webhookPathTemplate: '/v1/webhooks/providers/easypost/:installationId',
  requiredScopes: [],
};

function unimplemented(method: string): Promise<never> {
  return Promise.reject(new ProviderUnsupportedError('easypost', `${method} (Phase 0 stub)`));
}

const easypostShipping: ShippingProvider = {
  metadata: easypostMetadata,
  rateShipment(_ctx: ProviderRunContext, _r: ShipmentRequest): Promise<RateOption[]> {
    return unimplemented('rateShipment');
  },
  buyLabel(): Promise<ShippingLabel> {
    return unimplemented('buyLabel');
  },
  track(): Promise<TrackingStatus> {
    return unimplemented('track');
  },
  voidLabel(): Promise<void> {
    return unimplemented('voidLabel');
  },
  verifyWebhook(): WebhookEvent {
    throw new WebhookVerificationError('easypost', 'EasyPost webhook verification (Phase 0 stub)');
  },
};

export const easypostBundle: ProviderBundle = {
  metadata: easypostMetadata,
  shipping: easypostShipping,
};

export function registerEasypostProviders(): void {
  registerProvider(easypostBundle);
}
