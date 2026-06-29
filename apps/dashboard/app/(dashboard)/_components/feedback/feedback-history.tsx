'use client';

import * as React from 'react';
import { Button } from '@sparx/ui';
import { useQuery } from '@sparx/query';
import { Loader2, MessageSquarePlus } from 'lucide-react';
import { listMyFeedbackAction } from '../../_shell/feedback-actions';
import type { FeedbackSubmission } from '../../_shell/feedback-types';
import { FeedbackStatusBadge } from './feedback-status-badge';
import { FeedbackThreadView } from './feedback-thread';
import { CATEGORY_ICON, deriveTitle, timeAgo } from './feedback-format';

// The "Your feedback" tab: a list of the user's own submissions, drilling into a
// single thread. Only the submitter sees their own feedback (privacy, docs/112
// §9). `onCompose` jumps back to the Send tab from the empty state.
export function FeedbackHistory({
  initialThreadId,
  onCompose,
}: {
  initialThreadId?: string;
  onCompose: () => void;
}) {
  const [selectedId, setSelectedId] = React.useState<string | undefined>(initialThreadId);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', 'list'],
    queryFn: listMyFeedbackAction,
    enabled: !selectedId,
  });

  if (selectedId) {
    return <FeedbackThreadView id={selectedId} onBack={() => setSelectedId(undefined)} />;
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12 text-[var(--color-text-tertiary)]">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (isError) {
    return (
      <p className="py-10 text-center text-sm text-[var(--color-text-tertiary)]">
        Couldn’t load your feedback.
      </p>
    );
  }

  const items = data?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <MessageSquarePlus className="h-8 w-8 text-[var(--color-text-tertiary)]" />
        <p className="text-sm text-[var(--color-text-secondary)]">
          You haven’t sent any feedback yet.
        </p>
        <Button color="primary" variant="soft" size="sm" onClick={onCompose}>
          Send your first feedback
        </Button>
      </div>
    );
  }

  return (
    <ul className="flex flex-col gap-1.5">
      {items.map((item) => (
        <FeedbackRow key={item.id} item={item} onOpen={() => setSelectedId(item.id)} />
      ))}
    </ul>
  );
}

function FeedbackRow({ item, onOpen }: { item: FeedbackSubmission; onOpen: () => void }) {
  const Icon = CATEGORY_ICON[item.category];
  return (
    <li>
      <button
        type="button"
        onClick={onOpen}
        className="flex w-full items-center gap-3 rounded-md border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2.5 text-left transition-colors hover:bg-[var(--color-bg-subtle)] focus-visible:ring-2 focus-visible:ring-[var(--color-border-focus)] focus-visible:outline-none"
      >
        <Icon className="h-4 w-4 shrink-0 text-[var(--color-text-tertiary)]" />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-2">
            <span className="truncate text-sm font-medium text-[var(--color-text-primary)]">
              {deriveTitle(item)}
            </span>
            {item.userUnread && (
              <span
                className="h-2 w-2 shrink-0 rounded-full bg-[var(--color-text-link)]"
                aria-label="New reply"
              />
            )}
          </span>
          <span className="text-xs text-[var(--color-text-tertiary)]">
            {timeAgo(item.createdAt)}
            {item.messageCount
              ? ` · ${item.messageCount} repl${item.messageCount === 1 ? 'y' : 'ies'}`
              : ''}
          </span>
        </span>
        <FeedbackStatusBadge status={item.status} />
      </button>
    </li>
  );
}
