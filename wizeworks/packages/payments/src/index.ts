// @wizeworks/payments — vendor-agnostic payment gateway abstraction (docs/94 ADR).
// Every payment flow (storefront checkout, invoice payment links, B2B order
// payments) calls PaymentService and never knows which gateway is behind it.
// sparx Pay = Stripe Connect destination charges (flat 0.5% via application_fee);
// Stripe Direct = the merchant's own account (no platform fee).

export type {
  PaymentGateway,
  PaymentIntent,
  PaymentIntentStatus,
  PaymentResult,
  RefundResult,
  WebhookEvent,
  ParsedWebhookEvent,
  NormalizedPaymentData,
  CreatePaymentIntentParams,
  RefundParams,
  CreatePaymentLinkParams,
  CreateSetupSessionParams,
  SetupSession,
  CompleteVaultParams,
  VaultedMethod,
  ChargeStoredMethodParams,
  StoredChargeResult,
} from './gateway';

export {
  gatewayCatalog,
  gatewayCatalogTemplate,
  CATALOG_GATEWAY_IDS,
  getGatewayDescriptor,
  isApiKeyGateway,
  type GatewayDescriptor,
  type GatewayCapabilities,
  type CredentialField,
  type GatewayOnboarding,
  type GatewayCheckout,
} from './catalog';

export {
  type GatewayCredentials,
  type GatewayCredentialReader,
  GatewayCredentialsMissingError,
  setGatewayCredentialReader,
  getGatewayCredentialReader,
  requireGatewayCredentials,
} from './credentials';

export { gatewayRegistry, registerBuiltInGateways, GatewayNotFoundError } from './registry';

// Whether a payment can be reversed by calling a gateway at all. Both refund
// paths ask this, so it is one answer rather than two that drift.
export { GATEWAY_PROCESSORS, takenByGateway } from './processors';

// The shared-plane face of the gateway catalog (@wizeworks/integrations).
export {
  paymentIntegrations,
  gatewayToIntegrationDescriptor,
  registerPaymentIntegrations,
} from './integration';

export {
  PaymentService,
  paymentService,
  PaymentConfigError,
  StoredMethodsUnsupportedError,
} from './service';

export { SPARX_PAY_FEE_RATE, sparxPayFeeCents } from './fee';

export {
  getPlatformStripe,
  stripeForKey,
  resetPlatformStripeForTesting,
  STRIPE_API_VERSION,
} from './client';

export {
  type PaymentSecretReader,
  PaymentSecretNotFoundError,
  envPaymentSecretReader,
  mapPaymentSecretReader,
  setPaymentSecretReader,
  getPaymentSecretReader,
  credentialRef,
} from './secrets';

export { normalizeStripeEvent } from './stripe-util';

export { SparxPayGateway, SPARX_PAY_ID } from './gateways/sparx-pay';
export { StripeDirectGateway, STRIPE_DIRECT_ID } from './gateways/stripe-direct';
export { SquareGateway, SQUARE_ID, normalizeSquareEvent } from './gateways/square';
export {
  AuthorizeNetGateway,
  AUTHORIZE_NET_ID,
  normalizeAuthorizeNetEvent,
} from './gateways/authorize-net';
export { FirstPayGateway, FIRST_PAY_ID, normalizeFirstPayEvent } from './gateways/first-pay';
export { CustomRedirectGateway, CUSTOM_ID, normalizeCustomEvent } from './gateways/custom-redirect';

// sparx.market — merchant-of-record direct platform charges (docs/106 §4.7).
export {
  SPARX_MARKET_GATEWAY_ID,
  MarketPaymentsUnconfiguredError,
  createMarketPaymentIntent,
  retrieveMarketPaymentIntent,
  refundMarketPayment,
  type CreateMarketPaymentIntentParams,
  type RefundMarketPaymentParams,
} from './market';

import { SparxPayGateway } from './gateways/sparx-pay';
import { StripeDirectGateway } from './gateways/stripe-direct';
export { parseWebhookSecrets, constructEventWithAnySecret } from './webhook-secrets';

import { SquareGateway } from './gateways/square';
import { AuthorizeNetGateway } from './gateways/authorize-net';
import { PayPalGateway } from './gateways/paypal';
import { FirstPayGateway } from './gateways/first-pay';
import { CustomRedirectGateway } from './gateways/custom-redirect';
import { registerBuiltInGateways } from './registry';
import { registerPaymentIntegrations } from './integration';

/** Register the built-in gateways. Call once at host boot. A developer PLUGIN
 *  (docs/111 D6) registers its own adapter the same way — `gatewayRegistry.register(
 *  new MyGateway())` at boot + a gateway-catalog descriptor — and it lights up across
 *  checkout, invoices, and B2B with zero flow changes. */
export function registerSparxGateways(): void {
  const gateways = [
    new SparxPayGateway(),
    new StripeDirectGateway(),
    new SquareGateway(),
    new AuthorizeNetGateway(),
    new PayPalGateway(),
    new FirstPayGateway(),
    new CustomRedirectGateway(),
  ];
  registerBuiltInGateways(gateways);
  // …and publish the same set to the shared integration plane, so "how you get paid"
  // appears in the one Integrations catalog rather than only under commerce.
  registerPaymentIntegrations(gateways);
}
