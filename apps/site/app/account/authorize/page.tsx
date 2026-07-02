import { Suspense } from 'react';

import { AuthorizeConsent } from '@/components/authorize-consent';

export const dynamic = 'force-dynamic';

export const metadata = { title: 'Authorize', robots: { index: false, follow: false } };

// Store-branded OAuth consent screen (docs/113 §5). The customer AS's
// /mcp/authorize guard (api-rest) bounces here when a shopper's assistant asks to
// connect; this page confirms who they are, lets them pick scopes, and hands back
// to the authorization endpoint with a signed consent grant.
export default function AuthorizePage() {
  return (
    <div className="st-container">
      <Suspense fallback={<div className="st-skeleton" style={{ height: 360, maxWidth: 560 }} />}>
        <AuthorizeConsent />
      </Suspense>
    </div>
  );
}
