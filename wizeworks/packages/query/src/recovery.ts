import {
  onlineManager,
  type Query,
  type QueryClient,
  type QueryCacheNotifyEvent,
  type QueryFunctionContext,
} from '@tanstack/react-query';

import { ApiBreaker } from './api-breaker';
import {
  mightSucceedLater,
  retryDelayFor,
  retryWanted,
  type RetryDelayOption,
  type RetryOption,
} from './retry-policy';

export { httpStatus, mightSucceedLater } from './retry-policy';

// Keeps a failed read moving until it has an answer, for every query on a client,
// so no pane has to (sparx persona issue 086: a 503 left panes on "Loading…" after
// the API was back). TanStack holds a retry as `paused` while the tab is hidden,
// and a held retry with no data is `pending` for ever. Two narrow fixes:
//   1. A retry held ONLY because the page is hidden is made anyway, with the
//      query's own budget and backoff; a really offline browser is left alone.
//   2. A read that ended on a failure that might pass is asked again in the
//      background, one read per wait, for up to ten minutes, by calling its own
//      function, so the pane keeps its error until the answer replaces it.

/** Waits between background probes of a failed read. The last one repeats. */
const PROBE_DELAYS_MS = [2_000, 4_000, 8_000, 15_000] as const;
/** After this long the read is left on its error and its Try again. */
const GIVE_UP_AFTER_MS = 10 * 60_000;

function isInfinite(query: Query): boolean {
  return typeof (query.options as { getNextPageParam?: unknown }).getNextPageParam === 'function';
}

/**
 * Installs both behaviours on a client. Returns the uninstaller.
 *
 * Browser only: on a server there is no hidden page to hold a retry, and a
 * background probe would outlive the request that made the client.
 */
