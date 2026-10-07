// The price, in exactly one place. Exported from `@piggles/config/pricing` and
// NOT the package index, because the console never knows a price (RULE #2).
// A price change is this file plus `piggles/config/billing-plan.json`.

import { apiOrigin, REVALIDATE_ONE_MINUTE } from './api-origin';
import type { HeaderNotice } from './notice';

/** Dollars a month. The arithmetic form — comparisons, count-ups, receipts. */
export const PRICE_MONTHLY = 99;

/** The prose form. Used inline in copy so a sentence never carries a literal. */
export const PRICE_LABEL = '$99';

/** Days of trial, no card. */
export const TRIAL_DAYS = 14;

/** Where a question about paying goes. */
export const BILLING_EMAIL = 'hello@meetpiggles.com';

// ── FOUNDING MEMBERS ────────────────────────────────────────────────────────
// A coupon on the one price, never a second plan. Its terms live in the plan
// file and Stripe counts the places, so what is left is always READ, never typed.

export interface FounderOffer {
  /** What a founding member pays each month, in dollars. */
  monthly: number;
  limit: number;
  /** Places still open. Zero once the last one is taken. */
  remaining: number;
}

interface OfferWire {
  amountOffCents: number;
  limit: number;
  remaining: number;
}

/** The founding offer as it stands, or null when it cannot be read. NEVER
 *  THROWS: a page that cannot count the places says nothing about them. */
export async function fetchFounderOffer(): Promise<FounderOffer | null> {
  try {
    const res = await fetch(`${apiOrigin()}/v1/public/billing/offer?plan=piggles`, {
      ...REVALIDATE_ONE_MINUTE,
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: { offer?: OfferWire | null } };
    const offer = body.data?.offer;
    if (!offer) return null;
    return {
      monthly: PRICE_MONTHLY - Math.round(offer.amountOffCents / 100),
      limit: offer.limit,
      remaining: offer.remaining,
    };
  } catch {
    return null;
  }
}

/** True while somebody can still become a founding member. */
export function founderOpen(offer: FounderOffer | null): offer is FounderOffer {
  return offer !== null && offer.remaining > 0;
}

/** The header bar for the offer while places are left, else null. */
export function founderNotice(offer: FounderOffer | null, href: string): HeaderNotice | null {
  if (!founderOpen(offer)) return null;
  return {
    id: 'founding-offer',
    message: `Founding members pay $${String(offer.monthly)} a month instead of ${PRICE_LABEL}, for as long as they stay. ${String(offer.remaining)} of ${String(offer.limit)} places left.`,
    linkLabel: 'How it works',
    linkHref: href,
    tone: 'primary',
    dismissible: true,
  };
}
