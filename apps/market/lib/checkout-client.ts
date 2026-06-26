'use client';

// Client-side marketplace checkout API. Thin fetch wrappers over the public
// market checkout surface (via the same-origin /api/sparx proxy). Single-merchant
// per cart: every call carries `?merchant=<merchantSlug>` and replays the cart
// ownership token (x-cart-token). Mirrors apps/site/lib/checkout-client.ts but
// scoped to /v1/public/market/checkout/* with the merchant query param.

const API_BASE = '/api/sparx/v1/public/market';

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
  surchargeTotalCents?: number;
  totalCents: number;
}

export interface CheckoutSession {
  sessionId: string;
  cartId: string;
  step: string;
  currency: string;
  customerEmail?: string;
  surchargeLabel?: string;
  totals: CheckoutTotals;
}

export interface PaymentIntentResult {
  paymentRef: string;
  providerSlug: string;
  clientSecret?: string;
  amountCents: number;
  currency: string;
  status: string;
}

function withMerchant(path: string, merchantSlug: string): string {
  const sep = path.includes('?') ? '&' : '?';
  return `${API_BASE}${path}${sep}merchant=${encodeURIComponent(merchantSlug)}`;
}

async function call<T>(
  path: string,
  merchantSlug: string,
  token: string | null,
  init: RequestInit & { json?: unknown } = {}
): Promise<T> {
  const { json, ...rest } = init;
  const res = await fetch(withMerchant(path, merchantSlug), {
    ...rest,
    cache: 'no-store',
    headers: {
      ...(token ? { 'x-cart-token': token } : {}),
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
  merchantSlug: string,
  token: string | null,
  cartId: string,
  email?: string
): Promise<{ sessionId: string }> {
  return call('/checkout', merchantSlug, token, {
    method: 'POST',
    json: { cartId, ...(email ? { email } : {}) },
  });
}

export function getCheckout(
  merchantSlug: string,
  token: string | null,
  sessionId: string
): Promise<CheckoutSession> {
  return call(`/checkout/${sessionId}`, merchantSlug, token, { method: 'GET' });
}

export function submitContact(
  merchantSlug: string,
  token: string | null,
  sessionId: string,
  input: { email: string; phone?: string; acceptsMarketing: boolean }
): Promise<CheckoutSession> {
  return call(`/checkout/${sessionId}/contact`, merchantSlug, token, {
    method: 'POST',
    json: input,
  });
}

export function quoteShipping(
  merchantSlug: string,
  token: string | null,
  sessionId: string,
  input: { destinationCountry?: string; destinationPostal?: string }
): Promise<ShippingRate[]> {
  return call(`/checkout/${sessionId}/shipping-quote`, merchantSlug, token, {
    method: 'POST',
    json: input,
  });
}

export function submitShipping(
  merchantSlug: string,
  token: string | null,
  sessionId: string,
  input: {
    shippingAddress: Address;
    billingAddress?: Address;
    shippingRateRef: string;
    shippingProviderSlug: string;
  }
): Promise<CheckoutSession> {
  return call(`/checkout/${sessionId}/shipping`, merchantSlug, token, {
    method: 'POST',
    json: input,
  });
}

export function createPaymentIntent(
  merchantSlug: string,
  token: string | null,
  sessionId: string
): Promise<PaymentIntentResult> {
  return call(`/checkout/${sessionId}/payment-intent`, merchantSlug, token, {
    method: 'POST',
    json: {},
  });
}

export function submitPayment(
  merchantSlug: string,
  token: string | null,
  sessionId: string,
  input: { paymentProviderSlug: string; paymentRef: string }
): Promise<CheckoutSession> {
  return call(`/checkout/${sessionId}/payment`, merchantSlug, token, {
    method: 'POST',
    json: input,
  });
}

export function completeCheckout(
  merchantSlug: string,
  token: string | null,
  sessionId: string,
  idempotencyKey: string
): Promise<{ orderId: string; orderNumber: string }> {
  return call(`/checkout/${sessionId}/complete`, merchantSlug, token, {
    method: 'POST',
    json: { idempotencyKey },
  });
}
