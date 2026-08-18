'use client';

// The topbar's help control — and the only one.
//
// It is a question mark rather than a message icon because there is no help
// SITE to point at, and a `?` leading to a 404 is worse than no `?` at all.
// Asking here reaches a real person.
//
// It carries a dot only when a reply is waiting, and when it is, it opens the
// conversation LIST rather than a blank send box — a mark that means "there is
// something for you" has to lead to that something, or people learn to ignore
// the mark. With nothing waiting it does the obvious thing and opens the send
// dialog.
//
// The topbar used to hand-roll its own version of this: same icon, same tooltip,
// straight to `openSend()`. That copy could not show the dot, so somebody who
// wrote in and got an answer had no way to find out — the reply sat in a pane
// nobody had a reason to open. One control, and it is this one.
//
// Shift-click opens the list beside the current pane, matching the modifier
// contract every other openable thing in this app honors.

import { Button, Tooltip } from '@wizeworks/silicaui-react';
import { faCircleQuestion } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { useFeedbackUnreadCount } from '../../lib/api/feedback';
import { useFeedback } from './provider';

export function FeedbackButton() {
  const feedback = useFeedback();
  const { data: unreadCount = 0 } = useFeedbackUnreadCount();

  const hasUnread = unreadCount > 0;
  const label = hasUnread
    ? `You have ${String(unreadCount)} ${unreadCount === 1 ? 'reply' : 'replies'} waiting`
    : 'Get help or tell us something';

  return (
    <Tooltip content={hasUnread ? `${label} — Shift-click to open alongside` : label}>
      <Button
        variant="ghost"
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
        <Icon glyph={faCircleQuestion} className="size-4" aria-hidden />
        {hasUnread ? (
          <span className="bg-primary absolute top-0.5 right-0.5 size-2 rounded-full" aria-hidden />
        ) : null}
      </Button>
    </Tooltip>
  );
}
