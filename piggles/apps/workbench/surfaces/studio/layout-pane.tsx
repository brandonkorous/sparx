'use client';

// Header & footer — one pane, one layout document.
//
// The chrome that wraps every page: the bar across the top, the block along the
// bottom, and the one place a page's content drops into. Open it beside a page and
// the two agree, because both read the same document out of the session.
//
// EXPLICIT SAVE, like every other editor on the platform. Nothing reaches the
// server until Save; nothing reaches visitors until Publish — and Publish here puts
// the chrome live on its own, so fixing a typo in the footer never ships a
// half-finished page along with it.

import { useEffect } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faCloudArrowUp, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { DocumentProvider, TreeBuilder, useDocSnapshot } from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { OpenHistory, OpenPreview } from './open-history';
import { SaveAsPiece } from './save-as-piece';
import { useLayoutDocument, type LayoutDocumentState } from './use-layout-document';

export function LayoutPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const state = useLayoutDocument();

  if (!session || state.loading || !state.store) {
    return <PaneWaiting label="Opening your header and footer…" />;
  }

  return (
    <DocumentProvider store={state.store}>
      <LayoutPaneBody ctx={ctx} state={state} onTitle={(title) => ctx.setTitle(title)} />
    </DocumentProvider>
  );
}

function LayoutPaneBody({
  ctx,
  state,
  onTitle,
}: {
  ctx: SurfaceContext;
  state: LayoutDocumentState;
  onTitle: (title: string) => void;
}) {
  const { doc, dirty } = useDocSnapshot();

  // In an effect, not in render: setting a parent's state during render is the
  // warning that becomes a loop the first time the title derives from anything
  // that moves.
  useEffect(() => {
    onTitle(doc.name || 'Header & footer');
  }, [onTitle, doc.name]);

  useDirtySource(dirty, 'Your changes to the header and footer have not been saved.');

  // A starter nobody has saved counts as unsaved work: there IS something to write,
  // and a disabled Save would leave the author no way to make the chrome theirs.
  const unsaved = dirty || !state.stored;

  return (
    <TreeBuilder
      toolbar={<LayoutActions ctx={ctx} state={state} unsaved={unsaved} />}
      statusBar={
        <LayoutStatus
          dirty={unsaved}
          stored={state.stored}
          unpublished={doc.unpublished}
          error={state.error}
        />
      }
    />
  );
}

function LayoutActions({
  ctx,
  state,
  unsaved,
}: {
  ctx: SurfaceContext;
  state: LayoutDocumentState;
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
function LayoutStatus({
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
  if (!stored) return <span>This is the starter header and footer. Save to make it yours.</span>;
  if (dirty) return <span>Not saved yet</span>;
  if (unpublished) return <span>Saved. Visitors still see the last published header.</span>;
  return <span>Saved and live.</span>;
}
