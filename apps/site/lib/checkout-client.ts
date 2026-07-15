// Client-side checkout API. Thin fetch wrappers over the public checkout
// surface (via the same-origin /api/sparx proxy), carrying the cart ownership
// token (x-cart-token) on every call. All calls run in the browser.

const API_BASE = '/api/sparx';
const TOKEN_KEY = 'sparx_cart_token';

export interface Address {
  name: string;
  line1: string;
  line2?: string;
  city: string;
  region?: string;
  postalCode: string;
  country: string;
  phone?: string;
}

export interface ShippingRate {
  providerSlug: string;
  rateRef: string;
  service: string;
  carrier: string;
  amountCents: number;
  estimatedDays: number | null;
}

export interface CheckoutTotals {
  subtotalCents: number;
  discountTotalCents: number;
  shippingTotalCents: number;
  taxTotalCents: number;
  // Disclosed document surcharge (docs/48 §6) — e.g. a card processing fee.
  surchargeTotalCents?: number;
  totalCents: number;
}

export interface CheckoutSession {
  sessionId: string;
  cartId: string;
  step: string;
  currency: string;
  customerEmail?: string;
  // Present only when the signed-in customer is an active B2B contact — the
  // frontend's ONLY signal for showing the "bill to account" payment choice.
  b2bAccountId?: string;
  // The linked account's payment-terms designation (e.g. 'prepay', 'net30').
  // A 'prepay' account has no net-terms entitlement — hide that choice.
  b2bAccountPaymentTerms?: string;
  // Customer-facing label for the surcharge line, when one applies.
  surchargeLabel?: string;
  totals: CheckoutTotals;
}

export interface PaymentIntentResult {
  paymentRef: string;
  providerSlug: string;
  /** Inline (Stripe-family) gateways confirm with this in the browser. */
  clientSecret?: string;
  /** Hosted-redirect gateways: the vendor page to send the shopper to. When a token
   *  also rides in `clientSecret` (Authorize.net), POST it to this URL instead of GET. */
  redirectUrl?: string;
  amountCents: number;
  currency: string;
  status: string;
}

function token(): string {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
}

async function call<T>(
  path: string,
  tenantSlug: string,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(`${API_BASE}${path}?tenant=${encodeURIComponent(tenantSlug)}`, {
    ...rest,
    headers: {
      'x-cart-token': token(),
      ...(json !== undefined ? { 'content-type': 'application/json' } : {}),
      ...(rest.headers ?? {}),
    },
    ...(json !== undefined ? { body: JSON.stringify(json) } : {}),
  });
  const body = (await res.json().catch(() => null)) as
    | { success: true; data: T }
    | { success: false; error: { message: string; code: string } }
    | null;
  if (!res.ok || !body || body.success === false) {
    const message = body?.success === false ? body.error.message : `Request failed (${res.status})`;
    throw new Error(message);
  }
  return body.data;
}

export function startCheckout(
  tenantSlug: string,
  cartId: string,
  email?: string
): Promise<CheckoutSession> {
  return call('/v1/public/commerce/checkout', tenantSlug, {
    method: 'POST',
    json: { cartId, ...(email ? { email } : {}) },
  });
}

export function getCheckout(tenantSlug: string, sessionId: string): Promise<CheckoutSession> {
  return call(`/v1/public/commerce/checkout/${sessionId}`, tenantSlug, { method: 'GET' });
}

export function submitContact(
  tenantSlug: string,
  sessionId: string,
  input: { email: string; phone?: string; acceptsMarketing?: boolean }
): Promise<CheckoutSession> {
  return call(`/v1/public/commerce/checkout/${sessionId}/contact`, tenantSlug, {
    method: 'POST',
    json: input,
  });
}

export function quoteShipping(
  tenantSlug: string,
  sessionId: string,
  input: {
    destinationAddress?: Address;
    destinationCountry?: string;
    destinationPostal?: string;
  }
): Promise<ShippingRate[]> {
  return call(`/v1/public/commerce/checkout/${sessionId}/shipping-quote`, tenantSlug, {
    method: 'POST',
    json: input,
  });
}

export function submitShipping(
  tenantSlug: string,
  sessionId: string,
  input: {
    shippingAddress: Address;
    billingAddress?: Address;
    shippingRateRef: string;
    shippingProviderSlug: string;
  }
): Promise<CheckoutSession> {
  return call(`/v1/public/commerce/checkout/${sessionId}/shipping`, tenantSlug, {
    method: 'POST',
    json: input,
  });
}

export function createPaymentIntent(
  tenantSlug: string,
  sessionId: string,
  returnUrl?: string
): Promise<PaymentIntentResult> {
  return call(`/v1/public/commerce/checkout/${sessionId}/payment-intent`, tenantSlug, {
    method: 'POST',
    json: returnUrl ? { returnUrl } : {},
  });
}

export function submitPayment(
  tenantSlug: string,
  sessionId: string,
  input:
    | { paymentProviderSlug: string; paymentRef: string; poNumber?: string }
    | { poNumber?: string; paymentTermsRequested: string }
): Promise<CheckoutSession> {
  return call(`/v1/public/commerce/checkout/${sessionId}/payment`, tenantSlug, {
    method: 'POST',
    json: input,
  });
}

export function completeCheckout(
  tenantSlug: string,
  sessionId: string,
  idempotencyKey: string
): Promise<{ orderId: string; orderNumber: string }> {
  return call(`/v1/public/commerce/checkout/${sessionId}/complete`, tenantSlug, {
    method: 'POST',
    json: { idempotencyKey },
  });
}
