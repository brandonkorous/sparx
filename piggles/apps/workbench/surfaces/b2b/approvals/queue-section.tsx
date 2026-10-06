'use client';

import { faCheckCircle } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { FormSection } from '../../../components/form-section';
import { ListEmptyState } from '../../../components/list-empty-state';
import { PaneLoadError } from '../../../components/pane-load-error';
import { PaneWaiting } from '../../../components/pane-waiting';
import type { OpenTarget, SurfaceContext } from '../../../lib/surfaces/registry';
import { type HoldNotice } from '../approval-hold-notice';
import type { useApprovalQueue } from '../approvals-data';
import { type QueueItem } from '../approvals-data';
import { MODULE, type Decision } from './shared';
import { QueueRow } from './queue-row';

function targetFor(event: { shiftKey: boolean; altKey: boolean }): OpenTarget {
  if (event.altKey) return 'window';
  if (event.shiftKey) return 'beside';
  return 'tab';
}

export function QueueSection({
  ctx,
  search,
  queue,
  items,
  emptyQueue,
  setDecision,
}: {
  ctx: SurfaceContext;
  search: string;
  queue: ReturnType<typeof useApprovalQueue>;
  items: QueueItem[];
  emptyQueue: HoldNotice;
  setDecision: (decision: Decision) => void;
}) {
  return (
    <FormSection
      title="Waiting for sign-off"
      description="Orders held because they went over a limit. Each says who still has to approve it: your team, the customer's own approvers, or both. Rejecting cancels it, whoever it waits on."
    >
      {/* No Card: the FormSection IS one (DESIGN.md §4). The house wrappers keep a
          failed load and an empty queue from drawing the same picture. */}
      {queue.isError ? (
        <PaneLoadError
          module={MODULE}
          icon={<Icon glyph={faCheckCircle} className="size-6" aria-hidden />}
          title="Could not load the queue"
          description="This is a problem reaching the server. Your orders are unaffected: the queue just could not be read just now."
          onRetry={() => {
            void queue.refetch();
          }}
        />
      ) : queue.isPending ? (
        <PaneWaiting module={MODULE} />
      ) : items.length === 0 ? (
        <QueueEmpty search={search} emptyQueue={emptyQueue} />
      ) : (
        <QueueList ctx={ctx} items={items} setDecision={setDecision} />
      )}
    </FormSection>
  );
}

function QueueEmpty({ search, emptyQueue }: { search: string; emptyQueue: HoldNotice }) {
  return (
    <ListEmptyState
      module={MODULE}
      filtered={search.trim() !== ''}
      noResults={{
        icon: <Icon glyph={faCheckCircle} className="size-6" aria-hidden />,
        title: 'Nothing matches that',
        description: 'No held order matches that. Clear the search to see the whole queue.',
      }}
      firstRun={{
        icon: <Icon glyph={faCheckCircle} className="size-6" aria-hidden />,
        title: emptyQueue.title,
        description: emptyQueue.detail,
      }}
    />
  );
}

function QueueList({
  ctx,
  items,
  setDecision,
}: {
  ctx: SurfaceContext;
  items: QueueItem[];
  setDecision: (decision: Decision) => void;
}) {
  return (
    <ul className="flex flex-col gap-2">
      {items.map((item) => (
        <QueueRow
          key={item.id}
          item={item}
          onOpen={(event) => {
            ctx.open('commerce.order.detail', { id: item.id }, { target: targetFor(event) });
          }}
          onApprove={() => {
            setDecision({ item, action: 'approve' });
          }}
          onReject={() => {
            setDecision({ item, action: 'reject' });
          }}
        />
      ))}
    </ul>
  );
}
