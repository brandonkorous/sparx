import { DetailPageShell } from '../../../_components/detail-page-shell';
import { MediaAssetDetailContent } from './_content';

export const dynamic = 'force-dynamic';

// Full-page route wrapper for a media asset detail. The editing UI lives in
// `_content.tsx` so it also mounts inside the dashboard shell's detail panel
// (drawer / modal). DetailPageShell supplies the full-page header the panel
// chrome otherwise provides — back-link, the body's teleported Delete/Save,
// and the presentation switch. `media`'s manifest routePrefix is `/cms/media`,
// which matches the asset list route exactly, so no listHref/listLabel
// override is needed.
export default async function AssetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="media" entityId={id}>
      <MediaAssetDetailContent id={id} />
    </DetailPageShell>
  );
}
