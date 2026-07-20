'use client';

// The notification bell — "what needs me?" in the toolbar (docs/124 Phase 3).
//
// It lives in the toolbar rather than the status bar deliberately. The status
// bar carries facts about the SESSION — is it saving, what's running, which
// windows are open — all of which stop mattering when you close the app. A
// notification is addressed to a PERSON and survives the session, which puts it
// with the other person-scoped chrome (the account menu, favourites).
//
// The bell is silent when there is nothing unread: no badge, no dot, no colour.
// A permanently-decorated bell teaches people that the decoration means nothing.

import {
  Badge,
  Button,
  EmptyState,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
  Tooltip,
} from '@wizeworks/silicaui-react';
import { Bell } from 'lucide-react';
import { describeAgo } from '../lib/api/activity';
import { useNotifications, type AppNotification } from '../lib/api/notifications';
import { useWorkbench } from '../lib/workbench/context';

/** Severity is the semantic colour axis — independent of any module hue. */
function severityTone(
  severity: AppNotification['severity']
): 'success' | 'warning' | 'danger' | 'info' {
  if (severity === 'success' || severity === 'warning' || severity === 'danger') return severity;
  return 'info';
}

/**
 * Where a notification LEADS. The row carries `entityType`/`entityId` precisely
 * so the consumer can resolve a destination without a stored route — which is
 * what lets the same row mean "open the thread pane" here and "open the modal"
 * in the dashboard. A notification that only marks itself read is a dead end:
 * it announces something and then makes you go find it.
 */
function destinationFor(
  notification: AppNotification
): { surface: string; params?: Record<string, string> } | null {
  if (notification.entityType === 'feedback' && notification.entityId) {
    return { surface: 'platform.feedback.thread', params: { id: notification.entityId } };
  }
  return null;
}

export function NotificationCenter() {
  const { controller } = useWorkbench();
  const { items, unreadCount, markRead, markAllRead } = useNotifications();

  return (
    <Popover>
      <Tooltip content={unreadCount > 0 ? `${String(unreadCount)} unread` : 'Notifications'}>
        <PopoverTrigger>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            shape="square"
            aria-label={
              unreadCount > 0 ? `Notifications — ${String(unreadCount)} unread` : 'Notifications'
            }
            // Relative so the count can sit on the icon's corner. Layout only —
            // the button's own appearance still comes entirely from its variant.
            className="relative"
          >
            <Bell className="size-4" aria-hidden />
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
        <div className="flex items-center justify-between gap-2">
          <PopoverTitle>Notifications</PopoverTitle>
          {unreadCount > 0 ? (
            <Button color="neutral" variant="ghost" size="xs" onClick={markAllRead}>
              Mark all read
            </Button>
          ) : null}
        </div>

        {items.length === 0 ? (
          // A quiet bell and a short line, not a paragraph. Empty is the state
          // this panel is in almost every time it is opened, so it has to read
          // in one glance — and the answer ("nothing") deserves less room than
          // the answer ("six things need you"). Hierarchy from the icon and the
          // title's scale; the supporting line keeps a real ink token rather
          // than being faded into decoration.
          <EmptyState
            size="sm"
            className="py-6"
            icon={<Bell className="size-5" aria-hidden />}
            title="Nothing needs you"
            description="When something does — a payment fails, stock runs out — it shows up here."
          />
        ) : (
          <ul className="divide-base-300 mt-2 flex max-h-96 flex-col divide-y overflow-y-auto">
            {items.map((item) => (
              <li key={item.id}>
                <NotificationRow
                  notification={item}
                  onRead={() => {
                    markRead(item.id);
                  }}
                  onOpen={(event) => {
                    const destination = destinationFor(item);
                    if (!destination) return false;
                    controller.open(destination.surface, destination.params, {
                      target: event.shiftKey ? 'beside' : 'tab',
                    });
                    // Going there IS reading it — leaving the row bold after you
                    // have opened the thing it points at is just wrong.
                    if (item.readAt === null) markRead(item.id);
                    return true;
                  }}
                />
              </li>
            ))}
          </ul>
        )}
      </PopoverContent>
    </Popover>
  );
}

/**
 * One notification. Unread rows carry the severity badge and a click target that
 * marks them read; read rows stay legible — they are de-emphasised by losing the
 * badge, never by fading the words, because text nobody can read is not a
 * softer version of text, it is missing text.
 */
function NotificationRow({
  notification,
  onRead,
  onOpen,
}: {
  notification: AppNotification;
  onRead: () => void;
  /** Returns false when this notification points nowhere, so the row can fall
   *  back to being a plain mark-as-read control instead of pretending to lead
   *  somewhere it can't. */
  onOpen: (event: { shiftKey: boolean }) => boolean;
}) {
  const unread = notification.readAt === null;
  const navigable = destinationFor(notification) !== null;

  const body = (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-baseline justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{notification.title}</span>
        <span className="shrink-0 text-sm">{describeAgo(notification.createdAt)}</span>
      </div>
      {notification.body ? <p className="text-sm">{notification.body}</p> : null}
      {unread ? (
        <span>
          <Badge color={severityTone(notification.severity)} variant="soft" size="sm">
            New
          </Badge>
        </span>
      ) : null}
    </div>
  );

  // Nothing to open and already read — there is no action left to offer.
  if (!unread && !navigable) return <div className="px-1">{body}</div>;

  return (
    <button
      type="button"
      onClick={(event) => {
        // Opening subsumes reading; only fall back to a bare mark-as-read when
        // this notification has nowhere to send anyone.
        if (onOpen(event)) return;
        onRead();
      }}
      className="hover:bg-base-200 w-full rounded px-1 text-left"
      aria-label={
        navigable ? `Open "${notification.title}"` : `Mark "${notification.title}" as read`
      }
    >
      {body}
    </button>
  );
}
