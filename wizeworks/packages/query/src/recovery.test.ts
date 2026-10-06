import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QueryObserver,
  environmentManager,
  focusManager,
  onlineManager,
  type QueryClient,
  type QueryObserverOptions,
} from '@tanstack/react-query';

import { makeQueryClient } from './query-client';

// What happened on screen (sparx persona issue 086): api-rest restarted, a quote
// pane asked for its quote, got a 503, and then sat on "Loading…" for over a
// minute after the API was answering again. ONE request in the network log, no
// retry, no error. The shell's "Reconnecting" gate did the same for minutes.
//
// The mechanism is TanStack's, not the pane's: a retry only continues while
// `focusManager.isFocused()`, which is `document.visibilityState !== 'hidden'`.
// A tab the browser reports as hidden holds every retry as `fetchStatus:
// 'paused'` with `status: 'pending'`, and a pane that branches on `isError`
// never gets its turn. These tests reproduce that with the real client the
// consoles build, by telling the focus manager what a hidden tab tells it.

/** What the API client throws for a 503: an error carrying the HTTP status. */
function httpError(status: number): Error {
  return Object.assign(new Error(`HTTP ${String(status)}`), { status });
}

/** What `fetch` throws when the service is down or a CORS preflight fails. */
function networkError(): Error {
  return new TypeError('Failed to fetch');
}

let client: QueryClient;
let stops: (() => void)[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  // The consoles run this in a browser; node is a server to TanStack unless told.
  environmentManager.setIsServer(() => false);
  client = makeQueryClient();
  // What <QueryClientProvider> does on mount: listen for focus and reconnects.
  client.mount();
});

afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  client.unmount();
  client.clear();
  focusManager.setFocused(undefined);
  onlineManager.setOnline(true);
  environmentManager.setIsServer(() => typeof window === 'undefined');
  vi.useRealTimers();
});

/** Mount one observer, as a pane does with `useQuery`, and record every status it shows. */
function watch(options: Omit<QueryObserverOptions, 'queryKey'> & { queryKey?: unknown[] }) {
  const observer = new QueryObserver(client, {
    queryKey: options.queryKey ?? ['b2b', 'quotes', '45444b29'],
    ...options,
  });
  const seen: string[] = [];
  stops.push(
    observer.subscribe((result) => {
      seen.push(`${result.status}/${result.fetchStatus}`);
    })
  );
  return { observer, seen };
}

/** A hidden tab, the way a minimized or covered browser window reports itself. */
function hideTheTab(): void {
  focusManager.setFocused(false);
}

describe('a read that failed while the API was down', () => {
  it('retries in a hidden tab instead of holding the retry, and shows the quote', async () => {
    hideTheTab();
    let calls = 0;
    const { observer } = watch({
      queryFn: () => {
        calls += 1;
        if (calls === 1) return Promise.reject(networkError());
        return Promise.resolve({ id: '45444b29', number: 'Q-1001' });
      },
    });

    await vi.advanceTimersByTimeAsync(5_000);

    expect(calls).toBe(2);
    expect(observer.getCurrentResult().status).toBe('success');
    expect(observer.getCurrentResult().fetchStatus).toBe('idle');
  });

  it('honours a pane’s own retry budget and lands on its error state, never Loading for ever', async () => {
    hideTheTab();
    let calls = 0;
    // useQuote's own policy: two retries, nothing for a 404.
    const { observer } = watch({
      queryFn: () => {
        calls += 1;
        return Promise.reject(httpError(503));
      },
      retry: (failureCount: number, error: unknown) =>
        (error as { status?: number }).status === 404 ? false : failureCount < 2,
    });

    let callsWhenTheErrorShowed: number | undefined;
    stops.push(
      observer.subscribe((result) => {
        if (result.status === 'error') callsWhenTheErrorShowed ??= calls;
      })
    );

    await vi.advanceTimersByTimeAsync(10_000);

    // Three tries, exactly what a visible tab makes: the budget is not reset by
    // the hidden tab, and it is not stretched either. (The background probe asks
    // again after that, which is a different test.)
    expect(callsWhenTheErrorShowed).toBe(3);
    expect(observer.getCurrentResult().status).toBe('error');
    expect(observer.getCurrentResult().fetchStatus).toBe('idle');
  });

  it('keeps the backoff a hidden tab was owed, not a burst of instant retries', async () => {
    hideTheTab();
    let calls = 0;
    watch({
      queryFn: () => {
        calls += 1;
        return Promise.reject(httpError(503));
      },
      retry: () => true,
      retryDelay: (failures: number) => Math.min(1000 * 2 ** failures, 5000),
    });

    // Delays owed: 1s, 2s, 4s, 5s, 5s. Ten seconds is room for the first four
    // attempts (0, 1, 3, 7) and no more.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(calls).toBe(4);
  });
});

