// Provider bundles' entry in the shared integration plane (@wizeworks/integrations).
//
// A bundle keeps its own contracts (`ShippingProvider`, `TaxProvider`, …) and its own
// dispatch through providerService. What this adds is the catalog face, so a carrier
// or a tax service lists beside payments, channels, social and suppliers in one panel.
//
// One bundle can be several kinds, so it yields one descriptor PER kind — a package
// implementing shipping and tax appears under both headings, which is what a tenant
// looking for "sales tax" expects to find.
//
// `payment` is deliberately unmapped. Payments come from @wizeworks/payments' gateway
// catalog; this framework has no payment dispatcher and no longer declares a payment
// contract (see the note on `ProviderBundle`). Mapping it here would rebuild the
// duplicate abstraction through the back door.

import type { ProviderKind } from '@wizeworks/commerce-schemas';
import {
  defineIntegrationKind,
  type CredentialField,
  type IntegrationAvailability,
  type IntegrationCategory,
  type IntegrationDescriptor,
} from '@wizeworks/integrations';

import type { ProviderMetadataDescriptor } from './metadata';
import { listProviders, type ProviderBundle } from './registry';

/** The kinds this framework actually dispatches, mapped to their shelf. A kind absent
 *  from this map does not appear in the catalog — which is the enforcement point for
 *  "a kind belongs here only if this registry dispatches it". */
// `subscription_billing` and `identity` are absent because this framework does not
// dispatch them — `SubscriptionBilling` has been deleted outright and `identity` never
// had a contract at all. `payment` is absent for the same reason and a longer story;
// see the note on `ProviderBundle`.
const KIND_TO_CATEGORY: Partial<Record<ProviderKind, IntegrationCategory>> = {
  shipping: 'shipping',
  tax: 'tax',
  dropship: 'dropship',
};

export const shippingIntegrations = defineIntegrationKind<ProviderBundle>('shipping');
export const taxIntegrations = defineIntegrationKind<ProviderBundle>('tax');

function kindFacade(category: IntegrationCategory) {
  switch (category) {
    case 'shipping':
      return shippingIntegrations;
    case 'tax':
      return taxIntegrations;
    default:
      // `dropship` maps to a category, but @wizeworks/dropship owns that shelf — a bundle
      // declaring the kind would be a second publisher of the same slugs.
      return null;
  }
}

/** Turn the bundle's JSON Schema into the shared field list. The schema is the
 *  package-author-facing shape; the plane's `CredentialField` is what a form renders,
 *  so the translation happens once here instead of in every surface. */
function credentialFields(metadata: ProviderMetadataDescriptor): CredentialField[] {
  interface RawProperty {
    type?: string;
    title?: string;
    description?: string;
    enum?: string[];
  }
  let schema: { required?: string[]; properties?: Record<string, RawProperty> };
  try {
    schema = JSON.parse(metadata.configSchemaJson) as typeof schema;
  } catch {
    return [];
  }
  const required = new Set(schema.required ?? []);
  const secrets = new Set(metadata.secretFields ?? []);

  return Object.entries(schema.properties ?? {}).map(([key, prop]) => ({
    key,
    label: prop.title ?? key,
    help: prop.description,
    secret: secrets.has(key),
    required: required.has(key),
    type: secrets.has(key)
      ? ('password' as const)
      : Array.isArray(prop.enum) && prop.enum.length > 0
        ? ('select' as const)
        : prop.type === 'boolean'
          ? ('boolean' as const)
          : ('text' as const),
    options: prop.enum,
  }));
}

function availabilityOf(metadata: ProviderMetadataDescriptor): {
  availability: IntegrationAvailability;
  reason?: string;
} {
  if (metadata.availability === 'coming_soon') {
    return {
      availability: 'coming_soon',
      reason: `${metadata.displayName} support is on the way. We will let you know the moment you can connect it.`,
    };
  }
  return { availability: 'available' };
}

export function bundleToIntegrationDescriptors(bundle: ProviderBundle): IntegrationDescriptor[] {
  const { metadata } = bundle;
  const { availability, reason } = availabilityOf(metadata);
  const fields = credentialFields(metadata);

  return metadata.kinds
    .map((kind) => KIND_TO_CATEGORY[kind])
    .filter((category): category is IntegrationCategory => category !== undefined)
    .map((category) => ({
      category,
      slug: metadata.slug,
      name: metadata.displayName,
      vendor: metadata.vendor,
      blurb: metadata.description,
      publisher: 'sparx',
      availability,
      unavailableReason: reason,
      // Every shipped bundle captures keys in a form; none of them is OAuth yet.
      connect: 'api_keys' as const,
      credentialFields: fields,
      capabilities: [],
      regions: metadata.supportedCountries,
      logoUrl: metadata.logoMediaUrl,
      // A sparx-branded white label leads its category — it is the one a tenant can use
      // without opening an account somewhere else first.
      sortWeight: metadata.whitelabelOf ? 50 : 0,
    }));
}

/** Publish every registered bundle into the shared plane. Runs after the bundles have
 *  registered, so nothing that failed to register is advertised. */
export function registerProviderIntegrations(): void {
  for (const bundle of listProviders()) {
    for (const descriptor of bundleToIntegrationDescriptors(bundle)) {
      kindFacade(descriptor.category)?.register(descriptor, bundle);
    }
  }
}
