import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSwrCache } from './swr-cache.js';

// PG-2.3: every 60 s a visitor to the Piggles pricing page waited ~1.9 s on Stripe.

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const cache = () => createSwrCache<number>({ freshMs: 60_000, maxStaleMs: 3_600_000 });

describe('createSwrCache', () => {
  it('serves a fresh value without loading again', async () => {
    const c = cache();
    const load = vi.fn(() => Promise.resolve(1));
    await c.get('k', load);
    expect(await c.get('k', load)).toBe(1);
    expect(load).toHaveBeenCalledOnce();
  });

  it('serves a stale value at once and refreshes it in the background', async () => {
    const c = cache();
    await c.get('k', () => Promise.resolve(1));
    vi.advanceTimersByTime(61_000);
    let resolve!: (n: number) => void;
    const slow = vi.fn(() => new Promise<number>((r) => (resolve = r)));
    expect(await c.get('k', slow)).toBe(1);
    expect(slow).toHaveBeenCalledOnce();
    resolve(2);
    await Promise.resolve();
    await Promise.resolve();
    expect(await c.get('k', slow)).toBe(2);
  });

  it('keeps the stale value when the refresh fails', async () => {
    const onRefreshError = vi.fn();
    const c = createSwrCache<number>({ freshMs: 60_000, maxStaleMs: 3_600_000, onRefreshError });
    await c.get('k', () => Promise.resolve(1));
    vi.advanceTimersByTime(61_000);
    expect(await c.get('k', () => Promise.reject(new Error('stripe down')))).toBe(1);
    await vi.waitFor(() => expect(onRefreshError).toHaveBeenCalled());
  });

  it('waits for the load once a value is too old to serve', async () => {
    const c = cache();
    await c.get('k', () => Promise.resolve(1));
    vi.advanceTimersByTime(3_600_001);
    expect(await c.get('k', () => Promise.resolve(3))).toBe(3);
  });
});
