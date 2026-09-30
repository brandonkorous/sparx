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
// ── WHY THESE, AND WHY THESE FILTERS ────────────────────────────────────────
//
// The question this answers is "what needs me today", not "how big is my
// business". So each count is a QUEUE — work waiting for a person — and none of
// them is a vanity total:
//
//   orders     status=placed            paid for, not yet sent
//   bookings   status=requested         somebody asked, nobody has answered
//   messages   status=open              a conversation nobody has closed
//   invoices   pastDue=true             money that is late
//   stock      low_stock_only + sellable_only   about to run out, still buyable
//   outOfStock out_of_stock_only=true           already run out — cannot be bought
//   social     open replies             a question on a social account
//   approvals  status=pending_approval  a post waiting on an admin
//
// Every filter value here is copied from the list surface that already uses it.
// A count on a filter the API does not recognise comes back as an unfiltered
// total — a big, confident, wrong number — so these must never be guessed at.
//
// `take: 1` on the paged ones: the rows are thrown away, only `total` is wanted,
// and asking for fifty of them to display one integer is fifty rows of JSON per
// poll.
//
// ── THIS IS THE ONE PLACE A "WAITING" COUNT LIVES ───────────────────────────
//
// Home's tiles, the app rail, its group headings and the nav panel all read from
// here. That is not tidiness: `social` and `approvals` used to be per-surface
// hooks wired straight onto their nav rows, so the panel could show four waiting
// while the rail above it showed nothing — the same question with two answers on
// one screen. A count is measured once, and every level that shows it derives
// from that (COUNT_SURFACE in home-counts, then components/rail/waiting.tsx).
//
// Which counts appear as HOME TILES is a separate, smaller list — `SIGNALS` in
// surfaces/home.tsx — because a tile needs a written sentence and a greeting has
// room for a handful, not for everything measured.

import { useQuery } from '@wizeworks/query';
import { api } from '@/lib/api/client';
import { useReachableModules } from '@/lib/surfaces/use-visible-nav';

export type CountState = 'off' | 'loading' | 'error' | 'unknown' | 'ready';

export interface AttentionCount {
  state: CountState;
  /** Only ever set when `state` is 'ready'. */
  value?: number;
}

import { SOURCES, type AttentionKey, type Source } from './home-counts';

// Re-exported: every existing importer asks `home-data` for these, and the
// split above is about where they can be TESTED, not about who may read them.
export { COUNT_SURFACE, SOURCES } from './home-counts';
export type { AttentionKey, Source } from './home-counts';

/** Re-read on the same cadence a person would glance up — often enough to be
 *  current, rare enough that five tiles are not five requests a second. */
const POLL_MS = 60_000;

function useAttentionCount(key: AttentionKey): AttentionCount {
  // Widened to `Source` deliberately. `satisfies` keeps each entry's literal
  // type, which is what makes AttentionKey exact — but it also means an entry
  // without `read` has no such property to test, so the lookup is read through
  // the interface that declares it optional.
  const source: Source = SOURCES[key];
  const reachable = useReachableModules();
  // `null` means the activation list has not arrived. Treating that as OFF would
  // blink every tile out and back on each load; treating it as ON lets the query
  // run and the tile settle. A request against a disabled module 404s, which
  // lands in 'error' — briefly wrong in a way that self-corrects, rather than a
  // flash of empty dashboard.
  const enabled = reachable === null || reachable.has(source.module);

  const result = useQuery({
    // Not keyed to 'home' — the RAIL and the app PANEL read these too, and one
    // shared key is what makes the tile, the app badge and the screen's own
    // badge physically incapable of disagreeing: react-query dedupes them to
    // one request.
    queryKey: ['piggles', 'attention', source.key],
    queryFn: () =>
      source.read
        ? api.get<unknown>(source.path, source.query)
        : api.list<unknown>(source.path, source.query),
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
  const value = source.read ? source.read(result.data) : (result.data as { total?: unknown }).total;
  if (typeof value !== 'number') return { state: 'unknown' };
  return { state: 'ready', value };
}

/** Every tile's count, in one call — the surface renders whichever are not 'off'. */
export function useAttention(): Record<AttentionKey, AttentionCount> {
  return {
    orders: useAttentionCount('orders'),
    bookings: useAttentionCount('bookings'),
    messages: useAttentionCount('messages'),
    invoices: useAttentionCount('invoices'),
    formReplies: useAttentionCount('formReplies'),
    stock: useAttentionCount('stock'),
    outOfStock: useAttentionCount('outOfStock'),
    social: useAttentionCount('social'),
    approvals: useAttentionCount('approvals'),
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
