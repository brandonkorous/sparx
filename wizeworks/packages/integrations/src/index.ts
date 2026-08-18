// @wizeworks/integrations — the one registry every outside service registers into.
//
// Read `types.ts` first: it carries the rule this package exists to enforce (one
// lookup, many contracts) and why five copied registries cost a real capability.
//
// Domains register into it:
//
//   // @wizeworks/payments
//   export const gateways = defineIntegrationKind<PaymentGateway>('payments');
//   gateways.register(stripeDirectDescriptor, new StripeDirectGateway());
//   gateways.require('stripe_direct').createIntent(…)   // still fully typed
//
// Surfaces read across it:
//
//   listIntegrationDescriptors()                        // everything, one call
//   listIntegrationDescriptors({ category: 'payments' })
//
// `./types` is the side-effect-free subpath for anything that only needs the shapes.

export type {
  CategoryDescriptor,
  ConnectMethod,
  CredentialField,
  IntegrationAvailability,
  IntegrationCategory,
  IntegrationDescriptor,
} from './types.js';
export { INTEGRATION_CATEGORIES } from './types.js';

export type { CategoryGate } from './categories.js';
export { allCategories, categoryInfo, CATEGORY_ORDER, isCategoryUnlocked } from './categories.js';

export type { IntegrationEntry, IntegrationKind } from './registry.js';
export {
  defineIntegrationKind,
  getIntegration,
  IntegrationNotFoundError,
  listIntegrationDescriptors,
  listIntegrations,
  _resetIntegrationsForTest,
} from './registry.js';
