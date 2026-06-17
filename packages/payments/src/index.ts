// @sparx/payments — vendor-agnostic payment gateway abstraction (docs/94 ADR).
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
  CreatePaymentIntentParams,
  RefundParams,
  CreatePaymentLinkParams,
} from './gateway';

export { gatewayRegistry, registerBuiltInGateways, GatewayNotFoundError } from './registry';

export { PaymentService, paymentService, PaymentConfigError } from './service';

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

import { SparxPayGateway } from './gateways/sparx-pay';
import { StripeDirectGateway } from './gateways/stripe-direct';
import { registerBuiltInGateways } from './registry';

/** Register the built-in gateways. Call once at host boot. */
export function registerSparxGateways(): void {
  registerBuiltInGateways([new SparxPayGateway(), new StripeDirectGateway()]);
}
