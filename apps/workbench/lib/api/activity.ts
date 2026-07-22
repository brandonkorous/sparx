// Activity — what has been happening, read from the real audit log.
//
// This replaced a poll-and-merge "pulse" that hit `/v1/orders` and
// `/v1/crm/customers` and diffed the newest few rows. That approach
// reimplemented, shallowly and for exactly two entity types, a log the platform
// already writes from ~337 sites across every module (docs/124). It could never
// see a published page, a price change, or a refund, and every new module would
// have needed another feed bolted on.
//
// Now there is one source: `GET /v1/activity`, which projects `audit_logs` into
// sentences. Adding a module to the feed is now zero work — it already writes
// audit, so it already appears.

import { useMemo } from 'react';
import { useQuery } from '@sparx/query';
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

/**
 * Events worth INTERRUPTING someone about — things that happen *to* the
 * business rather than things an operator did. The status bar celebrates these;
 * the full feed shows everything.
 *
 * The test each entry has to pass: **money arrived, or a person did**. Those are
 * the two things an owner wants pulled out of a working day; everything else is
 * either their own edit or something they will look for when they are ready.
 *
 * Toasting "Product updated" would fire every time the viewer saves their own
 * work, which is the fastest way to teach someone to ignore the popup entirely —
 * so this list stays disciplined even as modules are added. Matched as PREFIXES
 * by /v1/activity, but written as whole action names so a future sibling verb
 * can't join by accident.
 *
 * Deliberately NOT here, and why:
 *   • `invoicing.payment.refund`, `commerce.return.refunded` — money OUT, and
 *     the operator's own act. They know; they just did it.
 *   • `commerce.cart.abandoned` — fires constantly on a live store, is negative,
 *     and there is nothing to do about any single one.
 *   • `commerce.review.submitted`, `commerce.question.submitted` — genuinely
 *     customer-initiated and arguably belong, but on a busy catalogue they would
 *     out-shout the sales. Worth revisiting as a separate, quieter signal.
 *   • `crm.deal.*` — pipeline movement is the operator dragging their own cards.
 *   • `booking.confirmed` / `checked_in` / `completed` / `no_show` — the staff
 *     working through their own day. The timeline on the booking has them.
 *
 * Scheduling writes its audit trail from the SERVICE, not the route —
 * `recordBookingEvent` in packages/scheduling/src/booking-history.ts, which is
 * also what feeds GET /v1/scheduling/bookings/:id/timeline. The Pub/Sub publish
 * beside it (publishBookingEvent) is a separate channel for the worker; do not
 * add audit writes at the call sites, they are already there.
 */
export const NOTABLE_ACTIONS = [
  // A sale, however it arrived.
  'crm.order.created',
  'commerce.checkout.completed',
  // Money actually landing — the invoice half of the business, which had no
  // representation here at all despite being where service work gets paid.
  'crm.order.payment.recorded',
  'invoicing.payment.payment',
  'invoicing.payment.deposit',
  // A new person: entered by the team, or one who arrived through a form on the
  // site by themselves (`captured` is written with actorType 'system').
  'crm.customer.created',
  'crm.customer.captured',
  // Someone took a slot in the day, or gave one back. A cancellation is the one
  // entry here that is not good news, and it earns its place by being the most
  // time-critical thing on the list: a hole in this afternoon is only useful to
  // know about this afternoon.
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
  /**
   * Keyset cursor — return only rows strictly OLDER than this ISO instant.
   * Undefined means the newest window.
   *
   * Keyset rather than an offset because the log is append-only and live: with
   * `skip`, every row that arrives while someone reads page 1 pushes a row they
   * already saw down onto page 2. A timestamp cursor is stable no matter how
   * much lands above it.
   */
  before?: string;
  /**
   * Narrow to one person's own trail — everything THEY did, nothing anyone
   * else did. The endpoint has always supported it; nothing asked until a
   * teammate's page needed to answer "what has this person been doing here?".
   *
   * Note it is the ACTOR's user id, not a subject: this is the audit trail of
   * their actions, not of changes made to them.
   */
  actorId?: string;
  enabled?: boolean;
}

/**
 * The activity feed. One endpoint, one poll — a minute of latency is invisible
 * for events that arrive a handful of times a day, and it costs no socket kept
 * alive across detached windows.
 */
export function useActivity(options: ActivityOptions = {}): {
  items: ActivityItem[];
  ready: boolean;
  /** A fetch is in flight — including a background poll over existing rows. */
  busy: boolean;
  /**
   * Whether older rows almost certainly exist, inferred from a FULL window
   * coming back. It can be wrong exactly once, when the log's total is an exact
   * multiple of the window: the reader steps older and finds an empty page.
   * The alternative is a count() over audit_logs on every poll, which is a real
   * cost on a table every module writes to — a rare empty page is the cheaper
   * error, and it self-corrects the moment they step back.
   */
  hasMore: boolean;
} {
  const { actions, limit = 50, before, actorId, enabled = true } = options;
  const actionParam = actions && actions.length > 0 ? actions.join(',') : undefined;

  const query = useQuery({
    // Every input that changes the ANSWER is part of the key: the status bar's
    // notable-only feed and the Pulse pane's everything feed are different
    // questions and must not share a cache entry. The cursor joins it for the
    // same reason — each window is its own answer, so stepping back to one
    // already read is instant. And the actor joins it because a teammate's feed
    // is the narrowest question of all: leaving it out would let one person's
    // trail be served from the account-wide cache entry, or overwrite it.
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
    // Keeps the window on screen while the next one loads, so stepping through
    // time doesn't blink the feed out to empty and back.
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

/** "2m ago" phrasing — deliberately coarse; this is a heartbeat, not a receipt. */
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
