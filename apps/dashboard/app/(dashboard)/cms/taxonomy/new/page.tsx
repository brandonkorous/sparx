import { Container, PageHeader, Stack } from '@sparx/ui';

import { TaxonomyCreateForm } from '../taxonomy-create-form';

// Full-page surface for creating a taxonomy. The form body lives in the
// surface-aware `TaxonomyCreateForm` (§13.1) so the SAME component renders here
// (`surface="page"`) and inside the `@detail` drawer/modal overlay
// (`surface="overlay"`). This static `new` segment wins over the sibling
// `[key]` dynamic route — the intended behavior — so it's what `fullPage` /
// `newTab` detail-view preferences and deep links resolve to.

export const dynamic = 'force-dynamic';

export default function NewTaxonomyPage() {
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <PageHeader
          title="New taxonomy"
          description="Tenant-defined vocabularies. The key is the stable identifier the API uses (e.g. blog_category). Mark hierarchical to allow parent/child term nesting."
        />
        <TaxonomyCreateForm surface="page" />
      </Stack>
    </Container>
  );
}
