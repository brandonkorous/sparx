import { api } from '@/lib/api-rest-client';

import type { PartyOption } from './_components/purchase-order-wizard';

// Server-side data the purchase-order wizard needs (suppliers + warehouses),
// resolved once and shared by BOTH surfaces: the full-page `/new` route and the
// PO-list drawer/modal create overlay (registered in `detail-slot.tsx`). The
// documented pattern for create overlays needing server data — keeping the fetch
// here means the two surfaces can never drift.

export interface PurchaseOrderWizardData {
  suppliers: PartyOption[];
  warehouses: PartyOption[];
}

export async function loadPurchaseOrderWizardData(): Promise<PurchaseOrderWizardData> {
  const [suppliers, warehouses] = await Promise.all([
    api
      .getPaged<PartyOption[]>('/v1/inventory/suppliers?take=250')
      .then((r) => r.data)
      .catch(() => []),
    api
      .getPaged<PartyOption[]>('/v1/inventory/locations?take=250')
      .then((r) => r.data)
      .catch(() => []),
  ]);
  return { suppliers, warehouses };
}
