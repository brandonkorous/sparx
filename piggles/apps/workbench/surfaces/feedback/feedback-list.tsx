'use client';

// Everything you've told the sparx team, and where it got to. A SURFACE, not a
// modal: the reply is usually about a pane you still have open, and a dialog
// would cover the very thing under discussion.

import { Button, Card } from '@wizeworks/silicaui-react';
import { PaneEmpty } from '../../components/pane-empty';
import { PaneLoadError } from '../../components/pane-load-error';
import { PaneWaiting } from '../../components/pane-waiting';
import { faMessagePlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useMyFeedback, type FeedbackSubmission } from '../../lib/api/feedback';
import type { OpenTarget, SurfaceContext } from '../../lib/surfaces/registry';
import { useFeedback } from '../../components/feedback/provider';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import { RowOpenHint } from '../../components/row-open-hint';
import { FeedbackTable } from './feedback-table';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}
type FeedbackQuery = ReturnType<typeof useMyFeedback>;

/** Same modifier contract as the launcher and every other list. */
function targetFor(event: OpenEvent): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

/** Registry module for this surface, so the brand's empty-state artwork is
 *  this app's own picture rather than a small grey glyph. */
const MODULE = 'platform';

function FeedbackToolbar(props: { query: FeedbackQuery; count: number; onSend: () => void }) {
  const { query, count } = props;
  const { data } = query;
  return (
    <PaneToolbar
      label="Controls for what you told us"
      status={
        <p className="shrink-0 text-sm whitespace-nowrap">
          {count === 1 ? '1 message' : `${String(count)} messages`}
          {data && data.unreadCount > 0 ? ` · ${String(data.unreadCount)} with a new reply` : ''}
        </p>
      }
      statusReady={!query.isPending}
      statusFailed={query.isError}
      primary={
        <Button color="module" size="sm" onClick={props.onSend}>
          <Icon glyph={faMessagePlus} className="size-4" aria-hidden />
          Send feedback
        </Button>
      }
      refresh={
        <RefreshButton
          isFetching={query.isFetching}
          updatedAt={data ? query.dataUpdatedAt : undefined}
          onRefresh={() => {
            void query.refetch();
          }}
        />
      }
    />
  );
}

function FeedbackBody(props: {
  pending: boolean;
  rows: FeedbackSubmission[];
  onSend: () => void;
  onOpen: (submission: FeedbackSubmission, event: OpenEvent) => void;
}) {
  if (props.pending) {
    return (
      <Card className="min-h-0 flex-1 items-center justify-center">
        <PaneWaiting />
      </Card>
    );
  }
  if (props.rows.length > 0) return <FeedbackTable rows={props.rows} onOpen={props.onOpen} />;
  return (
    <PaneEmpty
      module={MODULE}
      icon={<Icon glyph={faMessagePlus} className="size-6" aria-hidden />}
      title="You haven’t sent anything yet"
      description="Tell us what’s broken, what’s missing, or what you wish worked differently. A real person reads every message, and replies land right here."
      actions={
        <Button color="module" size="sm" onClick={props.onSend}>
          Send feedback
        </Button>
      }
    />
  );
}

function FeedbackLoadFailed({ query }: { query: FeedbackQuery }) {
  return (
    <Card className="min-h-0 flex-1 items-center justify-center">
      <PaneLoadError
        icon={<Icon glyph={faMessagePlus} className="size-6" aria-hidden />}
        title="Could not load what you told us"
        description="This is a problem reaching the server, not a problem with anything you sent. Nothing was lost."
        error={query.error}
        onRetry={() => {
          void query.refetch();
        }}
      />
    </Card>
  );
}

export function FeedbackListSurface({ ctx }: { ctx: SurfaceContext }) {
  const feedback = useFeedback();
  const query = useMyFeedback();

  const open = (submission: FeedbackSubmission, event: OpenEvent) => {
    ctx.open('platform.feedback.thread', { id: submission.id }, { target: targetFor(event) });
  };
  const onSend = () => {
    feedback.openSend({ source: 'button' });
  };

  if (query.isError) return <FeedbackLoadFailed query={query} />;

  const rows = query.data?.items ?? [];

  return (
    <div className={PANE_SHELL}>
      <FeedbackToolbar query={query} count={rows.length} onSend={onSend} />

      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <FeedbackBody pending={query.isPending} rows={rows} onSend={onSend} onOpen={open} />
      </div>

      {rows.length > 0 ? <RowOpenHint what="a message to read the conversation" /> : null}
    </div>
  );
}
