import { BundleEditor } from '../_components/bundle-editor';
import { loadBundleCreateData } from '../_components/bundle-create-data';

// Full-page surface for creating a bundle. The surface-aware `BundleEditor`
// (docs/86 F layout) renders the SAME WizardFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to — no
// page-level Container/PageHeader, so the title isn't rendered twice. The bundle
// editor is shared with the `[id]` detail page; only CREATE wears the F-shell.

export const dynamic = 'force-dynamic';

export default async function NewBundlePage() {
  const { products, variants } = await loadBundleCreateData();
  return <BundleEditor surface="page" products={products} variants={variants} />;
}
