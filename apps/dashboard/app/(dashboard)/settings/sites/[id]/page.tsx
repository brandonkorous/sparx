import { DetailPageShell } from '../../../_components/detail-page-shell';
import { SiteDetailContent } from './_content';

// Full-page host for a single site's management detail. The SAME body also mounts
// inside the drawer/modal chrome via the `@detail` slot (registered as `site` on
// the builder manifest + detail-slot) — the user's `defaultDetailView` picks
// which. This route is the "full page" option + the new-tab / deep-link target.

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function SiteDetailPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="site" entityId={id}>
      <SiteDetailContent id={id} />
    </DetailPageShell>
  );
}
