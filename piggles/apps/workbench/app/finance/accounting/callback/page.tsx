'use client';

// Where QuickBooks Online or Xero lands after somebody connects their books.
//
// `forwardUnnamed` matters here and nowhere else: QuickBooks returns the company
// file id as `realmId`, on this query string and nowhere else in the flow. Drop
// it and the connection completes against no company — a failure that looks like
// a success until somebody opens their accounts and finds them empty.
//
// The pane doing the exchange is surfaces/finance/accounting.tsx, listening for
// `piggles-accounting`.

import { OAuthPopupRelay } from '@/components/oauth-popup-relay';

export default function AccountingCallbackPage() {
  return <OAuthPopupRelay source="piggles-accounting" forwardUnnamed what="your books" />;
}
