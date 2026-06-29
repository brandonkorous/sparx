'use client';

import * as React from 'react';
import { Button, Tooltip, TooltipContent, TooltipTrigger } from '@sparx/ui';
import { useQuery } from '@sparx/query';
import { MessageSquarePlus } from 'lucide-react';
import { getFeedbackUnreadCountAction } from '../../_shell/feedback-actions';
import { useFeedback } from './feedback-provider';

// The header Feedback control (docs/112 §2.1). Always available; opens the
// compose modal, or jumps to the history tab when there's an unread staff reply
// (signalled by the dot). The unread count is client-polled — the textbook
// @sparx/query case (data that changes after load), mirroring the UpdateNotifier.
export function FeedbackButton() {
  const feedback = useFeedback();

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['feedback', 'unread-count'],
    queryFn: getFeedbackUnreadCountAction,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 30_000,
  });

  const hasUnread = unreadCount > 0;
  const label = hasUnread
    ? `Feedback — ${unreadCount} unread ${unreadCount === 1 ? 'reply' : 'replies'}`
    : 'Send feedback';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={label}
          className="relative"
          onClick={() =>
            hasUnread ? feedback.openHistory() : feedback.openSend({ source: 'button' })
          }
        >
          <MessageSquarePlus className="h-4 w-4" />
          {hasUnread && (
            <span
              aria-hidden
              className="absolute top-1 right-1 h-2 w-2 rounded-full bg-[var(--color-text-link)] ring-2 ring-[var(--color-bg-surface)]"
            />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  );
}
