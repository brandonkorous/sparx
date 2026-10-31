import 'server-only';

import { platformRequest } from '@wizeworks/auth-client-server';

// Paying for Piggles: api-rest holds the Stripe key, and acts on the business
// of the person whose session this request carries (docs/154). It checks the
// role itself too; this app checks it first only to say so kindly.
//
// Every call is one signed-in person's live request, so it carries their client
// chain: api-rest then rate-limits and records that person rather than this
// pod, whose address everyone shares.

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

/** What the account page shows, or null when billing could not be read. The
 *  page renders without it rather than failing. */
export async function readBilling(): Promise<BillingSummary | null> {
  try {
    return (await platformRequest<{ billing: BillingSummary | null }>('business/billing')).billing;
  } catch {
    return null;
  }
}

export function openCheckout(returnUrl: string): Promise<CheckoutResult> {
  return platformRequest<CheckoutResult>('business/billing/checkout', { body: { returnUrl } });
}

export async function openPortal(returnUrl: string): Promise<string | null> {
  return (
    await platformRequest<{ url: string | null }>('business/billing/portal', {
      body: { returnUrl },
    })
  ).url;
}
