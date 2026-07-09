'use client';

// The inbox list — one row per submission, newest first. Seeded with the
// server's first page; "Load older messages" appends the next page via the
// cursor action. Each row links to the full message. Unread ('new') rows are
// visually distinct (a status dot + medium-weight name). Status wears a semantic
// pill via statusTone (docs/DESIGN Semantic-Status rule).

import * as React from 'react';
import Link from 'next/link';
import { UserCheck } from 'lucide-react';
import { Badge, Button, Card, ModuleProvider, Stack, Text, statusTone } from '@sparx/ui';

import { loadMoreSubmissionsAction } from '../actions';
import {
  SUBMISSIONS_PAGE_SIZE,
  STATUS_LABEL,
  formatRelativeTime,
  messageSnippet,
  submissionDisplayName,
  type FormSubmission,
  type FormSubmissionStatus,
} from '../types';

export function SubmissionsList({
  initial,
  status,
}: {
  initial: FormSubmission[];
  status?: FormSubmissionStatus;
}) {
  const [items, setItems] = React.useState(initial);
  const [hasMore, setHasMore] = React.useState(initial.length === SUBMISSIONS_PAGE_SIZE);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Reset when the server re-seeds (status filter changed / router.refresh).
  React.useEffect(() => {
    setItems(initial);
    setHasMore(initial.length === SUBMISSIONS_PAGE_SIZE);
    setError(null);
  }, [initial]);

  async function loadMore() {
    const cursor = items[items.length - 1]?.id;
    if (!cursor) return;
    setLoading(true);
    setError(null);
    const result = await loadMoreSubmissionsAction({ status, cursor });
    setLoading(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    const next = result.data.submissions;
    setItems((prev) => [...prev, ...next]);
    setHasMore(next.length === SUBMISSIONS_PAGE_SIZE);
  }

  return (
    <Stack gap={4}>
      <Card padding="none">
        <ul className="divide-base-300 divide-y">
          {items.map((s) => (
            <SubmissionRow key={s.id} submission={s} />
          ))}
        </ul>
      </Card>

      {error ? (
        <Text size="sm" variant="muted">
          {error}
        </Text>
      ) : null}

      {hasMore ? (
        <div className="flex justify-center">
          <Button variant="outline" loading={loading} onClick={loadMore}>
            Load older messages
          </Button>
        </div>
      ) : null}
    </Stack>
  );
}

function SubmissionRow({ submission: s }: { submission: FormSubmission }) {
  const unread = s.status === 'new';
  return (
    <li>
      <Link
        href={`/builder/forms/${s.id}`}
        className="hover:bg-base-200 flex gap-3 px-4 py-3.5 transition-colors"
      >
        <span aria-hidden className="mt-1.5 w-2 shrink-0">
          {unread ? <span className="bg-info block h-2 w-2 rounded-full" /> : null}
        </span>

        <Stack gap={1} className="min-w-0 flex-1">
          <Stack direction="row" align="center" gap={2} wrap>
            <Text weight={unread ? 'medium' : 'regular'} className="truncate">
              {submissionDisplayName(s)}
            </Text>
            {s.email && s.name ? (
              <Text size="sm" variant="muted" className="truncate">
                {s.email}
              </Text>
            ) : null}
            {s.customerId ? (
              <ModuleProvider module="crm">
                <Badge color="module" variant="soft" size="sm">
                  <UserCheck className="mr-1 h-3 w-3" />
                  In contacts
                </Badge>
              </ModuleProvider>
            ) : null}
          </Stack>
          <Text size="sm" variant="muted" className="line-clamp-1">
            {messageSnippet(s.message)}
          </Text>
          <Text size="xs" variant="muted">
            {[s.formName, s.pageSlug ? `/${s.pageSlug}` : null].filter(Boolean).join(' · ')}
          </Text>
        </Stack>

        <Stack gap={2} align="end" className="shrink-0">
          <Badge color={statusTone(s.status)} variant="soft" size="sm">
            {STATUS_LABEL[s.status]}
          </Badge>
          <Text size="xs" variant="muted" suppressHydrationWarning>
            {formatRelativeTime(s.createdAt)}
          </Text>
        </Stack>
      </Link>
    </li>
  );
}
