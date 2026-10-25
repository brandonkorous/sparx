import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  QueryObserver,
  environmentManager,
  focusManager,
  type QueryClient,
} from '@tanstack/react-query';

import { makeQueryClient } from './query-client';

// PG-7: during an api-rest brownout each open Piggles console kept ~12 pollers
// going, and every failed poll retried twice, so the API that was already failing
// got three requests per poller per interval. The breaker cuts that to one probe.

function unavailable(retryAfterSeconds?: number): Error {
  return Object.assign(new Error('HTTP 503'), { status: 503, retryAfterSeconds });
}

let client: QueryClient;
let stops: (() => void)[] = [];

beforeEach(() => {
  vi.useFakeTimers();
  environmentManager.setIsServer(() => false);
  client = makeQueryClient();
  client.mount();
});

afterEach(() => {
  for (const stop of stops) stop();
  stops = [];
  client.unmount();
  client.clear();
  focusManager.setFocused(undefined);
  environmentManager.setIsServer(() => typeof window === 'undefined');
  vi.useRealTimers();
});

function poll(key: string, queryFn: () => Promise<unknown>, refetchInterval = 5_000) {
  const observer = new QueryObserver(client, { queryKey: [key], queryFn, refetchInterval });
  stops.push(observer.subscribe(() => undefined));
}

describe('the API breaker', () => {
  it('turns 12 failing pollers into at most one probe per wait', async () => {
    let calls = 0;
    let apiUp = false;
    const queryFn = () => {
      calls += 1;
      return apiUp ? Promise.resolve({ ok: true }) : Promise.reject(unavailable());
    };
    for (let i = 0; i < 12; i++) poll(`poller-${String(i)}`, queryFn);

    await vi.advanceTimersByTimeAsync(30_000);
    const before = calls;
    await vi.advanceTimersByTimeAsync(60_000);
    // Probe waits run 2/4/8/15 s with ±20% jitter; 60 s holds at most six of them.
    expect(calls - before).toBeLessThanOrEqual(6);

    apiUp = true;
    await vi.advanceTimersByTimeAsync(20_000);
    const recovered = calls;
    await vi.advanceTimersByTimeAsync(10_000);
    // Closed again: the pollers are back on their own interval.
    expect(calls - recovered).toBeGreaterThanOrEqual(12);
  });

  it('waits at least as long as the server’s Retry-After before probing', async () => {
    let calls = 0;
    const observer = new QueryObserver(client, {
      queryKey: ['retry-after'],
      retry: false,
      queryFn: () => {
        calls += 1;
        return Promise.reject(unavailable(30));
      },
    });
    stops.push(observer.subscribe(() => undefined));

    await vi.advanceTimersByTimeAsync(29_000);
    expect(calls).toBe(1);
    await vi.advanceTimersByTimeAsync(2_000);
    expect(calls).toBe(2);
  });
});
