import { api } from '@/lib/api-rest-client';

import type { PartyOption } from './_components/quote-wizard';

// Server-side data the quote wizard needs, resolved once and shared by BOTH
// surfaces: the full-page `/new` route and the Quotes-list drawer/modal create
// overlay (registered in `detail-slot.tsx`). The documented pattern for create
// overlays needing server data — keeping the fetch + mapping here means the two
// surfaces can never drift.

interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}
interface B2bAccountLite {
  id: string;
  companyName: string;
}

export interface QuoteWizardData {
  customers: PartyOption[];
  b2bAccounts: PartyOption[];
}

export async function loadQuoteWizardData(): Promise<QuoteWizardData> {
  const [customers, b2bAccounts] = await Promise.all([
    api
      .getPaged<CustomerLite[]>('/v1/crm/customers?take=200&sort_by=updatedAt')
      .then((r) => r.data)
      .catch(() => []),
    api
      .getPaged<B2bAccountLite[]>('/v1/crm/b2b-accounts?take=200')
      .then((r) => r.data)
      .catch(() => []),
  ]);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      label:
        [c.firstName, c.lastName].filter(Boolean).join(' ') ||
        (c.company ?? c.email ?? c.id.slice(0, 8)),
    })),
    b2bAccounts: b2bAccounts.map((a) => ({ id: a.id, label: a.companyName })),
  };
}