export function keepFailedReadsMoving(
  client: QueryClient,
  breaker: ApiBreaker = new ApiBreaker()
): () => void {
  const cache = client.getQueryCache();

  // ── 1. Retries held by a hidden page ──────────────────────────────────────

  /** Failures already spent by the fetches this replaced, per query. */
  const spent = new WeakMap<Query, number>();
  /** The query whose replacement fetch is starting, so its own `fetch` action
   *  is not mistaken for a new read that resets the count. */
  let replacing: Query | undefined;

  function makeHeldRetry(query: Query): void {
    // Still held, and held by the page rather than by a lost connection.
    if (query.state.fetchStatus !== 'paused' || !onlineManager.isOnline()) return;

    const own = query.options;
    const retry = own.retry as RetryOption | undefined;
    const retryDelay = own.retryDelay as RetryDelayOption | undefined;
    const failures = (spent.get(query) ?? 0) + query.state.fetchFailureCount;

    // A silent cancel is TanStack's own way of replacing a fetch: whoever was
    // awaiting the held one is handed the replacement's result.
    void query.cancel({ silent: true });
    // Still the same read, still failing so far: a screen that says
    // "reconnecting" once something has failed keeps saying it, with no blink
    // back to a first attempt in between.
    query.setState({ fetchStatus: 'fetching', fetchFailureCount: failures });
    replacing = query;
    try {
      void query
        .fetch(
          {
            ...own,
            // Counted from where the held fetch left off, so the budget and the
            // backoff are the ones the query's own policy set, not a fresh start.
            retry: (n: number, error: unknown) => retryWanted(retry, failures + n, error),
            retryDelay: (n: number, error: unknown) =>
              retryDelayFor(retryDelay, failures + n, error),
          },
          // The same fetch meta tells TanStack this continues the read already
          // under way rather than starting another, so it does not reset the
          // read's progress.
          { meta: query.state.fetchMeta } as Parameters<Query['fetch']>[1]
        )
        .catch(() => undefined);
    } finally {
      replacing = undefined;
    }
    // The replacement captured its policy when it started; the query keeps its own.
    query.setOptions(own);
    spent.set(query, failures);
  }

  // ── 2. Reads that ended on a failure that might pass ──────────────────────

  let probeTimer: ReturnType<typeof setTimeout> | undefined;
  let probing = false;
  let episodeStartedAt: number | undefined;
  let step = 0;
  let turn = 0;

  function stuckReads(): Query[] {
    return cache.findAll({
      type: 'active',
      predicate: (query) =>
        query.state.status === 'error' &&
        query.state.fetchStatus === 'idle' &&
        mightSucceedLater(query.state.error),
    });
  }

  function endEpisode(): void {
    if (probeTimer !== undefined) clearTimeout(probeTimer);
    probeTimer = undefined;
    episodeStartedAt = undefined;
    step = 0;
  }

  function scheduleProbe(): void {
    if (probeTimer !== undefined || probing) return;
    episodeStartedAt ??= Date.now();
    // Jittered and never sooner than the server's Retry-After (PG-7).
    const base = PROBE_DELAYS_MS[Math.min(step, PROBE_DELAYS_MS.length - 1)] ?? 15_000;
    const wait = breaker.probeDelay(base);
    probeTimer = setTimeout(() => {
      probeTimer = undefined;
      void probe();
    }, wait);
  }

  /** Asks once, outside the query's state, and hands over the answer if there is one. */
  async function askAgain(query: Query): Promise<boolean> {
    const queryFn = query.options.queryFn;
    if (typeof queryFn !== 'function' || isInfinite(query)) {
      // No function of its own to call (or pages to keep in step): a refetch is
      // the only honest way to ask, flicker and all.
      await query.fetch().catch(() => undefined);
      return query.state.status === 'success';
    }
    try {
      const context = {
        client,
        queryKey: query.queryKey,
        meta: query.meta,
        signal: new AbortController().signal,
      } as QueryFunctionContext;
      const data: unknown = await queryFn(context);
      if (data === undefined) return false;
      // A fetch someone started meanwhile (a Try again) will answer for itself.
      if (query.state.fetchStatus === 'idle') query.setData(data);
      return true;
    } catch {
      return false;
    }
  }

  async function probe(): Promise<void> {
    const stuck = stuckReads();
    const startedAt = episodeStartedAt ?? Date.now();
    if (stuck.length === 0 || Date.now() - startedAt >= GIVE_UP_AFTER_MS) {
      endEpisode();
      return;
    }

    probing = true;
    try {
      // One read per probe, taking turns, so a single broken endpoint cannot
      // hide the others and an outage costs one request per wait, not one per pane.
      const target = stuck[turn % stuck.length];
      turn += 1;
      step += 1;
      if (target && (await askAgain(target))) {
        // The API answers again: everything else waiting on it can ask now.
        step = 0;
        await Promise.all(stuckReads().map((query) => askAgain(query)));
      }
    } finally {
      probing = false;
    }

    if (stuckReads().length > 0) scheduleProbe();
    else endEpisode();
  }

  // ── Wiring ────────────────────────────────────────────────────────────────

  const unsubscribe = cache.subscribe((event: QueryCacheNotifyEvent) => {
    if (event.type !== 'updated') return;
    // The cache types its events over `Query<any, …>`; everything here reads it
    // as the plain `Query` it is.
    const query: Query = event.query as Query;
    const { action } = event;
    switch (action.type) {
      case 'pause':
        // Out of the dispatch that announced it, so the replacement never
        // re-enters the query mid-update.
        queueMicrotask(() => {
          makeHeldRetry(query);
        });
        return;
      case 'fetch':
        if (replacing !== query) spent.delete(query);
        return;
      case 'success':
        spent.delete(query);
        return;
      case 'error':
        spent.delete(query);
        if (query.isActive() && mightSucceedLater(action.error)) scheduleProbe();
        return;
      default:
        return;
    }
  });

  return () => {
    unsubscribe();
    endEpisode();
  };
}
