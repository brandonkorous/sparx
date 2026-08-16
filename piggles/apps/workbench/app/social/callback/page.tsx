'use client';

// Where a social platform lands after somebody says yes.
//
// Google Business, LinkedIn, Facebook and the rest redirect the consent popup
// here with `?code=&state=` — or `?error=` if the owner backed out. The exchange
// for a stored connection happens in the Accounts pane
// (surfaces/social/connections.tsx), which is listening for `piggles-social`.
//
// This route existed in the app this console forked from and did not come across,
// so every "Connect account" button in Piggles sent somebody to a 404 AFTER they
// had already authorised — the worst possible moment for a page to be missing.

import { OAuthPopupRelay } from '@/components/oauth-popup-relay';

export default function SocialCallbackPage() {
  return <OAuthPopupRelay source="piggles-social" what="your account" />;
}
