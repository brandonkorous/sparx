'use client';

// One email — one pane, one document.
//
// Its own session document, with its own undo: an email shares nothing with the
// site — not a theme, not a layout, not a node vocabulary — so ⌘Z here has no
// business reaching into a page pane, and vice versa.
//
// Publishing an email means "this is what recipients get from now on", which is
// why it is per-email. Nothing about the welcome note should have to wait on the
// order confirmation being finished.

import { useEffect } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faCloudArrowUp, faFloppyDisk } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import {
  DocumentProvider,
  EmailBuilder,
  useDocSnapshot,
  type BuilderAction,
} from '@wizeworks/studio/react';
import type { EmailDoc } from '@wizeworks/studio';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { EmailsList } from './emails-list';
import { useHistoryAction, usePreviewAction } from './open-history';
import { useEmailDocument, type EmailDocumentState } from './use-email-document';

export function EmailPaneSurface({ ctx }: { ctx: SurfaceContext }) {
  const { session } = useStudioBinding();
  const emailId = typeof ctx.params.emailId === 'string' ? ctx.params.emailId : null;
  const state = useEmailDocument(emailId);

  // Opened from the nav rather than from an email: ask which one. An email editor
  // with no email is a blank screen, and picking one here is one click either way.
  if (!emailId) {
    return (
      <EmailsList
        onOpen={(id) => ctx.open('builder.email', { emailId: id }, { target: 'replace' })}
        onOpenBeside={(id) => ctx.open('builder.email', { emailId: id }, { target: 'beside' })}
      />
    );
  }

  if (state.missing) {
    return (
      <div className="bg-base-200 flex h-full flex-col items-center justify-center gap-3 p-6 text-center">
        <p className="text-base-content">
          This email isn’t here any more. It may have been deleted.
        </p>
        <Button color="primary" variant="soft" onClick={() => ctx.open('builder.email')}>
          Pick another email
        </Button>
      </div>
    );
  }

  if (!session || state.loading || !state.store) {
    return <PaneWaiting label="Opening your email…" />;
  }

  return (
    <DocumentProvider store={state.store}>
      <EmailPaneBody ctx={ctx} state={state} onTitle={(title) => ctx.setTitle(title)} />
    </DocumentProvider>
  );
}

function EmailPaneBody({
  ctx,
  state,
  onTitle,
}: {
  ctx: SurfaceContext;
  state: EmailDocumentState;
  onTitle: (title: string) => void;
}) {
  const { doc, dirty } = useDocSnapshot<EmailDoc>();

  // The tab says WHICH email — several can be open at once, and "Email" on all of
  // them tells the operator nothing about which is which.
  useEffect(() => {
    onTitle(doc.name || 'Email');
  }, [onTitle, doc.name]);

  useDirtySource(dirty, 'Your changes to this email have not been saved.');

  const actions = useEmailActions(ctx, state);

  return (
    <EmailBuilder
      toolbarLabel="Email editor controls"
      save={<SaveEmail state={state} unsaved={dirty} />}
      actions={actions}
      // Publish folds away on a narrow pane; the status line keeps saying there is
      // something to publish, and this marks where the control went.
      attention={doc.unpublished}
      statusBar={
        <EmailStatus
          dirty={dirty}
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
function useEmailActions(ctx: SurfaceContext, state: EmailDocumentState): BuilderAction[] {
  const preview = usePreviewAction(ctx);
  const history = useHistoryAction(ctx);
  return [
    preview,
    history,
    {
      label: state.publishing ? 'Publishing…' : 'Publish',
      title: 'Make this the version recipients get',
      icon: <Icon glyph={faCloudArrowUp} className="size-4" aria-hidden />,
      emphasis: 'loud',
      disabled: state.publishing,
      onClick: () => void state.publish(),
    },
  ];
}

/** The commit. Never folds, at any width — see builder-toolbar.tsx. */
function SaveEmail({ state, unsaved }: { state: EmailDocumentState; unsaved: boolean }) {
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

/** What is true right now, in the order someone worries about it.
 *
 *  `unpublished` covers two different situations and they need different
 *  sentences: an email edited since its last publish, and one that has NEVER
 *  been published. `publishedAt` is what tells them apart. Said the same way,
 *  the second promised a "last published version" that does not exist. */
function EmailStatus({
  dirty,
  unpublished,
  publishedAt,
  error,
}: {
  dirty: boolean;
  unpublished: boolean;
  publishedAt: string | null;
  error: string | null;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (dirty) return <span>Not saved yet</span>;
  if (unpublished && publishedAt === null) {
    return <span>Saved, but never published — there is nothing here to send yet.</span>;
  }
  if (unpublished) return <span>Saved. Recipients still get the last published version.</span>;
  return <span>Saved. This is what recipients get.</span>;
}
