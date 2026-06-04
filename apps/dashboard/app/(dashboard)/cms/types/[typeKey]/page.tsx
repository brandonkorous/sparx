import { Container, Stack } from '@sparx/ui';

import { ContentTypeDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ typeKey: string }>;
}

// Full-page route for a content TYPE — its identity + schema (the model), not
// its entries. The entries (content items) live on the unified list at
// /cms/content?type=<key>, which the detail body's "View …" button links to.
//
// Renders the SAME chrome-free body the drawer/modal use (detail-slot →
// `content-type`), wrapped in the full-page Container — exactly like
// cms/[id]/page.tsx mounts CmsPageDetailContent. Custom types get the live
// SchemaEditor; built-in types show their read-only schema (platform-owned).
export default async function ContentTypePage({ params }: PageProps) {
  const { typeKey } = await params;
  return (
    <Container size="xl">
      <Stack gap={6} className="py-10">
        <ContentTypeDetailContent id={typeKey} />
      </Stack>
    </Container>
  );
}
