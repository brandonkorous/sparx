'use client';

// The notification bell — "what needs me?" in the toolbar (docs/124 Phase 3).
//
// It lives in the toolbar rather than the status bar deliberately. The status
// bar carries facts about the SESSION — is it saving, what's running, which
// windows are open — all of which stop mattering when you close the app. A
// notification is addressed to a PERSON and survives the session, which puts it
// with the other person-scoped chrome (the account menu, favourites).
//
// The bell is silent when there is nothing unread: no badge, no dot, no color.
// A permanently-decorated bell teaches people that the decoration means nothing.
//
// It shows UNREAD ONLY, and holds ten. That is what keeps it honest: the badge
// counts unread rows, so listing anything else lets the two disagree — which is
// exactly what happened before, on any account busy enough to matter. The full
// history, paged and filterable, is the Pulse pane; this is the queue.

import {
  Button,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { faBell } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { describeAgo } from '../lib/api/activity';
import { useNotifications, type AppNotification } from '../lib/api/notifications';
import { useWorkbench } from '../lib/workbench/context';
import {
  collapseNotices,
  destinationFor,
  NotificationIcon,
  SEVERITY_DOT,
  severityTone,
  type NoticeRun,
} from './notifications/format';

export function NotificationCenter() {
  const { controller } = useWorkbench();
  const { items, unreadCount, overflow, markRead, markAllRead } = useNotifications();
  const runs = collapseNotices(items);

  const openInbox = () => {
    controller.open('platform.pulse');
  };

  return (
    <Popover>
      <Tooltip content={unreadCount > 0 ? `${String(unreadCount)} unread` : 'Notifications'}>
        <PopoverTrigger>
          <Button
            variant="ghost"
            shape="square"
            aria-label={
              unreadCount > 0 ? `Notifications — ${String(unreadCount)} unread` : 'Notifications'
            }
            // Relative so the count can sit on the icon's corner. Layout only —
            // the button's own appearance still comes entirely from its variant.
            className="relative"
          >
            <Icon glyph={faBell} className="size-4" aria-hidden />
            {unreadCount > 0 ? (
              <span
                className="bg-danger text-danger-content absolute top-0.5 right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[11px] leading-none tabular-nums"
                aria-hidden
              >
                {unreadCount > 9 ? '9+' : String(unreadCount)}
              </span>
            ) : null}
          </Button>
        </PopoverTrigger>
      </Tooltip>

      <PopoverContent align="end" className="w-88 max-w-[92vw]">
        {/* Header keeps silica's own PopoverTitle size — it outranks the list
            because the ROWS are smaller, not because this was inflated. The rule
            spans the popover's full width (hence the negative margin); a divider
            that stops short of the edges reads as a stray underline. */}
        <div className="border-base-300 -mx-4 -mt-1 flex items-center justify-between gap-2 border-b px-4 pb-3">
          <PopoverTitle>Notifications</PopoverTitle>
          {unreadCount > 0 ? (
            <Button size="xs" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null}
        </div>

        {runs.length === 0 ? (
          // A quiet bell and a short line, not a paragraph. Empty is the state
          // this panel is in almost every time it is opened, so it has to read
          // in one glance — and now it is literally true rather than merely
          // likely: an unread-only list is empty exactly when nothing needs you.
          <EmptyState
            size="sm"
            className="py-6"
            icon={<Icon glyph={faBell} className="size-5" aria-hidden />}
            // Empty is a WIN, and the words have to say so. The first draft read
            // "Nothing needs you" — which lands as *nobody needs you*, from a
            // product, to someone running their own business, on the screen they
            // see most often.
            title="You're all caught up"
            description="Anything waiting on you — a payment that failed, stock running low — turns up here."
          />
        ) : (
          // `-mx-2` against the rows' `px-2` nets to zero, so a row's text starts
          // exactly on the popover's content edge — flush with the header above
          // it — while the hover highlight still extends past the words on both
          // sides instead of hugging them.
          <ul className="divide-base-300 -mx-2 mt-1 flex max-h-96 flex-col divide-y overflow-y-auto">
            {runs.map((run) => (
              <li key={run.notice.id}>
                <NotificationRow
                  run={run}
                  onRead={() => {
                    for (const id of run.ids) markRead(id);
                  }}
                  onOpen={(event) => {
                    const destination = destinationFor(run.notice);
                    if (!destination) return false;
                    controller.open(destination.surface, destination.params, {
                      target: event.shiftKey ? 'beside' : 'tab',
                    });
                    // Going there IS reading it — leaving the row bold after you
                    // have opened the thing it points at is just wrong.
                    for (const id of run.ids) markRead(id);
                    return true;
                  }}
                />
              </li>
            ))}
          </ul>
        )}

        {/* Always present, empty or not. The bell holds ten unread; everything
            else — read history, older unread, per-module filtering — lives in
            Pulse, and a panel that silently truncates without saying where the
            rest went is how the badge stopped being trustworthy in the first
            place. When there IS more, it says how much rather than hinting. */}
        <div className="border-base-300 -mx-4 mt-1 -mb-1 border-t px-2 pt-2">
          <Button size="sm" className="w-full justify-start" onClick={openInbox}>
            {overflow > 0 ? `See all — ${String(overflow)} more unread` : 'See all in Pulse'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

/**
 * One row — or one RUN of identical ones, folded into a single line with a
 * count. Unread rows carry the severity dot and a click target; read rows never
 * reach the bell at all, but the component still handles them because Pulse
 * renders the same shape.
 */
function NotificationRow({
  run,
  onRead,
  onOpen,
}: {
  run: NoticeRun;
  onRead: () => void;
  /** Returns false when this notification points nowhere, so the row can fall
   *  back to being a plain mark-as-read control instead of pretending to lead
   *  somewhere it can't. */
  onOpen: (event: { shiftKey: boolean }) => boolean;
}) {
  const { notice, count } = run;
  const unread = notice.readAt === null;
  // A folded run points at as many records as it counts, so "open" would mean
  // picking one of twelve arbitrarily. Marking the whole line read is the only
  // honest action; the records are reachable from their own module.
  const navigable = count === 1 && destinationFor(notice) !== null;

  const body = (
    // One line and a timestamp — no message preview, and deliberately BELOW the
    // 16px body floor.
    //
    // The floor exists for text people sit and read. This is the opposite: a bell
    // answers "what needs me?" and hands you off, so a row is a pointer, not
    // prose. Sizing it at body scale made it out-rank the panel's own header and
    // turned the dropdown into something to read instead of act on. Smaller than
    // the header is what makes it read as a list of leads. The CONTENT lives at
    // the destination the row opens — which also means a title has to stand alone:
    // `body` is detail for the surface that renders it, never the part that makes
    // the row make sense.
    <div className="flex items-start gap-2 py-2 text-sm">
      <NotificationIcon notification={notice} />

      <div className="flex min-w-0 flex-1 items-baseline gap-2 py-0.5">
        {/* Unread + how urgent, in one mark, beside the words it qualifies —
            matching the dot the feedback list already uses. */}
        {unread ? (
          <span
            className={`${SEVERITY_DOT[severityTone(notice.severity)]} size-2 shrink-0 self-center rounded-full`}
            role="img"
            aria-label="Unread"
          />
        ) : null}
        <span className="min-w-0 flex-1 font-medium">
          {notice.title}
          {count > 1 ? ` ×${String(count)}` : ''}
        </span>
        {/* A step below the title again — a timestamp is a caption ABOUT the row,
            not content of it, so it should never share rank with the thing it
            stamps. */}
        <span className="shrink-0 text-xs">{describeAgo(notice.createdAt)}</span>
      </div>
    </div>
  );

  // Nothing to open and already read — there is no action left to offer.
  if (!unread && !navigable) return <div className="px-2">{body}</div>;

  return (
    <button
      type="button"
      onClick={(event) => {
        // Opening subsumes reading; only fall back to a bare mark-as-read when
        // this notification has nowhere to send anyone.
        if (onOpen(event)) return;
        onRead();
      }}
      className="hover:bg-base-200 w-full rounded px-2 text-left"
      aria-label={ariaFor(notice, count, navigable)}
    >
      {body}
    </button>
  );
}

/** Spelled out because a folded run's label has to say what clicking does to
 *  ALL of them — "Mark as read" on a line standing for twelve rows is a lie. */
function ariaFor(notice: AppNotification, count: number, navigable: boolean): string {
  if (navigable) return `Open "${notice.title}"`;
  if (count > 1) return `Mark ${String(count)} "${notice.title}" notifications as read`;
  return `Mark "${notice.title}" as read`;
}
