import { DetailPageShell } from '../../_components/detail-page-shell';

import { CmsPageDetailContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageParams {
  params: Promise<{ id: string }>;
}

// Full-page route wrapper for a CMS page detail. The editing UI lives in
// `_content.tsx` so it also mounts inside the dashboard shell's detail panel
// (drawer / modal). DetailPageShell supplies the full-page header the panel
// chrome otherwise provides — back-link, the body's teleported status signals,
// and the presentation switch. `page`'s manifest routePrefix is the module root
// '/cms', so the back-link points explicitly at the page list '/cms/content'.
export default async function EditCmsPage({ params }: PageParams) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="page" entityId={id} listHref="/cms/content" listLabel="Content">
      <CmsPageDetailContent id={id} />
    </DetailPageShell>
  );
}
