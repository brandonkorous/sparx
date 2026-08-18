'use client';

// "What needs you" — the third thing Pulse carries (docs/124 Phase 3), and the
// full inbox the bell deliberately isn't.
//
// It exists because the bell alone could not scale. The bell lists ten unread
// and nothing else; on an account taking twenty notices an hour that is about
// thirty minutes of queue, and every notice older than that — read or not — had
// nowhere to be seen. A badge counting rows the app cannot display is a badge
// people learn to ignore.
//
// So the division is by JOB, not by size: the bell is a queue you clear, this is
// a record you search. That is also why rows here show their message body and
// the bell's do not — this is a place you sit and read, with the room to do it.
//
// Paged by keyset cursor, like the activity feed beside it and for the same
// reason: rows keep arriving at the top while someone reads, so an offset window
// would push rows they already passed down onto the next page.

import { useState } from 'react';
import { Badge, Button, EmptyState, Text, Tooltip } from '@wizeworks/silicaui-react';
import { Bell, Check } from 'lucide-react';
import { FormSection } from '../../components/form-section';
import { ListPagination, type PageSize } from '../../components/list-pagination';
import { describeAgo } from '../../lib/api/activity';
import { useNotificationInbox, useNotifications } from '../../lib/api/notifications';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  collapseNotices,
  destinationFor,
  NotificationIcon,
  SEVERITY_DOT,
  severityTone,
  type NoticeRun,
} from '../../components/notifications/format';

type InboxState = 'unread' | 'all';

export function NeedsYou({ ctx }: { ctx: SurfaceContext }) {
  const [state, setState] = useState<InboxState>('unread');
  const [pageSize, setPageSize] = useState<PageSize>(25);
  // One cursor per step back in time; empty is the newest window. A stack, not
  // a value, because walking back toward now needs the boundary of the window
  // before — which only this remembers.
  const [cursors, setCursors] = useState<string[]>([]);

  const before = cursors[cursors.length - 1];
  const { items, ready, busy, hasMore } = useNotificationInbox({
    state,
    limit: pageSize,
    ...(before ? { before } : {}),
  });
  // The count comes from the BELL's query, not this one — deliberately, even
  // though both endpoints return the field. Two fetches of the same number drift
  // whenever one lands and the other doesn't (watched exactly that happen while
  // the API was flapping: the badge said one thing, this chip another). One
  // source, one number. Costs no extra request either — the bell's query is
  // already mounted in the chrome and this shares its key.
  const { unreadCount, markRead, markAllRead } = useNotifications();

  const runs = collapseNotices(items);
  const firstRow = cursors.length * pageSize + 1;

  /** Any filter change invalidates every cursor — the windows it walked no
   *  longer line up with the rows now matching. Always return to the newest. */
  const refilter = (next: InboxState) => {
    setState(next);
    setCursors([]);
  };

  const empty = ready && items.length === 0 && cursors.length === 0;

  return (
    <FormSection
      title="Needs your attention"
      description="Addressed to you personally — and it waits here until you've dealt with it."
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {/* A variant switch on a real component, not a hand-built segmented
            control: the selected side is solid, the other ghost. */}
        <Button
          color="neutral"
          variant={state === 'unread' ? 'solid' : 'ghost'}
          size="sm"
          aria-pressed={state === 'unread'}
          onClick={() => {
            refilter('unread');
          }}
        >
          Unread{unreadCount > 0 ? ` (${String(unreadCount)})` : ''}
        </Button>
        <Button
          color="neutral"
          variant={state === 'all' ? 'solid' : 'ghost'}
          size="sm"
          aria-pressed={state === 'all'}
          onClick={() => {
            refilter('all');
          }}
        >
          Everything
        </Button>

        {unreadCount > 0 ? (
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            className="ms-auto"
            onClick={markAllRead}
          >
            Mark all read
          </Button>
        ) : null}
      </div>

      {empty ? (
        <EmptyState
          icon={<Bell className="size-6" aria-hidden />}
          // Empty is a WIN here, not an absence, and the words have to say so.
          // The first draft read "Nothing needs you" — which lands as *nobody
          // needs you*, from a product, to someone running their own business,
          // on the screen they see most often. An empty inbox means they are on
          // top of things; the copy should tell them that.
          title={state === 'unread' ? "You're all caught up" : 'Nothing here yet'}
          description={
            state === 'unread'
              ? 'Anything waiting on you turns up here — a payment that failed, stock running low, a reply from the sparx team.'
              : 'When sparx has something to tell you, it lands here and stays, so you can come back to it whenever you like.'
          }
        />
      ) : items.length === 0 ? (
        // Reachable when a full last window left the cursor one step past the
        // end. Not an error, and not the same as an empty inbox.
        <Text className="py-2">
          Nothing older to show. Step back to Newer for the most recent notifications.
        </Text>
      ) : (
        <ul className="divide-base-300 flex flex-col divide-y">
          {runs.map((run) => (
            <li key={run.notice.id}>
              <NoticeRow
                run={run}
                ctx={ctx}
                onRead={() => {
                  for (const id of run.ids) markRead(id);
                }}
              />
            </li>
          ))}
        </ul>
      )}

      <ListPagination
        shown={items.length}
        firstRow={firstRow}
        page={cursors.length + 1}
        pageSize={pageSize}
        busy={busy}
        hasMore={hasMore}
        onOlder={() => {
          const last = items[items.length - 1];
          if (last) setCursors((current) => [...current, last.createdAt]);
        }}
        {...(cursors.length > 0
          ? {
              onNewer: () => {
                setCursors((current) => current.slice(0, -1));
              },
            }
          : {})}
        onPageSizeChange={(size) => {
          setPageSize(size);
          setCursors([]);
        }}
      />
    </FormSection>
  );
}

