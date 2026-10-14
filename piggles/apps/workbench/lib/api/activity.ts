// Activity: what has been happening, read from the real audit log through
// `GET /v1/activity`, which projects `audit_logs` into sentences. Any module that
// writes audit already appears here (docs/124); no per-module feed is needed.

import { useMemo } from 'react';
import { useQuery } from '@wizeworks/query';
import { activityWord } from '../console/activity-words';
import { api } from './client';

export interface ActivityItem {
  id: string;
  /** ISO instant the thing happened. */
  at: string;
  /** Raw audit action, e.g. `crm.order.created` — for filtering, not display. */
  action: string;
  /** Module slug for the row's hue, or null for account-level plumbing. */
  module: string | null;
  /** The readable sentence, e.g. "Order created". Server-composed. */
  title: string;
  /** What it happened to, e.g. "Blue Shirt" or an order number. Often null. */
  subject: string | null;
  entityType: string | null;
  entityId: string | null;
  actor: {
    id: string | null;
    type: string | null;
    /** Staff display name; null when sparx or a shopper did it, not a person. */
    name: string | null;
  };
}

// Events worth INTERRUPTING someone about: money arrived, or a person did. An
// owner's own edits never toast. Matched as prefixes by /v1/activity, but written
// as whole action names so a future sibling verb cannot join by accident.
export const NOTABLE_ACTIONS = [
  // A sale, however it arrived.
  'crm.order.created',
  'commerce.checkout.completed',
  // Money actually landing, including the invoice half of the business.
  'crm.order.payment.recorded',
  'invoicing.payment.payment',
  'invoicing.payment.deposit',
  // A new person: entered by the team, or one who came in through a site form.
  'crm.customer.created',
  'crm.customer.captured',
  // Someone took a slot in the day, or gave one back. A hole in this afternoon
  // is only useful to know about this afternoon.
  'booking.created',
  'booking.cancelled',
] as const;

const FEED_POLL_MS = 60_000;

/** The endpoint's own ceiling (Query.limit max in routes/v1/activity.ts). Asking
 *  for more is a 400, so the page-size picker must never offer past it. */
export const ACTIVITY_MAX_LIMIT = 200;

interface ActivityOptions {
  /** Action prefixes to narrow to. Omit for everything. */
  actions?: readonly string[];
  limit?: number;
  /** Keyset cursor: only rows strictly OLDER than this ISO instant. A live,
   *  append-only log would shift an offset page under the reader. */
  before?: string;
  /** Narrow to one person's own trail: the ACTOR's user id, not a subject. */
  actorId?: string;
  enabled?: boolean;
}

export interface ActivityFeed {
  items: ActivityItem[];
  ready: boolean;
  /** A fetch is in flight, including a background poll over existing rows. */
  busy: boolean;
  /** Older rows almost certainly exist, inferred from a FULL window coming back;
   *  wrong only when the total is an exact multiple of the window. */
  hasMore: boolean;
  /** The read failed, so "no activity" and "could not load" are told apart. */
  failed: boolean;
  /** Why it failed, so the words name the real cause (persona issue 260). */
  error: unknown;
  /** Re-runs the window, for the failure state's retry. */
  retry: () => void;
}

function useActivityQuery(options: ActivityOptions) {
  const { actions, limit = 50, before, actorId, enabled = true } = options;
  const actionParam = actions && actions.length > 0 ? actions.join(',') : undefined;
  return useQuery({
    // Every input that changes the ANSWER is in the key, so the notable feed, the
    // full feed, each window and each teammate's trail never share a cache entry.
    queryKey: ['activity', actionParam ?? 'all', actorId ?? 'anyone', limit, before ?? 'newest'],
    queryFn: () =>
      api.get<{ items: ActivityItem[] }>('/v1/activity', {
        ...(actionParam ? { action: actionParam } : {}),
        ...(before ? { before } : {}),
        ...(actorId ? { actorId } : {}),
        limit,
      }),
    refetchInterval: FEED_POLL_MS,
    enabled,
    // Keeps the window on screen while the next one loads, so it never blinks.
    placeholderData: (previous) => previous,
  });
}

/** The activity feed. One endpoint, one poll a minute. */
export function useActivity(options: ActivityOptions = {}): ActivityFeed {
  const limit = options.limit ?? 50;
  const query = useActivityQuery(options);
  const raw = query.data?.items;
  // The one place the platform's words enter this console: the API composes the
  // sentence in sparx's vocabulary, and this brand swaps in its own here.
  const items = useMemo(
    () => raw?.map((item) => ({ ...item, title: activityWord(item.action, item.title) })),
    [raw]
  );
  const { refetch } = query;
  return useMemo(
    () => ({
      items: items ?? [],
      ready: !query.isLoading,
      busy: query.isFetching,
      hasMore: (items?.length ?? 0) >= limit,
      failed: query.isError,
      error: query.error,
      retry: () => {
        void refetch();
      },
    }),
    [items, query.isLoading, query.isFetching, query.isError, query.error, refetch, limit]
  );
}

// The fresh events worth a toast for THIS viewer: not the ones they did
// themselves (sparx persona issue 078). An unknown viewer announces everything.
export function announceable(
  fresh: ActivityItem[],
  viewerId: string | null | undefined
): ActivityItem[] {
  if (!viewerId) return fresh;
  return fresh.filter((item) => item.actor.id !== viewerId);
}

/** "2m ago" phrasing, deliberately coarse: this is a heartbeat, not a receipt. */
export function describeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${String(minutes)}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${String(hours)}h ago`;
  const days = Math.floor(hours / 24);
  return days === 1 ? 'yesterday' : `${String(days)}d ago`;
}
