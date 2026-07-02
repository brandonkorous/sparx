'use server';

import { api, type ApiRestError } from '@/lib/api-rest-client';

// Stripe Connect payout onboarding (docs/114 §B.4). The Connect Express onboarding
// rail (`POST /v1/partner/payouts/connect`) is a later slice; until it lands, this
// action fails gracefully with a friendly "coming soon" so the CTA is honest
// rather than throwing. When the endpoint ships this returns its onboarding URL and
// the button redirects — the shape is already in place.

export interface PayoutSetupResult {
  ok: boolean;
  /** A hosted Connect onboarding URL, once the endpoint exists. */
  url?: string;
  /** A friendly message to surface (e.g. the not-yet-available notice). */
  message?: string;
}

export async function setupPayoutsAction(): Promise<PayoutSetupResult> {
  try {
    const res = await api.post<{ url: string }>('/v1/partner/payouts/connect');
    return { ok: true, url: res.url };
  } catch (err) {
    const e = err as ApiRestError;
    // 404 = the Connect onboarding route isn't live yet (later slice). Anything
    // else is a real error, but either way we degrade to a calm notice — a partner
    // never sees a stack trace for an unbuilt rail.
    if (e.status === 404) {
      return {
        ok: false,
        message:
          'Payout setup is coming soon. Your commissions keep accruing — you’ll be able to connect a payout account here shortly.',
      };
    }
    return { ok: false, message: e.message ?? 'Could not start payout setup.' };
  }
}
