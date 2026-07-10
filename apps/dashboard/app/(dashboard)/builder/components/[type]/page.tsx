import { Container, Stack } from '@sparx/ui';
import { DetailPageShell } from '../../../_components/detail-page-shell';
import { ComponentDetailContent } from './_content';

// Full-page component reference (docs/34 §3, Record Detail → Wide). The same
// body renders in the dashboard drawer/modal via the detail-slot registry; this
// route backs the "open in full page" affordance, deep links, and shift-click.
// The `[type]` segment is the component's registry `type` (e.g. `Button`).

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ type: string }>;
}

export default async function BuilderComponentDetailPage({ params }: PageProps) {
  const { type } = await params;
  return (
    <DetailPageShell typeId="builder-component" entityId={type}>
      <Container size="xl">
        <Stack gap={6} className="py-10">
          <ComponentDetailContent id={decodeURIComponent(type)} />
        </Stack>
      </Container>
    </DetailPageShell>
  );
}
