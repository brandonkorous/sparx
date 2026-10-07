import 'server-only';

// Paying for Piggles: the account app asks api-rest's internal billing routes,
// which hold the Stripe key. This app checks the session and role first.

const TOKEN_HEADER = 'X-sparx-Internal-Furnish-Token';

export interface HeldDiscount {
  coupon: string;
  amountOffCents: number;
}

export interface OfferStanding {
  coupon: string;
  amountOffCents: number;
  limit: number;
  remaining: number;
}

export interface BillingSummary {
  /** A card is on file: a subscription was started at checkout. */
  subscribed: boolean;
  /** The customer portal can open (invoices, card, cancel). */
  canManage: boolean;
  baseMonthlyCents: number | null;
  /** The discount this business's subscription carries, if any. */
  discount: HeldDiscount | null;
  /** The offer this business would get if it added a card today. */
  offer: OfferStanding | null;
}

export type CheckoutReason = 'unconfigured' | 'no_paid_modules' | 'already_active';
export type CheckoutResult = { url: string } | { url: null; reason: CheckoutReason };

/** Base URL and token, or null when this environment has no route to billing. */
function internal(): { base: string; token: string } | null {
  const base = process.env.PIGGLES_API_REST_URL;
  const token = process.env.SPARX_INTERNAL_FURNISH_TOKEN;
  return base && token ? { base: base.replace(/\/$/, ''), token } : null;
}

async function call<T>(path: string, init: { method: 'GET' | 'POST'; body?: unknown }) {
  const target = internal();
  if (!target) throw new Error('Billing is not wired: PIGGLES_API_REST_URL or its token is unset.');
  const response = await fetch(`${target.base}${path}`, {
    method: init.method,
    headers: { 'content-type': 'application/json', [TOKEN_HEADER]: target.token },
    ...(init.body ? { body: JSON.stringify(init.body) } : {}),
    signal: AbortSignal.timeout(20_000),
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`Billing request failed: ${String(response.status)}`);
  return ((await response.json()) as { data: T }).data;
}

/** What the account page says about paying. Null when billing cannot be read,
 *  which the page shows as its own state rather than as "nothing to pay". */
export async function readBilling(tenantId: string): Promise<BillingSummary | null> {
  try {
    const q = `?tenantId=${encodeURIComponent(tenantId)}`;
    const data = await call<{ billing: BillingSummary | null }>(`/internal/tenant/billing${q}`, {
      method: 'GET',
    });
    return data.billing;
  } catch {
    return null;
  }
}

export function openCheckout(tenantId: string, returnUrl: string): Promise<CheckoutResult> {
  return call<CheckoutResult>('/internal/tenant/billing/checkout', {
    method: 'POST',
    body: { tenantId, returnUrl },
  });
}

export async function openPortal(tenantId: string, returnUrl: string): Promise<string | null> {
  const data = await call<{ url: string | null }>('/internal/tenant/billing/portal', {
    method: 'POST',
    body: { tenantId, returnUrl },
  });
  return data.url;
}