/**
 * One row of the inbox — or one folded run of identical ones.
 *
 * Unlike the bell's row this one shows the message body, because this surface
 * has the room and the job: the bell hands you off, this is where you read.
 * Marking read is an explicit control rather than a side effect of clicking,
 * since on a record you are reading, "I have seen this" and "take me there" are
 * two different intentions.
 */
function NoticeRow({
  run,
  ctx,
  onRead,
}: {
  run: NoticeRun;
  ctx: SurfaceContext;
  onRead: () => void;
}) {
  const { notice, count } = run;
  const unread = notice.readAt === null;
  const destination = destinationFor(notice);
  // A folded run points at as many records as it counts, so opening would mean
  // picking one of them arbitrarily.
  const canOpen = count === 1 && destination !== null;

  return (
    <div className="flex items-start gap-3 py-3">
      <NotificationIcon notification={notice} />

      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          {unread ? (
            <span
              className={`${SEVERITY_DOT[severityTone(notice.severity)]} size-2 shrink-0 self-center rounded-full`}
              role="img"
              aria-label="Unread"
            />
          ) : null}
          <span className="min-w-0 flex-1 font-medium">{notice.title}</span>
          {count > 1 ? (
            <Badge color="neutral" variant="soft" size="sm" className="shrink-0">
              ×{String(count)}
            </Badge>
          ) : null}
          <span className="shrink-0 text-sm">{describeAgo(notice.createdAt)}</span>
        </div>

        {notice.body ? <p className="mt-0.5">{notice.body}</p> : null}

        {canOpen && destination ? (
          <Button
            color="neutral"
            variant="link"
            size="sm"
            className="mt-1 px-0"
            onClick={(event) => {
              ctx.open(destination.surface, destination.params, {
                target: event.shiftKey ? 'beside' : 'tab',
              });
              // Going there IS reading it.
              if (unread) onRead();
            }}
          >
            Open
          </Button>
        ) : null}
      </div>

      {unread ? (
        <Tooltip content={count > 1 ? `Mark all ${String(count)} read` : 'Mark read'}>
          <Button
            color="neutral"
            variant="ghost"
            size="sm"
            shape="square"
            className="shrink-0"
            aria-label={
              count > 1
                ? `Mark ${String(count)} "${notice.title}" notifications as read`
                : `Mark "${notice.title}" as read`
            }
            onClick={onRead}
          >
            <Check className="size-4" aria-hidden />
          </Button>
        </Tooltip>
      ) : null}
    </div>
  );
}
