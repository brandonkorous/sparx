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
import { faEye } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import type { DocumentRef, StudioDoc, StudioSession } from '@wizeworks/studio';
import { useSessionSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { DocumentNotOpen, NoDocumentNamed, refFrom } from './document-pane';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PreviewEmail } from './preview-email';
import { PreviewSite } from './preview-site';

/** Why this pane follows what is open, rather than loading a copy of its own. */
const WHY =
  'A preview follows whatever you have open, so what you see here is always the thing you are editing.';

const GLYPH = <Icon glyph={faEye} className="size-6" aria-hidden />;

export function PreviewPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const ref = refFrom(ctx.params);

  if (!ref) return <NoDocumentNamed icon={GLYPH} what="to see" />;

  // Split at the session, because the half below SUBSCRIBES to it and
  // `useSessionSnapshot` throws outright with no `<StudioProvider>` above it. The
  // provider does not exist until the site resolves, so a pane opened during boot
  // has to wait here rather than reach for a session that is not there yet.
  if (!session) return <PaneWaiting label="Finding your website…" />;

  return <PreviewForDocument ctx={ctx} session={session} ref_={ref} />;
}

function PreviewForDocument({
  ctx,
  session,
  ref_,
}: {
  ctx: SurfaceContext;
  session: StudioSession;
  ref_: DocumentRef;
}) {
  // Subscribed, so this picks the document up as its own pane finishes opening it.
  useSessionSnapshot();
  const doc: StudioDoc | undefined = session.store(ref_)?.current;

  useEffect(() => {
    ctx.setTitle(doc ? `Preview — ${doc.name}` : 'Preview');
  }, [ctx, doc]);

  // The document has to be OPEN: a preview is about a document, and giving this pane
  // a loader of its own is how it ends up previewing something nobody is editing.
  if (!doc) return <DocumentNotOpen ctx={ctx} ref_={ref_} icon={GLYPH} why={WHY} />;

  return doc.kind === 'email' ? (
    <PreviewEmail emailId={doc.id} name={doc.name} />
  ) : (
    <PreviewSite doc={doc} />
  );
}
