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
import { useHistoryAction, usePreviewAction } from './open-history';
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
  const actions = useLayoutActions(ctx, state);

  return (
    <TreeBuilder
      toolbarLabel="Header & footer controls"
      save={<SaveLayout state={state} unsaved={unsaved} />}
      actions={actions}
      controls={<SaveAsPiece />}
      // Publish folds away on a narrow pane; the status line keeps saying there is
      // something to publish, and this marks where the control went.
      attention={doc.unpublished}
      statusBar={
        <LayoutStatus
          dirty={unsaved}
          stored={state.stored}
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
function useLayoutActions(ctx: SurfaceContext, state: LayoutDocumentState): BuilderAction[] {
  const preview = usePreviewAction(ctx);
  const history = useHistoryAction(ctx);
  return [
    preview,
    history,
    {
      label: state.publishing ? 'Publishing…' : 'Publish',
      title: 'Put this header and footer on every page',
      icon: <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />,
      emphasis: 'loud',
      disabled: state.publishing,
      onClick: () => void state.publish(),
    },
  ];
}

/** The commit. Never folds, at any width — see builder-toolbar.tsx. */
function SaveLayout({ state, unsaved }: { state: LayoutDocumentState; unsaved: boolean }) {
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
function LayoutStatus({
  dirty,
  stored,
  unpublished,
  publishedAt,
  error,
}: {
  dirty: boolean;
  stored: boolean;
  unpublished: boolean;
  publishedAt: string | null;
  error: string | null;
}) {
  const catchingUp = useJustPublished(publishedAt);

  if (error) return <span className="text-error">{error}</span>;
  if (!stored) return <span>This is the starter header and footer. Save to make it yours.</span>;
  if (dirty) return <span>Not saved yet</span>;
  if (unpublished) return <span>Saved. Visitors still see the last published header.</span>;
  if (catchingUp) return <span>Published. Your site catches up within a few minutes.</span>;
  return <span>Saved and live.</span>;
}
