import {
  onlineManager,
  type Query,
  type QueryClient,
  type QueryCacheNotifyEvent,
  type QueryFunctionContext,
} from '@tanstack/react-query';

// Keeps a failed read moving until it has an answer, for every query on a
// client, so no pane has to.
//
// ── THE SHAPE THIS EXISTS FOR (sparx persona issue 086) ─────────────────────
//
// api-rest restarted. A quote pane asked for its quote and got a 503. The
// network log showed ONE request and no retry, and more than a minute after the
// API was answering again the pane still said "Loading…". The shell's
// "Reconnecting" gate did the same for minutes, until a reload.
//
// Neither the pane nor the gate was wrong. TanStack's retryer only makes a retry
// while `focusManager.isFocused()`, which is `document.visibilityState !==
// 'hidden'`; otherwise it holds the retry as `fetchStatus: 'paused'` until the
// page becomes visible again. For a read with no data yet, a held retry IS
// `status: 'pending'`, so `isError` never arrives and every pane in the platform
// shows its waiting state for as long as the browser says the tab is hidden. A
// covered or minimized window says exactly that while a person, or a test
// driving the browser, is looking at it. So does a background tab during a
// deploy: a failed read there waits for the tab, not for the API.
//
// `networkMode` cannot fix it (it governs the online check, never the focus
// check), and reporting the tab as always focused would make every
// `refetchInterval` poll in every background tab, which is a real cost. So this
// does two narrow things instead:
//
//   1. A retry held ONLY because the page is hidden is made anyway, on the
//      schedule the query's own policy set, with the budget that policy had left.
//      A query that retries three times still retries three times and then shows
//      its error; one that retries a blip until it clears keeps going. A browser
//      that is really offline is left alone: TanStack resumes those itself when
//      the connection comes back, which is the case the pause exists for.
//
//   2. A read that ended in a failure that might pass (no answer at all, a 5xx,
//      408 or 429) is asked again in the background while something still shows
//      it, on a backoff, for up to ten minutes. The pane keeps its error and its
//      Try again throughout, and the answer replaces the error when it comes. The
//      probe calls the query's own function rather than refetching, because a
//      refetch of a read with no data flips it back to `pending`, and a pane that
//      blinked from its error to "Loading…" every few seconds would be worse than
//      one that waited.

/** The HTTP status behind a rejection, when there is one. Read structurally so
 *  this package depends on no API client: `status: number` is the contract. */
export function httpStatus(error: unknown): number | null {
  if (typeof error !== 'object' || error === null || !('status' in error)) return null;
  return typeof error.status === 'number' ? error.status : null;
}

/**
 * Whether asking again could get a different answer.
 *
 * A 4xx was refused for a reason that is still true a second later, except 408
 * and 429, which change on their own. A 5xx is the server failing or busy. An
 * error with no status never got an answer at all: the service was down, or a
 * CORS preflight failed, which reaches `fetch` as a TypeError.
 */
export function mightSucceedLater(error: unknown): boolean {
  const status = httpStatus(error);
  if (status === null) return true;
  if (status === 408 || status === 429) return true;
  return status >= 500;
}

type RetryOption = boolean | number | ((failureCount: number, error: unknown) => boolean);
type RetryDelayOption = number | ((failureCount: number, error: unknown) => number);

/** TanStack's own reading of a `retry` option, including its client default of 3. */
function retryWanted(retry: RetryOption | undefined, failures: number, error: unknown): boolean {
  if (typeof retry === 'function') return retry(failures, error);
  if (typeof retry === 'number') return failures < retry;
  if (retry === undefined) return failures < 3;
  return retry;
}

/** TanStack's own reading of a `retryDelay` option, including its default backoff. */
function retryDelayFor(
  delay: RetryDelayOption | undefined,
  failures: number,
  error: unknown
): number {
  if (typeof delay === 'function') return delay(failures, error);
  if (typeof delay === 'number') return delay;
  return Math.min(1000 * 2 ** failures, 30_000);
}

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
export function keepFailedReadsMoving(client: QueryClient): () => void {
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
    const wait = PROBE_DELAYS_MS[Math.min(step, PROBE_DELAYS_MS.length - 1)];
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
