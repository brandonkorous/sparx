'use client';

// Where Google lands after somebody connects Search Console.
//
// Same shape as every other consent popup: `?code=&state=` back to the pane that
// opened it (surfaces/seo/search-console.tsx, listening for `piggles-gsc`),
// which trades the code for a stored grant on the console's own token.

import { OAuthPopupRelay } from '@/components/oauth-popup-relay';

export default function SearchConsoleCallbackPage() {
  return <OAuthPopupRelay source="piggles-gsc" what="your Search Console site" />;
}
