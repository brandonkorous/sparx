import { api } from '@/lib/api-rest-client';

import { CountCreateForm } from './_components/count-create-form';

// New inventory count (docs/100 P4). Needs at least one warehouse; a cycle count
// also lets you pick the specific variants by SKU. The server fetches the
// warehouse option list and hands it to the client form, which owns the
// no-warehouse guard. The embedded SurfaceFrame supplies its own title + toolbar,
// so the page renders bare. The same form also renders in the drawer/modal overlay
// via the count wrapper in `detail-slot.tsx`, honoring `defaultDetailView`.

export const dynamic = 'force-dynamic';

interface PartyOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewInventoryCountPage() {
  const { data: warehouses } = await api.getPaged<PartyOption[]>(
    '/v1/inventory/locations?take=250'
  );

  return <CountCreateForm surface="page" warehouses={warehouses} />;
}
