import { api } from '@/lib/api-rest-client';

import type { CustomerOption } from './components/order-wizard';

// Server-side data the order wizard needs, resolved once and shared by BOTH
// surfaces: the full-page `/new` route and the Orders-list drawer/modal create
// overlay (registered in `detail-slot.tsx`). Keeping the fetch + mapping here is
// the documented pattern for create overlays needing server data — and it means
// the two surfaces can never drift.

interface CustomerLite {
  id: string;
  firstName: string | null;
  lastName: string | null;
  company: string | null;
  email: string | null;
}

export interface OrderWizardData {
  customers: CustomerOption[];
}

export async function loadOrderWizardData(): Promise<OrderWizardData> {
  const customers = await api
    .getPaged<CustomerLite[]>('/v1/crm/customers?take=200&sort_by=updatedAt')
    .then((r) => r.data)
    .catch(() => []);

  return {
    customers: customers.map((c) => ({
      id: c.id,
      label:
        [c.firstName, c.lastName].filter(Boolean).join(' ') ||
        (c.company ?? c.email ?? c.id.slice(0, 8)),
    })),
  };
}
