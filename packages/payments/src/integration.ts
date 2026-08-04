// Payments' entry in the shared integration plane (@sparx/integrations).
//
// The gateway catalog stays exactly where it is and keeps its payment-specific
// fields — `checkout: inline | redirect` and `onboarding` decide how checkout
// behaves, and nothing outside payments should know or care. What this module adds
// is the CATALOG FACE: the same seven gateways, projected into the shared descriptor
// so one panel can list "how you get paid" beside shipping, channels and social
// instead of burying it four tabs deep under commerce.
//
// Projection, not replacement. `GatewayDescriptor` is the domain's own richer shape;
// `IntegrationDescriptor` is the public one. Merging them would drag `checkout:
// 'inline'` into a social adapter's type — the exact collapse the plane's contract
// rule forbids.

import {
  defineIntegrationKind,
  type CredentialField as SharedCredentialField,
  type IntegrationDescriptor,
} from '@sparx/integrations';

import { GATEWAY_CATALOG, type GatewayDescriptor } from './catalog';
import type { PaymentGateway } from './gateway';

/** The payments kind — typed on `PaymentGateway`, so every dispatch site keeps the
 *  adapter type it had while the catalog becomes visible platform-wide. */
export const paymentIntegrations = defineIntegrationKind<PaymentGateway>('payments');

/** Gateway capabilities, in an owner's words rather than the flag names. `webhooks`
 *  is deliberately not surfaced — it describes plumbing, not something a business
 *  chooses a processor for. */
function capabilityPhrases(gateway: GatewayDescriptor): string[] {
  const phrases: string[] = [];
  if (gateway.checkout !== 'none') phrases.push('Card payments');
  if (gateway.capabilities.refunds) phrases.push('Refunds');
  if (gateway.capabilities.capture) phrases.push('Charge when you ship');
  if (gateway.capabilities.paymentLinks) phrases.push('Payment links on invoices');
  return phrases;
}

function credentialFields(gateway: GatewayDescriptor): SharedCredentialField[] {
  return gateway.credentialFields.map((field) => ({
    key: field.key,
    label: field.label,
    help: field.help,
    placeholder: field.placeholder,
    secret: field.secret,
    required: field.optional !== true,
    type: field.secret ? 'password' : field.key.endsWith('_url') ? 'url' : 'text',
  }));
}

/** One gateway as the rest of the platform sees it. */
export function gatewayToIntegrationDescriptor(gateway: GatewayDescriptor): IntegrationDescriptor {
  return {
    category: 'payments',
    slug: gateway.id,
    name: gateway.name,
    // The catalog has no vendor column because every entry was a payment processor
    // by definition. On a shared shelf "by …" is how a tenant tells a first-party
    // offer from their own account with a third party, so it is derived here.
    vendor: gateway.sparxFee ? 'sparx' : vendorFor(gateway.id),
    blurb: gateway.blurb,
    publisher: 'sparx',
    availability: gateway.availability === 'coming_soon' ? 'coming_soon' : 'available',
    unavailableReason:
      gateway.availability === 'coming_soon'
        ? `${gateway.name} support is on the way. We will let you know the moment you can switch it on.`
        : undefined,
    recommended: gateway.recommended,
    connect: gateway.onboarding,
    credentialFields: credentialFields(gateway),
    capabilities: capabilityPhrases(gateway),
    regions: gateway.regions,
    docsUrl: gateway.docsUrl,
    // sparx Pay leads the picker (docs/111 D7). Manual sinks to the bottom because it
    // is the "not taking card payments yet" answer rather than a processor, and an
    // unbuilt gateway sits just above it — visible, but never ahead of one that works.
    sortWeight: gateway.recommended
      ? 100
      : gateway.onboarding === 'manual'
        ? -100
        : gateway.availability === 'coming_soon'
          ? -50
          : 0,
  };
}

/** Who the tenant's money relationship is actually with. */
function vendorFor(id: string): string {
  switch (id) {
    case 'stripe_direct':
      return 'Stripe, Inc.';
    case 'square':
      return 'Block, Inc.';
    case 'authorize_net':
      return 'Authorize.net';
    case 'first_pay':
      return '1stPayGateway';
    case 'paypal':
      return 'PayPal Holdings, Inc.';
    default:
      // `custom` and `manual` — the tenant's own processor, or nobody's.
      return 'sparx';
  }
}

/**
 * Publish every gateway into the shared plane.
 *
 * Called from the platform integration bootstrap alongside the other categories.
 * Descriptor-only entries are expected and fine: `manual` has a catalog entry and no
 * adapter, because recording a payment by hand has nothing to dispatch.
 */
export function registerPaymentIntegrations(gateways: readonly PaymentGateway[]): void {
  const adapterById = new Map(gateways.map((g) => [g.id, g]));
  for (const gateway of GATEWAY_CATALOG) {
    paymentIntegrations.register(
      gatewayToIntegrationDescriptor(gateway),
      adapterById.get(gateway.id)
    );
  }
}
