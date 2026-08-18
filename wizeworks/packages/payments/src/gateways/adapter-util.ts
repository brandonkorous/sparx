// Shared helpers for the bring-your-own gateway adapters (docs/111 §3). They all read
// merchant credentials through the injected reader, stamp the same metadata so the
// webhook can resolve the order/invoice, and speak REST over `fetch` (no vendor SDKs —
// keeps @wizeworks/payments dependency-free and the api-rest image unchanged).

import { requireGatewayCredentials, type GatewayCredentials } from '../credentials';
import type { CreatePaymentIntentParams } from '../gateway';

export interface GatewayHttpError {
  status: number;
  body: string;
}

/**
 * A non-2xx from a vendor, with its error codes already pulled out.
 *
 * The decline codes are the whole point. Whether a failed renewal retries for a
 * fortnight or immediately asks the customer for a new card is decided by the
 * vendor's code — and reading it out of a formatted message with
 * `message.includes('INVALID_CARD')` matches the substring anywhere, including
 * inside an unrelated human-readable sentence. This carries the codes as data.
 */
export class GatewayApiError extends Error {
  readonly status: number;
  readonly body: string;
  /** Vendor error codes, upper-cased. Square nests them under `errors[].code`;
   *  most others use a top-level `code`. Empty when the body is not JSON. */
  readonly codes: string[];

  constructor(status: number, body: string) {
    super(`gateway HTTP ${String(status)}: ${body}`);
    this.name = 'GatewayApiError';
    this.status = status;
    this.body = body;
    this.codes = extractErrorCodes(body);
  }

  /** True when the vendor reported any of these codes. */
  hasCode(codes: Iterable<string>): boolean {
    const wanted = new Set([...codes].map((c) => c.toUpperCase()));
    return this.codes.some((c) => wanted.has(c));
  }
}

/** Pull vendor error codes out of a JSON error body. Square answers
 *  `{ errors: [{ category, code, detail }] }`; PayPal answers
 *  `{ name, details: [{ issue }] }`. Anything unparseable yields none, which
 *  makes the failure retryable — the safe default for a card that might be fine. */
function extractErrorCodes(body: string): string[] {
  try {
    const parsed = JSON.parse(body) as {
      errors?: { code?: string }[];
      details?: { issue?: string }[];
      name?: string;
    };
    const codes = [
      ...(parsed.errors ?? []).map((e) => e.code),
      ...(parsed.details ?? []).map((d) => d.issue),
      parsed.name,
    ];
    return codes.filter((c): c is string => typeof c === 'string').map((c) => c.toUpperCase());
  } catch {
    return [];
  }
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

/** POST JSON and parse the JSON response, throwing a `GatewayApiError` on non-2xx. */
export async function postJson<T>(
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  return requestJson<T>('POST', url, body, headers);
}

/** Same, for the verbs a vault needs (`GET` a token back, `DELETE` one). */
export async function requestJson<T>(
  method: string,
  url: string,
  body: unknown,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(url, {
    method,
    headers: { 'content-type': 'application/json', accept: 'application/json', ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  const text = await res.text();
  if (!res.ok) {
    // 500 chars is enough to carry the codes and keep a vendor's stack trace out
    // of our logs.
    throw new GatewayApiError(res.status, text.slice(0, 500));
  }
  // A 204 (PayPal's DELETE) has no body to parse.
  if (!text.trim()) return undefined as T;
  // Authorize.net returns JSON with a BOM prefix; strip any leading non-`{` bytes.
  const start = text.indexOf('{');
  return JSON.parse(start > 0 ? text.slice(start) : text) as T;
}

/** POST form-encoded — PayPal's OAuth token endpoint is the only caller, and it
 *  is `application/x-www-form-urlencoded` by spec, not JSON. */
export async function postForm<T>(
  url: string,
  form: Record<string, string>,
  headers: Record<string, string> = {}
): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      accept: 'application/json',
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
  });
  const text = await res.text();
  if (!res.ok) throw new GatewayApiError(res.status, text.slice(0, 500));
  return JSON.parse(text) as T;
}
