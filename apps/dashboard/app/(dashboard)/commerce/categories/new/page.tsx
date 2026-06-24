import { CategoryCreateForm } from '../_components/category-create-form';
import { loadCategoryParents } from '../_components/category-parent-options';

// Full-page surface for creating a category. The surface-aware `CategoryCreateForm`
// (docs/86 F layout) renders the SAME SurfaceFrame here (`surface="page"` → the
// `embedded` contained sheet, filling the dashboard content area with its own
// title + pinned toolbar) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to — no
// page-level Container/PageHeader, so the title isn't rendered twice.

export const dynamic = 'force-dynamic';

export default async function NewCategoryPage() {
  const parents = await loadCategoryParents();
  return <CategoryCreateForm surface="page" parents={parents} />;
}
