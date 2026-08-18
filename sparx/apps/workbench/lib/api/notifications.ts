// Notifications — "what needs me?" (docs/124 Phase 3).
//
// Addressed to the signed-in person, with read/unread state. That is what
// separates this from the activity feed: activity is ambient context nobody has
// to acknowledge, a notification is aimed at you and waits until you deal with
// it.
//
// Rows are written by the automation engine's `platform.notify` action, so what
// appears here is governed by tenant-editable rules rather than hardcoded in a
// worker — see wizeworks/packages/automation/src/actions/notify.ts.

import { useMemo } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useMutation, useQuery, useQueryClient } from '@wizeworks/query';
import { api } from './client';

export type NotificationSeverity = 'info' | 'success' | 'warning' | 'danger';

export interface AppNotification {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  module: string | null;
  severity: NotificationSeverity;
  entityType: string | null;
  entityId: string | null;
  readAt: string | null;
  createdAt: string;
}

interface NotificationsResponse {
  items: AppNotification[];
  unreadCount: number;
}

/** Slower than the jobs chip on purpose: a notification is not a progress bar,
 *  and an inbox that repaints every four seconds is a distraction machine. */
const POLL_MS = 45_000;

/**
 * How many the BELL holds. Small on purpose — it is a queue of what still needs
 * doing, not an archive. The full history is the Pulse pane, which pages.
 */
const BELL_LIMIT = 10;

const KEY = ['notifications', 'bell'] as const;

/**
 * The BELL's data — deliberately UNREAD-ONLY.
 *
 * It used to ask for `state: 'all'` with a 30-row window, which quietly broke at
 * volume: the list is the 30 newest rows, the badge counts every unread row, so
 * on an account taking ~20 notices an hour the window covered about ninety
 * minutes. Come in after a night and the badge read "9+" while the panel showed
 * the last hour and a half — the older unread ones were counted but not listed,
 * and with no other view of them they were unreachable from the app entirely.
 *
 * Asking for the same thing the badge counts makes that class of bug impossible:
 * the list IS the badge, so the two cannot disagree. Read rows no longer take
 * slots from unread ones, and the panel becomes what a bell should be — the
 * queue of what still needs doing. History moved to Pulse, which pages.
 */
export function useNotifications(): {
  items: AppNotification[];
  unreadCount: number;
  /** Unread beyond the window — what "See all" is holding. */
  overflow: number;
  markRead: (id: string) => void;
  markAllRead: () => void;
} {
  const queryClient = useQueryClient();
  const toast = useToast();

  const query = useQuery({
    queryKey: KEY,
    queryFn: () =>
      api.get<NotificationsResponse>('/v1/notifications', {
        state: 'unread',
        limit: BELL_LIMIT,
      }),
    refetchInterval: POLL_MS,
  });

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] });
  };

  /**
   * A failed mark-read has to SAY so.
   *
   * Caught this happening: four of these went out while the API was briefly
   * unreachable, every one failed, and the interface said nothing at all — the
   * rows sat there still bold with no hint that the click had been thrown away.
   * The refetch then quietly restored the true state, so the only visible effect
   * was "I clicked and nothing happened", which reads as a broken button.
   *
   * The refetch already puts the list right, so this only needs to explain
   * itself — no rollback, no retry loop. Toast rather than an inline error
   * because the row it belongs to may well have scrolled or folded away by now.
   */
  const explainFailure = () => {
    toast.add({
      title: "Couldn't mark that read just now.",
      description: 'It is still in your list — try again in a moment.',
      type: 'error',
    });
    invalidate();
  };

  const readOne = useMutation({
    mutationFn: (id: string) => api.post(`/v1/notifications/${id}/read`),
    onSuccess: invalidate,
    onError: explainFailure,
  });

  const readAll = useMutation({
    mutationFn: () => api.post('/v1/notifications/read-all'),
    onSuccess: invalidate,
    onError: explainFailure,
  });

  const items = query.data?.items ?? [];
  const unreadCount = query.data?.unreadCount ?? 0;

  return {
    items,
    unreadCount,
    overflow: Math.max(0, unreadCount - items.length),
    markRead: (id: string) => {
      readOne.mutate(id);
    },
    markAllRead: () => {
      readAll.mutate();
    },
  };
}

interface InboxOptions {
  state: 'unread' | 'all';
  /** Module slug to narrow to, or undefined for every module. */
  module?: string | undefined;
  /** Keyset cursor — rows strictly older than this ISO instant. */
  before?: string | undefined;
  limit: number;
}

/**
 * The full inbox, paged — what the bell deliberately is not.
 *
 * Same keyset walk as the activity feed, for the same reason: rows keep arriving
 * at the top while someone reads, so an offset would re-show rows they already
 * passed.
 *
 * Returns ROWS only. The response carries `unreadCount` too, but exposing it
 * here would put the same number behind two independent fetches — which is the
 * exact divergence this whole change exists to remove. Callers that need the
 * count take it from `useNotifications`.
 */
export function useNotificationInbox(options: InboxOptions): {
  items: AppNotification[];
  ready: boolean;
  busy: boolean;
  /** Older rows almost certainly exist — inferred from a FULL window, the same
   *  cheap-and-self-correcting call the feed makes rather than a count(). */
  hasMore: boolean;
} {
  const { state, module, before, limit } = options;

  const query = useQuery({
    // Every input that changes the answer is part of the key — a filtered view
    // and the unfiltered one are different questions, and each window is its
    // own answer so stepping back to one already read is instant.
    queryKey: ['notifications', 'inbox', state, module ?? 'any', limit, before ?? 'newest'],
    queryFn: () =>
      api.get<NotificationsResponse>('/v1/notifications', {
        state,
        ...(module ? { module } : {}),
        ...(before ? { before } : {}),
        limit,
      }),
    refetchInterval: POLL_MS,
    // Keeps the window on screen while the next loads, so paging doesn't blink
    // the list out to empty and back.
    placeholderData: (previous) => previous,
  });

  const items = query.data?.items;

  return useMemo(
    () => ({
      items: items ?? [],
      ready: !query.isLoading,
      busy: query.isFetching,
      hasMore: (items?.length ?? 0) >= limit,
    }),
    [items, query.isLoading, query.isFetching, limit]
  );
}
