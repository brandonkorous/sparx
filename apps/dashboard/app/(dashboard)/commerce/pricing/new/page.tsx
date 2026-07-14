import { PriceListCreateForm } from '../_components/price-list-create-form';
import { loadPriceListTargetingOptions } from '../_lib/targeting-options';

// Full-page surface for creating a price list. The surface-aware
// `PriceListCreateForm` (docs/86 F layout) renders the SAME SurfaceFrame here
// (`surface="page"` → the `embedded` contained sheet, filling the dashboard
// content area with its own title + pinned toolbar) and inside the `@detail`
// drawer/modal overlay (`surface="overlay"`). This route is what `fullPage` /
// `newTab` detail-view preferences, deep links, and the overlay's "maximize"
// button resolve to — no page-level Container/PageHeader, so the title isn't
// rendered twice.

export const dynamic = 'force-dynamic';

export default async function NewPriceListPage() {
  const { b2bAccounts, segments } = await loadPriceListTargetingOptions();
  return <PriceListCreateForm surface="page" b2bAccounts={b2bAccounts} segments={segments} />;
}
