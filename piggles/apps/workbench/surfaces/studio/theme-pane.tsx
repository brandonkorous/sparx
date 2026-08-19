'use client';

// Look & feel — one pane, one theme document.
//
// Open it beside the page builder and change a color: the page repaints as you
// drag, because both panes read the same document out of the session. That is the
// thing the old editor could not do, and it is the reason this pane exists at all
// rather than being a mode inside another one.
//
// EXPLICIT SAVE, like every other editor on the platform. Nothing reaches the
// server until Save; nothing reaches visitors until Publish.

import { useEffect, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faCloudArrowUp, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  DocumentProvider,
  ThemeBuilder,
  useDocSnapshot,
  type BuilderAction,
} from '@wizeworks/studio/react';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import { useJustPublished } from '../../lib/studio/just-published';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useHistoryAction, usePreviewAction } from './open-history';
import { ThemeLibrary } from './theme-library';
import { useThemeDocument } from './use-theme-document';

export function ThemePaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const paramId = typeof ctx.params.themeId === 'string' ? ctx.params.themeId : null;
  const [openId, setOpenId] = useState<string | null>(paramId);
  const state = useThemeDocument(openId);

  if (!session || state.loading) {
    return <PaneWaiting label="Opening your look…" />;
  }

  if (!state.store) {
    return (
      <div className="bg-base-200 flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base-content">
          Your site is using the colors from your business details. Pick a look to change how it
          feels.
        </p>
        <ThemeLibrary appliedId={state.appliedId} openId={openId} onOpen={setOpenId} />
      </div>
    );
  }

  return (
    <DocumentProvider store={state.store}>
      <ThemePaneBody
        ctx={ctx}
        state={state}
        openId={openId}
        onOpen={setOpenId}
        onTitle={(title) => ctx.setTitle(title)}
      />
    </DocumentProvider>
  );
}

function ThemePaneBody({
  ctx,
  state,
  openId,
  onOpen,
  onTitle,
}: {
  ctx: SurfaceContext;
  state: ReturnType<typeof useThemeDocument>;
  openId: string | null;
  onOpen: (id: string) => void;
  onTitle: (title: string) => void;
}) {
  const { doc, dirty } = useDocSnapshot();

  // The tab says WHICH look, because several of these can be open at once and
  // "Look & feel" on all of them tells the operator nothing about which is which.
  // In an effect, not in render: setting a parent's state during render is the
  // warning that becomes a loop the first time the title derives from anything
  // that moves.
  useEffect(() => {
    onTitle(`Look · ${doc.name}`);
  }, [onTitle, doc.name]);

  useDirtySource(dirty, 'Your changes to this look have not been saved.');

  const actions = useThemeActions(ctx, state);

  return (
    <ThemeBuilder
      toolbarLabel="Look & feel controls"
      save={<SaveTheme state={state} dirty={dirty} />}
      actions={actions}
      controls={<ThemeLibrary appliedId={state.appliedId} openId={openId} onOpen={onOpen} />}
      // Publish folds away on a narrow pane; the status line keeps saying there is
      // something to publish, and this marks where the control went.
      attention={doc.unpublished}
      statusBar={
        <ThemeStatus
          dirty={dirty}
          unpublished={doc.unpublished}
          publishedAt={doc.publishedAt}
          applied={state.appliedId === doc.id}
        />
      }
    />
  );
}

/** What this pane offers. All of it may fold into the bar's popover; Save may not —
 *  Publish is lifecycle on a stored document, a Save is the storing. */
function useThemeActions(
  ctx: SurfaceContext,
  state: ReturnType<typeof useThemeDocument>
): BuilderAction[] {
  const preview = usePreviewAction(ctx);
  const history = useHistoryAction(ctx);
  return [
    preview,
    history,
    {
      label: state.publishing ? 'Publishing…' : 'Publish',
      title: 'Put this look on your site',
      icon: <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />,
      emphasis: 'loud',
      disabled: state.publishing,
      onClick: () => void state.publish(),
    },
  ];
}

/** The commit. Never folds, at any width — see builder-toolbar.tsx. */
function SaveTheme({
  state,
  dirty,
}: {
  state: ReturnType<typeof useThemeDocument>;
  dirty: boolean;
}) {
  return (
    <Button
      size="sm"
      color="primary"
      variant="soft"
      className="shrink-0 whitespace-nowrap"
      disabled={!dirty || state.saving}
      onClick={() => void state.save()}
    >
      <Icon glyph={faFloppyDisk} className="size-4" aria-hidden />
      {state.saving ? 'Saving…' : 'Save'}
    </Button>
  );
}

/** What is true right now, in the order someone worries about it. */
function ThemeStatus({
  dirty,
  unpublished,
  publishedAt,
  applied,
}: {
  dirty: boolean;
  unpublished: boolean;
  publishedAt: string | null;
  applied: boolean;
}) {
  const catchingUp = useJustPublished(publishedAt);

  if (dirty) return <span>Not saved yet</span>;
  if (!applied) return <span>Saved. Your site is using a different look.</span>;
  if (unpublished) return <span>Saved. Visitors still see the last published look.</span>;
  if (catchingUp) return <span>Published. Your site catches up within a few minutes.</span>;
  return <span>Saved and live.</span>;
}
