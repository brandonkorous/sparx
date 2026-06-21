import { WarehouseCreateForm } from '../_components/warehouse-create-form';

// Full-page surface for creating a warehouse. The surface-aware `WarehouseCreateForm`
// (docs/86 F layout) renders the SAME WizardFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to — no
// page-level Container/PageHeader, so the title isn't rendered twice.

export const dynamic = 'force-dynamic';

export default function NewWarehousePage() {
  return <WarehouseCreateForm surface="page" />;
}
