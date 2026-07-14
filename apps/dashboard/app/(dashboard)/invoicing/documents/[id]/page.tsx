import { DetailPageShell } from '../../../_components/detail-page-shell';
import { DocumentEditorContent } from './_content';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

// The document editor is deliberately full-page only (docs/87) — a wide,
// interactive surface like the CRM pipeline board, with no drawer/modal
// detail view registered. DetailPageShell still supplies the shared toolbar
// (back link + teleported header/footer slots) for platform-wide consistency;
// showViewSwitcher={false} suppresses the presentation switch since there's
// nowhere for it to go.
export default async function DocumentEditorPage({ params }: PageProps) {
  const { id } = await params;
  return (
    <DetailPageShell typeId="billing-document" entityId={id} showViewSwitcher={false}>
      <div className="mx-auto w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-6 py-8">
          <DocumentEditorContent id={id} />
        </div>
      </div>
    </DetailPageShell>
  );
}
