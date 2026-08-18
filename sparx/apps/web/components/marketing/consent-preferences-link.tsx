'use client';

// Footer entry point to the cookie-consent preferences modal. The banner
// (components/consent-banner.tsx) listens for the `sparx:open-consent` event and
// reopens its preferences modal — this link is what replaced the old floating
// pill. It's a styled anchor (matches the sibling footer links) rather than a
// button so it reads as one of the legal links; the click is intercepted and
// dispatches the event instead of navigating.

import { Link } from '@wizeworks/silicaui-react';
import { openConsentPreferences } from '../consent-banner';

export function ConsentPreferencesLink({ className }: { className?: string }) {
  return (
    <Link
      href="#cookie-preferences"
      className={className}
      onClick={(e) => {
        e.preventDefault();
        openConsentPreferences();
      }}
    >
      Cookie preferences
    </Link>
  );
}
