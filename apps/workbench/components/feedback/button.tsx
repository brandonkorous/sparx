'use client';

// The toolbar's feedback control.
//
// It carries a dot only when a reply is waiting, and when it is, it opens the
// conversation LIST rather than a blank send box — a mark that means "there is
// something for you" has to lead to that something, or people learn to ignore
// the mark. With nothing waiting it does the obvious thing and opens the send
// dialog.
//
// Shift-click opens the list beside the current pane, matching the modifier
// contract every other openable thing in this app honors.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { MessageSquarePlus } from 'lucide-react';
import { useFeedbackUnreadCount } from '../../lib/api/feedback';
import { useFeedback } from './provider';

export function FeedbackButton() {
  const feedback = useFeedback();
  const { data: unreadCount = 0 } = useFeedbackUnreadCount();

  const hasUnread = unreadCount > 0;
  const label = hasUnread
    ? `Your feedback — ${String(unreadCount)} unread ${unreadCount === 1 ? 'reply' : 'replies'}`
    : 'Send feedback';

  return (
    <Tooltip content={hasUnread ? `${label} — Shift-click to open alongside` : label}>
      <Button
        color="neutral"
        variant="ghost"
        size="sm"
        shape="square"
        aria-label={label}
        // Relative so the dot can sit on the icon's corner — layout only; the
        // button's appearance still comes entirely from its variant.
        className="relative"
        onClick={(event) => {
          if (hasUnread) feedback.openList({ beside: event.shiftKey });
          else feedback.openSend({ source: 'button' });
        }}
      >
        <MessageSquarePlus className="size-4" aria-hidden />
        {hasUnread ? (
          <span className="bg-primary absolute top-0.5 right-0.5 size-2 rounded-full" aria-hidden />
        ) : null}
      </Button>
    </Tooltip>
  );
}
