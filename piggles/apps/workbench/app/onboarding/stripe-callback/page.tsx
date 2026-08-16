'use client';

// Where Stripe lands after somebody finishes taking payments setup.
//
// `signalDoneOnly`, because Stripe's hosted onboarding is not an OAuth flow —
// there is no code to trade. Both of Stripe's own return paths (`return_url` on
// success, `refresh_url` when the single-use link expires) come back HERE, and
// the popup returning at all is the whole signal. The pane re-reads status from
// the API rather than trusting a query string, which is also why an expired link
// needs no special case: it lands here, the status is re-read, and it is still
// not connected.
//
// lib/onboarding/use-stripe-connect.ts is listening for `piggles-stripe`.

import { OAuthPopupRelay } from '@/components/oauth-popup-relay';

export default function StripeCallbackPage() {
  return <OAuthPopupRelay source="piggles-stripe" signalDoneOnly what="your payouts setup" />;
}
