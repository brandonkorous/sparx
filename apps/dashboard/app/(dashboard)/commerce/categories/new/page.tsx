import { Container, PageHeader, Stack } from '@sparx/ui';

import { CategoryCreateForm } from '../_components/category-create-form';
import { loadCategoryParents } from '../_components/category-parent-options';

// Full-page surface for creating a category. The form body lives in the
// surface-aware `CategoryCreateForm` (§13.1) so the SAME component renders here
// (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This route is what `fullPage` / `newTab` detail-view
// preferences, deep links, and the overlay's "maximize" button resolve to.

export const dynamic = 'force-dynamic';

export default async function NewCategoryPage() {
  const parents = await loadCategoryParents();

  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="New category"
          description="Categories are the organizational tree shoppers browse. Pick a parent to nest, or leave it top-level — position and reparenting can be changed later from the tree."
        />
        <CategoryCreateForm surface="page" parents={parents} />
      </Stack>
    </Container>
  );
}
