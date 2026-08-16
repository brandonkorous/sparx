'use client';

// Preview — the real thing, beside the thing you are editing.
//
// It used to be a new tab, and the tab is what made it useless in practice: you
// cannot compare a change with its result when only one of them is on screen, and
// the short-lived preview token ended up in an address bar, in browser history, and
// one keystroke from being pasted somewhere. In a pane it stays where it was issued.
//
// A site document previews as a real page served by the real storefront; an email
// previews as the email-safe markup the send produces. Two different things behind
// one button, because from where the author stands it is one question.

import { useEffect } from 'react';
import type { DocumentKind, DocumentRef, StudioDoc } from '@wizeworks/studio';
import { useSessionSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PreviewEmail } from './preview-email';
import { PreviewSite } from './preview-site';

const KINDS = new Set<DocumentKind>(['page', 'layout', 'theme', 'component', 'email']);

function refFrom(params: SurfaceContext['params']): DocumentRef | null {
  const { docKind, docId } = params;
  if (typeof docKind !== 'string' || typeof docId !== 'string') return null;
  return KINDS.has(docKind as DocumentKind) ? { kind: docKind as DocumentKind, id: docId } : null;
}

export function PreviewPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  // Subscribed, so this picks the document up as its own pane finishes opening it.
  useSessionSnapshot();
  const ref = refFrom(ctx.params);
  const doc: StudioDoc | undefined = ref && session ? session.store(ref)?.current : undefined;

  useEffect(() => {
    ctx.setTitle(doc ? `Preview — ${doc.name}` : 'Preview');
  }, [ctx, doc]);

  if (!ref) {
    return (
      <div className="bg-base-200 flex h-full items-center justify-center p-6 text-center">
        <p className="text-base-content">
          Open this from the thing you want to see — a page, your header and footer, a saved
          piece or an email.
        </p>
      </div>
    );
  }

  // The document has to be OPEN: a preview is about a document, and giving this pane
  // a loader of its own is how it ends up previewing something nobody is editing.
  if (!session || !doc) {
    return <PaneWaiting label="Open the page, header, piece or email first…" />;
  }

  return doc.kind === 'email' ? (
    <PreviewEmail emailId={doc.id} name={doc.name} />
  ) : (
    <PreviewSite doc={doc} />
  );
}
