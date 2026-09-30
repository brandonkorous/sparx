'use client';

// Where an outside shop lands after somebody says yes.
//
// Meta and the shops that follow it redirect the consent popup here with
// `?code=&state=` — or `?error=` if the owner backed out. The exchange for a
// stored connection happens in Where you sell (surfaces/commerce/channels.tsx),
// which is listening for `piggles-channel`.
//
// This route did not exist because nothing ever opened the popup: the API's
// connect-url and callback both shipped with no caller, and the pane told people
// to go and look in their settings instead. Issue 733.

import { OAuthPopupRelay } from '@/components/oauth-popup-relay';

export default function ChannelCallbackPage() {
  return <OAuthPopupRelay source="piggles-channel" what="your shop" />;
}
