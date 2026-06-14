import { Container, Stack } from '@sparx/ui';

import { CategoryDetailContent } from './_content';

// Full-page surface for a category's detail/edit view. The body lives in the
// surface-agnostic `CategoryDetailContent` so the SAME component renders here
// and inside the `@detail` drawer/modal overlay. This route is what `fullPage`
// / `newTab` detail-view preferences, deep links, and the overlay's "maximize"
// button resolve to.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function CategoryDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <Container size="md">
      <Stack gap={6} className="py-10">
        <CategoryDetailContent id={id} />
      </Stack>
    </Container>
  );
}
