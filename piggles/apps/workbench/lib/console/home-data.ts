'use client';

// The numbers on the Piggles Home surface.
//
// ── EVERY COUNT IS A REAL SERVER COUNT, OR IT IS NOT SHOWN ──────────────────
//
// A tile is a claim about somebody's business, and a wrong one is worse than a
// missing one: "3 messages" when there are none teaches them to stop believing
// the screen, and "0 late invoices" when the request failed is a lie that reads
// exactly like good news. So this module distinguishes FIVE outcomes and the
// surface renders each differently — there is deliberately no path that turns
// "we do not know" into a number:
//
//   off      the module is not on for this account — the tile does not exist
//   loading  the request is in flight — a skeleton, never a zero
//   error    the request failed — say so, do not imply nothing needs doing
//   unknown  the endpoint answered without a total — api.list documents that
//            `total` is undefined when the endpoint does not report one, and
//            that callers must treat it as unknown, NEVER as zero
//   ready    a real number, including a real zero
//
// The last two are the pair that gets collapsed by accident, and collapsing it
// is how a screen ends up cheerfully reporting that nothing is wrong.
//
// ── WHY THESE FIVE, AND WHY THESE FILTERS ───────────────────────────────────
//
// The question this surface answers is "what needs me today", not "how big is
// my business". So each count is a QUEUE — work waiting for a person — and none
// of them is a vanity total:
//
//   orders    status=placed          paid for, not yet sent
//   bookings  status=requested       somebody asked, nobody has answered
//   messages  status=open            a conversation nobody has closed
//   invoices  status=overdue         money that is late
//   stock     low_stock_only=true    about to run out
//
// Every filter value here is copied from the list surface that already uses it
// (commerce/orders-list, scheduling/bookings-data, chat/data, invoicing/
// invoice-list, inventory/data). A count on a filter the API does not recognise
// comes back as an unfiltered total — a big, confident, wrong number — so these
// must never be guessed at.
//
// `take: 1` throughout: the rows are thrown away, only `total` is wanted, and
// asking for fifty of them to display one integer is fifty rows of JSON per
// tile per poll.

import { useQuery } from '@sparx/query';
import { api } from '@/lib/api/client';
import { useReachableModules } from '@/lib/surfaces/use-visible-nav';

export type CountState = 'off' | 'loading' | 'error' | 'unknown' | 'ready';

export interface AttentionCount {
  state: CountState;
  /** Only ever set when `state` is 'ready'. */
  value?: number;
}

interface Source {
  key: string;
  /** The module that must be on for this to mean anything. */
  module: string;
  path: string;
  query: Record<string, string | number | boolean>;
}

const SOURCES = {
  orders: {
    key: 'orders',
    module: 'commerce',
    path: '/v1/orders',
    query: { status: 'placed', take: 1, skip: 0 },
  },
  bookings: {
    key: 'bookings',
    module: 'scheduling',
    path: '/v1/scheduling/bookings',
    query: { status: 'requested', take: 1, skip: 0 },
  },
  messages: {
    key: 'messages',
    module: 'chat',
    path: '/v1/chat/conversations',
    query: { status: 'open', take: 1, skip: 0 },
  },
  invoices: {
    key: 'invoices',
    module: 'invoicing',
    path: '/v1/invoicing/documents',
    query: { status: 'overdue', take: 1, skip: 0 },
  },
  stock: {
    key: 'stock',
    module: 'inventory',
    path: '/v1/inventory',
    query: { low_stock_only: true, take: 1, skip: 0 },
  },
  // `satisfies`, not a Record annotation: this keeps the KEYS literal, so
  // AttentionKey is the five real names and a typo in the surface is a compile
  // error rather than an `undefined` lookup at runtime.
} satisfies Record<string, Source>;

export type AttentionKey = keyof typeof SOURCES;

/** Re-read on the same cadence a person would glance up — often enough to be
 *  current, rare enough that five tiles are not five requests a second. */
const POLL_MS = 60_000;

function useAttentionCount(key: AttentionKey): AttentionCount {
  const source = SOURCES[key];
  const reachable = useReachableModules();
  // `null` means the activation list has not arrived. Treating that as OFF would
  // blink every tile out and back on each load; treating it as ON lets the query
  // run and the tile settle. A request against a disabled module 404s, which
  // lands in 'error' — briefly wrong in a way that self-corrects, rather than a
  // flash of empty dashboard.
  const enabled = reachable === null || reachable.has(source.module);

  const result = useQuery({
    // Not keyed to 'home' — the RAIL reads these too (components/app-rail.tsx),
    // and one shared key is what makes the badge and the tile physically
    // incapable of disagreeing: react-query dedupes them to one request.
    queryKey: ['piggles', 'attention', source.key],
    queryFn: () => api.list<unknown>(source.path, source.query),
    enabled,
    refetchInterval: POLL_MS,
    // Hold the last good number while the next one loads, so a tile does not
    // flicker back to a skeleton every minute.
    placeholderData: (previous) => previous,
  });

  if (!enabled) return { state: 'off' };
  if (result.isError) return { state: 'error' };
  if (result.isPending || !result.data) return { state: 'loading' };
  // The distinction this whole file exists for.
  if (typeof result.data.total !== 'number') return { state: 'unknown' };
  return { state: 'ready', value: result.data.total };
}

/** Every tile's count, in one call — the surface renders whichever are not 'off'. */
export function useAttention(): Record<AttentionKey, AttentionCount> {
  return {
    orders: useAttentionCount('orders'),
    bookings: useAttentionCount('bookings'),
    messages: useAttentionCount('messages'),
    invoices: useAttentionCount('invoices'),
    stock: useAttentionCount('stock'),
  };
}

/**
 * "Good morning" / "Good afternoon" / "Good evening", from the browser's own
 * clock.
 *
 * Deliberately local and deliberately not from the server: this is a greeting,
 * not a fact about the business, and the only clock that can make it feel true
 * is the one on the desk the person is sitting at.
 *
 * "Good morning" rather than the bare "Morning" it started as. The short form
 * is how a colleague greets you in passing — fine spoken, curt in print, and it
 * reads as clipped precisely where the screen is trying to be warm.
 */
export function greeting(now: Date): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/**
 * "Thursday, 14 August" — today, spelled out.
 *
 * Small, and it does real work: it is the one thing on this screen that says
 * the numbers below are about NOW. It also quietly answers a question a busy
 * person asks more often than they admit.
 *
 * Formatted with the browser's own locale rather than a hand-built string, so
 * a reader outside the UK gets their own order and their own month names for
 * free. The year is deliberately absent — nobody needs telling.
 */
export function todayLine(now: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(now);
}
