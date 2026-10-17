'use client';

// The table of messages you have sent the team: what it was, when, how many
// replies, and where it got to.

import { Table } from '../../components/table';
import { Icon } from '@piggles/ui';
import { describeAgo } from '../../lib/api/activity';
import type { FeedbackSubmission } from '../../lib/api/feedback';
import { CATEGORY_ICON, FeedbackStatusBadge, deriveTitle } from '../../components/feedback/format';

interface OpenEvent {
  shiftKey: boolean;
  altKey: boolean;
}

function FeedbackRow(props: {
  submission: FeedbackSubmission;
  onOpen: (event: OpenEvent) => void;
}) {
  const { submission, onOpen } = props;
  const glyph = CATEGORY_ICON[submission.category];
  const replies = submission.messageCount ?? 0;
  return (
    <tr
      className="cursor-pointer"
      tabIndex={0}
      role="button"
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        event.preventDefault();
        onOpen(event);
      }}
    >
      <td>
        <div className="flex items-center gap-2">
          <Icon glyph={glyph} className="size-4 shrink-0" aria-hidden />
          <span className="min-w-0 truncate font-medium">{deriveTitle(submission)}</span>
          {/* The only mark on the row, because it is the only
              thing here addressed TO the reader. */}
          {submission.userUnread ? (
            <span
              className="bg-primary size-2 shrink-0 rounded-full"
              role="img"
              aria-label="New reply"
            />
          ) : null}
        </div>
      </td>
      <td className="text-sm whitespace-nowrap" data-label="Sent">
        {describeAgo(submission.createdAt)}
      </td>
      <td className="text-sm whitespace-nowrap" data-label="Replies">
        {replies === 0 ? '—' : replies}
      </td>
      <td className="text-right">
        <FeedbackStatusBadge status={submission.status} />
      </td>
    </tr>
  );
}

export function FeedbackTable(props: {
  rows: FeedbackSubmission[];
  onOpen: (submission: FeedbackSubmission, event: OpenEvent) => void;
}) {
  return (
    <div className="card bg-base-100 overflow-hidden">
      <Table size="sm" hover>
        <thead>
          <tr>
            <th>Message</th>
            <th>Sent</th>
            <th>Replies</th>
            <th className="text-right">Status</th>
          </tr>
        </thead>
        <tbody>
          {props.rows.map((submission) => (
            <FeedbackRow
              key={submission.id}
              submission={submission}
              onOpen={(event) => {
                props.onOpen(submission, event);
              }}
            />
          ))}
        </tbody>
      </Table>
    </div>
  );
}
