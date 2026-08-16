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
import { DocumentProvider, EmailBuilder, useDocSnapshot } from '@wizeworks/studio/react';
import type { EmailDoc } from '@wizeworks/studio';
import { PaneWaiting } from '../../components/pane-waiting';
import { useDirtySource } from '../../lib/workbench/dirty';
import { useStudioBinding } from '../../lib/studio/provider';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { EmailsList } from './emails-list';
import { OpenHistory, OpenPreview } from './open-history';
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

  return (
    <EmailBuilder
      toolbar={<EmailActions ctx={ctx} state={state} unsaved={dirty} />}
      statusBar={<EmailStatus dirty={dirty} unpublished={doc.unpublished} error={state.error} />}
    />
  );
}

function EmailActions({
  ctx,
  state,
  unsaved,
}: {
  ctx: SurfaceContext;
  state: EmailDocumentState;
  unsaved: boolean;
}) {
  return (
    <>
      <OpenPreview ctx={ctx} />
      <OpenHistory ctx={ctx} />
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
function EmailStatus({
  dirty,
  unpublished,
  error,
}: {
  dirty: boolean;
  unpublished: boolean;
  error: string | null;
}) {
  if (error) return <span className="text-error">{error}</span>;
  if (dirty) return <span>Not saved yet</span>;
  if (unpublished) return <span>Saved. Recipients still get the last published version.</span>;
  return <span>Saved. This is what recipients get.</span>;
}
