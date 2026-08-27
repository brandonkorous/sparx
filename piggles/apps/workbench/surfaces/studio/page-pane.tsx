'use client';

// One page — one pane, one document.
//
// The canvas draws the page inside the header and footer it will actually wear, and
// only the page's own body is editable there: the chrome is context, real and live
// and inert. That is what makes this worth a pane of its own. Open two, on two
// pages, and both stay honest — they are two documents, not two copies of a site.

import { useEffect } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faCloudArrowUp, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  DocumentProvider,
  TreeBuilder,
  useDocSnapshot,
  type BuilderAction,
} from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import { useJustPublished } from '../../lib/studio/just-published';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PagesList } from './pages-list';
import { useHistoryAction, usePreviewAction } from './open-history';
import { SaveAsPiece } from './save-as-piece';
import { usePageDocument, type PageDocumentState } from './use-page-document';

export function PagePaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const pageId = typeof ctx.params.pageId === 'string' ? ctx.params.pageId : null;
  const state = usePageDocument(pageId);

  // Opened from the nav rather than from a page: ask which one. A page editor with
  // no page is a blank screen, and picking one here is one click either way.
  //
  // `replace`, so choosing a page turns THIS pane into that page's editor. Opening a
  // new tab instead would leave the picker sitting behind it, and the second page an
  // author opened would be their third tab. Two pages side by side is still one
  // gesture — open the picker again, pick the other, tear it beside.
  if (!pageId) {
    return (
      <PagesList
        onOpen={(id) => ctx.open('builder.page', { pageId: id }, { target: 'replace' })}
        onOpenBeside={(id) => ctx.open('builder.page', { pageId: id }, { target: 'beside' })}
      />
    );
  }

  if (state.missing) {
    return (
      <div className="bg-base-200 flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base-content">
          This page isn’t here any more. It may have been deleted.
        </p>
        <Button color="primary" variant="soft" onClick={() => ctx.open('builder.page')}>
          Pick another page
        </Button>
      </div>
    );
  }

  if (!session || state.loading || !state.store) {
    return <PaneWaiting label="Opening your page…" />;
  }

  return (
    <DocumentProvider store={state.store}>
      <PagePaneBody ctx={ctx} state={state} onTitle={(title) => ctx.setTitle(title)} />
    </DocumentProvider>
  );
}

function PagePaneBody({
  ctx,
  state,
  onTitle,
}: {
  ctx: SurfaceContext;
  state: PageDocumentState;
  onTitle: (title: string) => void;
}) {
  const { doc, dirty } = useDocSnapshot();

  // The tab says WHICH page — several of these can be open at once, and "Page" on
  // all of them tells the operator nothing about which is which.
  useEffect(() => {
    onTitle(doc.name || 'Page');
  }, [onTitle, doc.name]);

  useDirtySource(dirty, 'Your changes to this page have not been saved.');

  const unsaved = dirty || !state.stored;
  const actions = usePageActions(ctx, state);

  return (
    <TreeBuilder
      toolbarLabel="Page editor controls"
      save={<SavePage state={state} unsaved={unsaved} />}
      actions={actions}
      controls={<SaveAsPiece />}
      // Publish folds away on a narrow pane; the status line keeps saying there is
      // something to publish, and this marks where the control went.
      attention={doc.unpublished}
      statusBar={
        <PageStatus
          dirty={unsaved}
          stored={state.stored}
          starter={state.starter}
          live={state.live}
          unpublished={doc.unpublished}
          publishedAt={doc.publishedAt}
          error={state.error}
        />
      }
    />
  );
}

/** What this pane OFFERS — all foldable, so each carries its own label. Publish is
 *  here and Save is not: Publish is lifecycle on a stored document, a Save IS the
 *  storing, and an unreachable Save is work that stops existing. */
function usePageActions(ctx: SurfaceContext, state: PageDocumentState): BuilderAction[] {
  const preview = usePreviewAction(ctx);
  const history = useHistoryAction(ctx);
  return [
    preview,
    history,
    {
      label: state.publishing ? 'Publishing…' : 'Publish',
      title: 'Put this page in front of visitors',
      icon: <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />,
      emphasis: 'loud',
      disabled: state.publishing,
      onClick: () => void state.publish(),
    },
  ];
}

/** The commit. Never folds, at any width — see builder-toolbar.tsx. */
function SavePage({ state, unsaved }: { state: PageDocumentState; unsaved: boolean }) {
  return (
    <Button
      size="sm"
      color="primary"
      variant="soft"
      className="shrink-0 whitespace-nowrap"
      disabled={!unsaved || state.saving}
      onClick={() => void state.save()}
    >
      <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
      {state.saving ? 'Saving…' : 'Save'}
    </Button>
  );
}

/** What is true right now, in the order someone worries about it. */
function PageStatus({
  dirty,
  stored,
  starter,
  live,
  unpublished,
  publishedAt,
  error,
}: {
  dirty: boolean;
  stored: boolean;
  starter: boolean;
  live: boolean;
  unpublished: boolean;
  publishedAt: string | null;
  error: string | null;
}) {
  const catchingUp = useJustPublished(publishedAt);

  if (error) return <span className="text-error">{error}</span>;
  // "Nothing saved" was read as "nothing here", and it was printed over the page
  // her visitors were reading — the starter the site serves until she saves her own.
  if (starter) return <span>This is the page your visitors see. Save it to make it yours.</span>;
  if (!stored) return <span>Nothing saved on this page yet.</span>;
  if (dirty) return <span>Not saved yet</span>;
  // Never published is not the same as published-then-edited: there is no last
  // published version for a visitor to still be seeing.
  //
  // Unless the PLATFORM is serving one. A record template's address and every starter
  // address are drawn by the standard design whether or not this page went live, so
  // "your visitors can't see this page yet" is false about them — said over `/blog`,
  // which was serving her three articles as she read it (issue 274).
  if (unpublished && publishedAt === null && live) {
    return <span>Saved. Visitors still see the standard design until you publish.</span>;
  }
  if (unpublished && publishedAt === null) {
    return <span>Saved, but never published — your visitors can’t see this page yet.</span>;
  }
  if (unpublished) return <span>Saved. Visitors still see the last published version.</span>;
  // "Saved and live" the instant the API returned was a claim about the visitor
  // made from the console's own state.
  if (catchingUp) return <span>Published. Your site catches up within a few minutes.</span>;
  return <span>Saved and live.</span>;
}
