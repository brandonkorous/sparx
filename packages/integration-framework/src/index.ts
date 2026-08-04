// @sparx/integration-framework — provider plug-in SDK.
//
// Concrete provider packages (@sparx/provider-stripe, @sparx/provider-shippo,
// etc.) implement the interfaces below; the platform discovers them via
// the registry and calls them through providerService at request time.

export * from './context';
export * from './errors';
export * from './metadata';
export * from './registry';
export * from './integration';
export * from './webhook-router';
export * from './oauth';
export * from './secret-crypto';

// Payments are NOT a provider kind — they belong to @sparx/payments' gateway
// registry, which is what every real payment in the platform runs through. The
// `PaymentProvider` contract that used to be exported here had no dispatcher and one
// throwing implementer; see the note on `ProviderBundle` in ./registry.
export type { WebhookEvent } from './webhook-event';

export type { TaxProvider, NormalizedAddress } from './tax-provider';

export type { ShippingProvider, ShippingLabel, TrackingStatus } from './shipping-provider';

// `SubscriptionBilling` was here too, and it went the same way as `PaymentProvider`:
// a full contract, zero implementers, nothing dispatching it, and two doc comments
// elsewhere describing recurring charges as "backed by a SubscriptionBilling provider"
// when subscription-service never called one. Removed under the same rule — a kind
// belongs in this framework only if this framework dispatches it. When recurring
// billing is built for real it will be a gateway capability in @sparx/payments, next
// to the code that already charges cards.

export type {
  DropshipProvider,
  SupplierProduct,
  SupplierCatalogQuery,
  DropshipSubmitInput,
  DropshipSubmitResult,
} from './dropship-provider';
