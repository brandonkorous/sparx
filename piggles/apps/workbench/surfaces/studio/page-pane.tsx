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
import { DocumentProvider, TreeBuilder, useDocSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { PagesList } from './pages-list';
import { OpenHistory, OpenPreview } from './open-history';
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

  return (
    <TreeBuilder
      toolbar={<PageActions ctx={ctx} state={state} unsaved={unsaved} />}
      statusBar={
        <PageStatus
          dirty={unsaved}
          stored={state.stored}
          unpublished={doc.unpublished}
          error={state.error}
        />
      }
    />
  );
}

function PageActions({
  ctx,
  state,
  unsaved,
}: {
  ctx: SurfaceContext;
  state: PageDocumentState;
  unsaved: boolean;
}) {
  return (
    <>
      <OpenPreview ctx={ctx} />
      <OpenHistory ctx={ctx} />
      <SaveAsPiece />
      <Button
        size="sm"
        color="primary"
        variant="soft"
        disabled={!unsaved || state.saving}
        onClick={() => void state.save()}
      >
        <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
        {state.saving ? 'Saving…' : 'Save'}
      </Button>
      <Button
        size="sm"
        color="primary"
        disabled={state.publishing}
        onClick={() => void state.publish()}
      >
        <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />
        {state.publishing ? 'Publishing…' : 'Publish'}
      </Button>
    </>
  );
}

/** What is true right now, in the order someone worries about it. */
function PageStatus({
  dirty,
  stored,
  unpublished,
  error,
}: {
  dirty: boolean;
  stored: boolean;
  unpublished: boolean;
  error: string | null;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (!stored) return <span>Nothing saved on this page yet.</span>;
  if (dirty) return <span>Not saved yet</span>;
  if (unpublished) return <span>Saved. Visitors still see the last published version.</span>;
  return <span>Saved and live.</span>;
}
