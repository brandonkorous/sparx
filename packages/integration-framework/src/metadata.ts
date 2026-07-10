// Marketplace-side metadata. Mirrors commerce-schemas/providers.ts
// ProviderMetadata but is the package-author-facing shape (literal-typed
// JSON Schema instead of a Zod object) so a provider package can declare
// its install card without depending on Zod at the package surface.

import type { ProviderKind } from '@sparx/commerce-schemas';

export interface ProviderMetadataDescriptor {
  slug: string;
  displayName: string;
  description: string;
  vendor: string;
  logoMediaUrl?: string;
  kinds: ProviderKind[];
  supportedCurrencies: string[];
  supportedCountries: string[];
  sandboxAvailable: boolean;
  whitelabelOf?: string;
  /** JSON Schema (stringified) describing the tenant configuration form. */
  configSchemaJson: string;
  webhookPathTemplate: string;
  requiredScopes: string[];
  /** Whether the inbound webhook route must resolve a signing secret and
   *  a signature header before dispatching to `verifyWebhook`. Defaults
   *  to true (the Stripe-style HMAC model most providers use). Set to
   *  false for providers whose webhooks aren't signed and instead trust
   *  the URL-embedded installationId (e.g. Shippo). */
  webhookRequiresSignature?: boolean;
  /** Property names within `configSchemaJson` whose values are raw secrets
   *  (API keys, tokens) the tenant pastes into the install form. providerService
   *  encrypts these before persisting; the dashboard form renders them masked.
   *  Everything else in the schema round-trips as plain config. */
  secretFields?: string[];
}
