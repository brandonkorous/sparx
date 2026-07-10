import { DetailPageShell } from '../../../_components/detail-page-shell';
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
// `content-type`), wrapped in DetailPageShell — exactly like cms/[id]/page.tsx
// mounts CmsPageDetailContent. Custom types get the live SchemaEditor (its
// Save/Delete teleport into the shell's header/footer slots); built-in types
// show their read-only schema (platform-owned).
export default async function ContentTypePage({ params }: PageProps) {
  const { typeKey } = await params;
  return (
    <DetailPageShell typeId="content-type" entityId={typeKey}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-10">
          <ContentTypeDetailContent id={typeKey} />
        </div>
      </div>
    </DetailPageShell>
  );
}
