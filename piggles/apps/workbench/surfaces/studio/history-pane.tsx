'use client';

// History — every version of ONE document, and the way back to any of them.
//
// A pane rather than a drawer, and beside the thing it describes rather than over
// it: the point of this console is that two documents can be on screen at once, and
// a history that covers the canvas it is about is the one arrangement that cannot
// work.
//
// TWO LADDERS, and conflating them would be the dangerous bug. Your SAVES rewrite
// the working copy — private, cheap, reversible, nobody sees it. What WENT LIVE is
// what visitors got. Interleaved by time they read as one list, and a badge is not
// enough weight to carry the difference between "changes my copy" and "changes my
// website".

import { useEffect } from 'react';
import type { DocumentKind, DocumentRef, StudioDoc } from '@wizeworks/studio';
import { useSessionSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  historySourceOf,
  useDocumentHistory,
  type HistorySource,
} from '../../lib/studio/history-data';
import { HistoryRows } from './history-rows';
import { useRestore, type RestoreState } from './use-restore';

const KINDS = new Set<DocumentKind>(['page', 'layout', 'theme', 'component', 'email']);

function refFrom(params: SurfaceContext['params']): DocumentRef | null {
  const { docKind, docId } = params;
  if (typeof docKind !== 'string' || typeof docId !== 'string') return null;
  return KINDS.has(docKind as DocumentKind) ? { kind: docKind as DocumentKind, id: docId } : null;
}

export function HistoryPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  // Subscribed, so this picks the document up as its own pane finishes opening it.
  useSessionSnapshot();
  const ref = refFrom(ctx.params);
  const doc = ref && session ? session.store(ref)?.current : undefined;

  useEffect(() => {
    ctx.setTitle(doc ? `History — ${doc.name}` : 'History');
  }, [ctx, doc]);

  if (!ref) {
    return (
      <div className="bg-base-200 flex h-full items-center justify-center p-6 text-center">
        <p className="text-base-content">
          Open this from the thing you want the history of — a page, your header and footer, a saved
          piece or an email.
        </p>
      </div>
    );
  }

  // The document has to be OPEN for its history to be readable: history is about a
  // document, and this pane has no loader of its own on purpose — two loaders for one
  // document is how a pane ends up showing a version of it nobody is editing.
  if (!session || !doc) {
    return <PaneWaiting label="Open the page, header, piece or email first…" />;
  }

  return <DocumentHistory doc={doc} ref_={ref} />;
}

function DocumentHistory({ doc, ref_ }: { doc: StudioDoc; ref_: DocumentRef }) {
  const source = historySourceOf(doc);
  const history = useDocumentHistory(source);
  const restore = useRestore(source, ref_, doc.name);

  if (history.isPending) return <PaneWaiting label="Looking back through your changes…" />;
  if (history.isError) {
    return (
      <PaneLoadError title="We couldn’t load this history" onRetry={() => void history.refetch()} />
    );
  }

  return (
    <div className="bg-base-200 flex h-full min-h-0 flex-col gap-4 overflow-auto p-4">
      {source.store === 'email' ? null : (
        <SavesSection source={source} restore={restore} entries={history.data.drafts} />
      )}
      {/* A LOOK has one ladder, not two: its publish is a point in the same history,
          because there is one set of tokens rather than a draft tree and a published
          one. Showing a second list would be the same rows twice. */}
      {source.store === 'theme' ? null : (
        <LiveSection source={source} restore={restore} entries={history.data.releases} />
      )}
    </div>
  );
}

/** What putting a version back actually costs, which differs by where it is stored. */
function savesNote(source: HistorySource): string {
  if (source.store === 'library') {
    return 'This piece is shared with your other sites, so putting a version back changes it everywhere it is used.';
  }
  if (source.store === 'theme') {
    return 'A look is shared by every site using it. Putting one back changes your copy — nobody sees it until you publish the look and then the site.';
  }
  return 'Putting one of these back changes only your copy. Nobody sees it until you publish.';
}

function SavesSection({
  source,
  restore,
  entries,
}: {
  source: HistorySource;
  restore: RestoreState;
  entries: Parameters<typeof HistoryRows>[0]['entries'];
}) {
  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <h3 className="text-base-content mb-1 text-base font-medium">Your saves</h3>
      <p className="text-base-content mb-2 text-sm">{savesNote(source)}</p>
      <HistoryRows
        entries={entries}
        action="Put this back"
        onAction={(entry) => void restore.run(entry.id)}
        pendingId={restore.pendingId}
        empty="Nothing saved yet. The first time you press Save, it will appear here."
      />
    </section>
  );
}

/**
 * What visitors got.
 *
 * Read-only for a site document, and that is a decision rather than an omission:
 * what is published is one connected thing — a page, the header around it, the
 * pieces inside it — so putting one part back to last week while the rest stays at
 * today is exactly the breakage the release history exists to prevent. An email has
 * no such coupling; it goes out on its own, so it can go back on its own.
 */
function LiveSection({
  source,
  restore,
  entries,
}: {
  source: HistorySource;
  restore: RestoreState;
  entries: Parameters<typeof HistoryRows>[0]['entries'];
}) {
  const isEmail = source.store === 'email';
  return (
    <section className="bg-base-100 rounded-lg p-3 shadow-sm">
      <h3 className="text-base-content mb-1 text-base font-medium">
        {isEmail ? 'What went out' : 'What visitors got'}
      </h3>
      <p className="text-base-content mb-2 text-sm">
        {isEmail
          ? 'Each time you publish this email, the version that went out is kept here.'
          : 'When this last changed for the people visiting your site.'}
      </p>
      <HistoryRows
        entries={entries}
        action={isEmail ? 'Put this back' : null}
        onAction={isEmail ? (entry) => void restore.run(entry.id) : undefined}
        pendingId={restore.pendingId}
        empty={
          isEmail ? 'This email hasn’t been published yet.' : 'This hasn’t been published yet.'
        }
      />
      {source.store === 'site' ? (
        <p className="text-base-content mt-3 text-sm">
          To put your live site back to how it was, use Publish — your website is one connected
          thing, so it goes back all together rather than a page at a time.
        </p>
      ) : null}
    </section>
  );
}