describe('the shell’s onboarding read (retries a blip until it clears)', () => {
  it('clears once the read succeeds, even in a hidden tab', async () => {
    hideTheTab();
    let calls = 0;
    const { observer } = watch({
      queryKey: ['tenant', 'onboarding'],
      queryFn: () => {
        calls += 1;
        if (calls <= 4) return Promise.reject(httpError(503));
        return Promise.resolve({ finishedAt: '2026-10-01T00:00:00Z' });
      },
      // lib/onboarding/reads.ts: a blip is retried until it clears.
      retry: (failures: number, error: unknown) =>
        ((error as { status?: number }).status ?? 500) >= 500 || failures < 3,
      retryDelay: (failures: number) => Math.min(1000 * 2 ** failures, 5000),
    });

    await vi.advanceTimersByTimeAsync(30_000);

    expect(calls).toBe(5);
    expect(observer.getCurrentResult().status).toBe('success');
  });

  it('keeps saying it is reconnecting while it retries (the failure count never drops to zero)', async () => {
    hideTheTab();
    let calls = 0;
    const counts: number[] = [];
    const { observer } = watch({
      queryKey: ['tenant', 'onboarding'],
      queryFn: () => {
        calls += 1;
        return calls <= 3 ? Promise.reject(httpError(503)) : Promise.resolve({ ok: true });
      },
      retry: () => true,
      retryDelay: 1000,
    });
    stops.push(
      observer.subscribe((result) => {
        if (result.status === 'pending') counts.push(result.failureCount);
      })
    );

    await vi.advanceTimersByTimeAsync(10_000);

    expect(observer.getCurrentResult().status).toBe('success');
    // The first entry is the very first attempt, before anything has failed.
    expect(counts.slice(counts.findIndex((n) => n > 0)).every((n) => n > 0)).toBe(true);
  });
});

describe('a pane already showing its error', () => {
  it('recovers on its own once the API answers, without flashing back to Loading', async () => {
    let calls = 0;
    let apiUp = false;
    const { observer, seen } = watch({
      queryFn: () => {
        calls += 1;
        return apiUp ? Promise.resolve({ id: '45444b29' }) : Promise.reject(httpError(503));
      },
      retry: (failureCount: number) => failureCount < 2,
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(observer.getCurrentResult().status).toBe('error');
    const firstError = seen.indexOf('error/idle');

    // The API restart takes most of a minute.
    await vi.advanceTimersByTimeAsync(40_000);
    expect(observer.getCurrentResult().status).toBe('error');
    apiUp = true;
    await vi.advanceTimersByTimeAsync(20_000);

    expect(observer.getCurrentResult().status).toBe('success');
    // Once the error showed, it stayed until the quote replaced it.
    expect(seen.slice(firstError).some((s) => s.startsWith('pending'))).toBe(false);
    expect(calls).toBeGreaterThan(3);
  });

  it('recovers in a hidden tab too', async () => {
    hideTheTab();
    let apiUp = false;
    const { observer } = watch({
      queryFn: () => (apiUp ? Promise.resolve({ id: 'x' }) : Promise.reject(networkError())),
      retry: (failureCount: number) => failureCount < 2,
    });

    await vi.advanceTimersByTimeAsync(10_000);
    expect(observer.getCurrentResult().status).toBe('error');
    apiUp = true;
    await vi.advanceTimersByTimeAsync(20_000);
    expect(observer.getCurrentResult().status).toBe('success');
  });

  it('does not keep asking about something that does not exist', async () => {
    let calls = 0;
    const { observer } = watch({
      queryFn: () => {
        calls += 1;
        return Promise.reject(httpError(404));
      },
    });

    await vi.advanceTimersByTimeAsync(120_000);
    expect(observer.getCurrentResult().status).toBe('error');
    expect(calls).toBe(1);
  });

  it('stops asking after ten minutes and leaves Try again to the person', async () => {
    let calls = 0;
    watch({
      queryFn: () => {
        calls += 1;
        return Promise.reject(httpError(503));
      },
      retry: false,
    });

    await vi.advanceTimersByTimeAsync(11 * 60_000);
    const afterTenMinutes = calls;
    expect(afterTenMinutes).toBeGreaterThan(5);
    expect(afterTenMinutes).toBeLessThan(60);

    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(calls).toBe(afterTenMinutes);
  });

  it('stops asking once nothing is showing the read', async () => {
    let calls = 0;
    watch({
      queryFn: () => {
        calls += 1;
        return Promise.reject(httpError(503));
      },
      retry: false,
    });

    await vi.advanceTimersByTimeAsync(1_000);
    for (const stop of stops) stop();
    stops = [];
    const whenClosed = calls;
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(calls).toBe(whenClosed);
  });
});

describe('a browser that really is offline', () => {
  it('still waits for the connection, as TanStack intends, and resumes on reconnect', async () => {
    onlineManager.setOnline(false);
    let calls = 0;
    const { observer } = watch({
      queryFn: () => {
        calls += 1;
        return Promise.resolve({ id: 'x' });
      },
    });

    await vi.advanceTimersByTimeAsync(5_000);
    expect(calls).toBe(0);
    expect(observer.getCurrentResult().fetchStatus).toBe('paused');

    onlineManager.setOnline(true);
    await vi.advanceTimersByTimeAsync(1_000);
    expect(calls).toBe(1);
    expect(observer.getCurrentResult().status).toBe('success');
  });
});
