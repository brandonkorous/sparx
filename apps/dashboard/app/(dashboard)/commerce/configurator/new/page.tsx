import { loadConfiguratorProducts } from './_components/configurator-create-data';
import { NewTemplateForm } from './_components/new-template-form';

// Full-page surface for creating a configurator template. The surface-aware
// `NewTemplateForm` (docs/86 F layout) renders the SAME SurfaceFrame here
// (`surface="page"` → the `embedded` contained sheet, filling the dashboard
// content area with its own title + pinned toolbar) and inside the `@detail`
// drawer/modal overlay (`surface="overlay"`). This route is what `fullPage` /
// `newTab` detail-view preferences, deep links, and the overlay's "maximize"
// button resolve to — no page-level Container/PageHeader, so the title isn't
// rendered twice.

export const dynamic = 'force-dynamic';

export default async function NewConfiguratorTemplatePage() {
  const products = await loadConfiguratorProducts();
  return <NewTemplateForm surface="page" products={products} />;
}
