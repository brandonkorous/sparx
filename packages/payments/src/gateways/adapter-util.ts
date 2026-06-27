// Shared helpers for the bring-your-own gateway adapters (docs/111 §3). They all read
// merchant credentials through the injected reader, stamp the same metadata so the
// webhook can resolve the order/invoice, and speak REST over `fetch` (no vendor SDKs —
// keeps @sparx/payments dependency-free and the api-rest image unchanged).

import { requireGatewayCredentials, type GatewayCredentials } from '../credentials';
import type { CreatePaymentIntentParams } from '../gateway';

export interface GatewayHttpError {
  status: number;
  body: string;
}

/** The merchant's credentials for a gateway, or a surfaced "not connected" error. */
export async function loadCredentials(
  tenantId: string,
  gatewayId: string
): Promise<GatewayCredentials> {
  return requireGatewayCredentials(tenantId, gatewayId);
}

/** Reference + metadata the platform stamps on a payment so the webhook can resolve
 *  back to the order / invoice / booking. Stored as the vendor's order reference and
 *  echoed into our `payment_intents` row by `PaymentService`. */
export function paymentMetadata(params: CreatePaymentIntentParams): Record<string, string> {
  return {
    tenantId: params.tenantId,
    ...(params.orderId ? { orderId: params.orderId } : {}),
    ...(params.invoiceId ? { invoiceId: params.invoiceId } : {}),
    ...(params.bookingId ? { booking_id: params.bookingId } : {}),
    ...(params.customerId ? { customerId: params.customerId } : {}),
    ...params.metadata,
  };
}

/** A short, vendor-safe order reference for a payment (≤ vendor field limits). Derived
 *  from the order/invoice id when present, else a time-stamped fallback the caller
 *  passes in (we avoid Date.now() in pure code; callers stamp). */
export function orderReference(params: CreatePaymentIntentParams): string {
  return (params.orderId ?? params.invoiceId ?? params.bookingId ?? 'sparx').slice(0, 40);
}

/** POST JSON and parse the JSON response, throwing a structured error on non-2xx. */
export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    const err: GatewayHttpError = { status: res.status, body: text.slice(0, 500) };
    throw new Error(`gateway HTTP ${err.status}: ${err.body}`);
  }
  // Authorize.net returns JSON with a BOM prefix; strip any leading non-`{` bytes.
  const start = text.indexOf('{');
  return JSON.parse(start > 0 ? text.slice(start) : text) as T;
}
