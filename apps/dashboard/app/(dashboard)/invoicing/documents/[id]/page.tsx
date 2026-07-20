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
    // width="full" — not the usual centered `max-w-screen-xl` reading column:
    // the editor runs the line grid and a live document preview side by side,
    // and a capped column squeezes both. The width buys a working pane, not a
    // longer line length. It must be set HERE, on the shell that owns the
    // Container; a `w-full` wrapper around the children can't uncap it.
    <DetailPageShell typeId="billing-document" entityId={id} showViewSwitcher={false} width="full">
      <DocumentEditorContent id={id} />
    </DetailPageShell>
  );
}
