import { api } from '@/lib/api-rest-client';

import type { WarehouseOption } from './_components/transfer-wizard';

// Server-side data the transfer wizard needs (the warehouse list), resolved once
// and shared by BOTH surfaces: the full-page `/new` route and the Transfers-list
// drawer/modal create overlay (registered in `detail-slot.tsx`). Keeping the
// fetch here means the two surfaces can never drift.

export interface TransferWizardData {
  warehouses: WarehouseOption[];
}

export async function loadTransferWizardData(): Promise<TransferWizardData> {
  const warehouses = await api
    .getPaged<WarehouseOption[]>('/v1/inventory/locations?take=250')
    .then((r) => r.data)
    .catch(() => []);
  return { warehouses };
}
