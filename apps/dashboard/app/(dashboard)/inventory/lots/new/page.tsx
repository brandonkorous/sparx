import { api } from '@/lib/api-rest-client';

import { LotCreateForm } from './_components/lot-create-form';

// New lot batch (docs/100 P4d). Needs at least one warehouse. The server fetches
// the warehouse option list and hands it to the client form, which owns the
// no-warehouse guard, resolves the item by SKU, and creates the lot. The embedded
// SurfaceFrame supplies its own title + toolbar, so the page renders bare. The
// same form also renders in the drawer/modal overlay via the lot wrapper in
// `detail-slot.tsx`, honoring the user's `defaultDetailView` preference.

export const dynamic = 'force-dynamic';

interface WarehouseOption {
  id: string;
  name: string;
  code: string;
}

export default async function NewLotPage() {
  const { data: warehouses } = await api.getPaged<WarehouseOption[]>(
    '/v1/inventory/locations?take=250'
  );

  return <LotCreateForm surface="page" warehouses={warehouses} />;
}
