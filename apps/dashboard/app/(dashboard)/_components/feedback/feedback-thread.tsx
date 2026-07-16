'use client';

import * as React from 'react';
import { Button, Textarea, toast } from '@sparx/ui';
import { useMutation, useQuery, useQueryClient } from '@sparx/query';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { getFeedbackThreadAction, replyToFeedbackAction } from '../../_shell/feedback-actions';
import type { FeedbackMessageRow } from '../../_shell/feedback-types';
import { FeedbackStatusBadge } from './feedback-status-badge';
import { CATEGORY_ICON, deriveTitle, timeAgo } from './feedback-format';

// One feedback thread: the original submission, the staff/user message timeline,
// and a reply box. Opening it clears the unread flag server-side, so we
// invalidate the list + unread-count queries on load.
export function FeedbackThreadView({ id, onBack }: { id: string; onBack: () => void }) {
  const queryClient = useQueryClient();
  const [reply, setReply] = React.useState('');

  const { data, isLoading, isError } = useQuery({
    queryKey: ['feedback', 'thread', id],
    queryFn: () => getFeedbackThreadAction(id),
  });

  // The GET clears `user_unread`; reflect that in the list + dot.
  React.useEffect(() => {
    if (data) {
      void queryClient.invalidateQueries({ queryKey: ['feedback', 'list'] });
      void queryClient.invalidateQueries({ queryKey: ['feedback', 'unread-count'] });
    }
  }, [data, queryClient]);

  const mutation = useMutation({
    mutationFn: () => replyToFeedbackAction(id, reply.trim()),
    onSuccess: () => {
      setReply('');
      void queryClient.invalidateQueries({ queryKey: ['feedback', 'thread', id] });
      toast.success('Reply sent.');
    },
    onError: () => toast.error('Could not send your reply. Please try again.'),
  });

  const Icon = data ? CATEGORY_ICON[data.category] : null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          leftIcon={<ArrowLeft className="h-4 w-4" />}
          onClick={onBack}
        >
          All feedback
        </Button>
      </div>

      {isLoading && (
        <div className="text-base-content flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin" />
        </div>
      )}
      {isError && (
        <p className="text-base-content py-8 text-center text-sm">
          Couldn’t load this conversation.
        </p>
      )}

      {data && (
        <>
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2">
              {Icon && <Icon className="text-base-content mt-0.5 h-4 w-4 shrink-0" />}
              <h3 className="text-base-content text-sm font-semibold">{deriveTitle(data)}</h3>
            </div>
            <FeedbackStatusBadge status={data.status} />
          </div>

          <ol className="flex flex-col gap-3">
            <ThreadEntry author="You" when={timeAgo(data.createdAt)} body={data.body} kind="user" />
            {data.messages.map((m) => (
              <ThreadEntry
                key={m.id}
                author={m.authorName}
                when={timeAgo(m.createdAt)}
                body={m.body}
                kind={m.authorKind}
              />
            ))}
          </ol>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (reply.trim() && !mutation.isPending) mutation.mutate();
            }}
            className="border-base-300 flex flex-col gap-2 border-t pt-3"
          >
            <Textarea
              value={reply}
              rows={2}
              maxLength={5000}
              placeholder="Add a reply…"
              aria-label="Reply"
              onChange={(e) => setReply(e.target.value)}
            />
            <div className="flex justify-end">
              <Button
                type="submit"
                size="sm"
                color="primary"
                loading={mutation.isPending}
                disabled={!reply.trim()}
              >
                Send reply
              </Button>
            </div>
          </form>
        </>
      )}
    </div>
  );
}

function ThreadEntry({
  author,
  when,
  body,
  kind,
}: {
  author: string;
  when: string;
  body: string;
  kind: FeedbackMessageRow['authorKind'];
}) {
  const isStaff = kind === 'staff';
  return (
    <li
      className={`rounded-md border px-3 py-2 ${
        isStaff ? 'border-base-300 bg-base-200' : 'border-base-300 bg-base-100'
      }`}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="text-base-content text-xs font-medium">
          {isStaff ? `${author} · sparx` : author}
        </span>
        <span className="text-base-content text-xs">{when}</span>
      </div>
      <p className="text-base-content text-sm whitespace-pre-wrap">{body}</p>
    </li>
  );
}
