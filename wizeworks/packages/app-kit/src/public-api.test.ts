import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  orWhenUnavailable,
  PublicApiUnavailableError,
  readPublicApi,
  readPublicData,
} from './public-api';

// The 404 this exists for: api-rest refused connections for a moment and a live
// listing answered "not found". These hold the line between "api-rest said no"
// and "api-rest did not answer", and the retries in between.

const URL = 'http://api-rest:3000/v1/public/marketplace/themes/academy';

function refused(): Error {
  return Object.assign(new TypeError('fetch failed'), { cause: { code: 'ECONNREFUSED' } });
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

/** A fetch that plays back `answers` in order: a Response, or an Error to throw. */
function playback(...answers: (Response | Error)[]) {
  const fetchImpl = vi.fn((_url: string, _init?: RequestInit): Promise<Response> => {
    const next = answers.shift();
    if (!next) return Promise.reject(new Error('no more answers'));
    return next instanceof Error ? Promise.reject(next) : Promise.resolve(next);
  });
  const sleep = vi.fn((_ms: number) => Promise.resolve());
  return { fetchImpl: fetchImpl as unknown as typeof fetch, calls: fetchImpl, sleep };
}

describe('readPublicApi', () => {
  it('rides out two refused connections and returns the data', async () => {
    const { fetchImpl, calls, sleep } = playback(
      refused(),
      refused(),
      json(200, { success: true, data: { slug: 'academy' } })
    );
    const result = await readPublicApi(URL, { revalidate: 300, fetchImpl, sleep });
    expect(result).toEqual({ ok: true, data: { slug: 'academy' } });
    expect(calls).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls).toEqual([[250], [750]]);
  });

  it('calls a 404 not-found, without retrying', async () => {
    const { fetchImpl, calls, sleep } = playback(json(404, { success: false }));
    const result = await readPublicApi(URL, { revalidate: 300, fetchImpl, sleep });
    expect(result).toEqual({ ok: false, reason: 'not-found' });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('calls three failures unavailable, never not-found', async () => {
    const { fetchImpl, calls, sleep } = playback(refused(), json(503, {}), refused());
    const result = await readPublicApi(URL, { revalidate: 300, fetchImpl, sleep });
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(calls).toHaveBeenCalledTimes(3);
  });

  it('does not retry a timeout', async () => {
    const timeout = new DOMException('The operation timed out.', 'TimeoutError');
    const { fetchImpl, calls, sleep } = playback(timeout);
    const result = await readPublicApi(URL, { revalidate: 300, fetchImpl, sleep });
    expect(result).toEqual({ ok: false, reason: 'unavailable' });
    expect(calls).toHaveBeenCalledTimes(1);
  });

  it('calls a 500 unavailable and a refused envelope not-found', async () => {
    const down = playback(json(500, {}));
    expect(await readPublicApi(URL, { revalidate: 300, ...down })).toEqual({
      ok: false,
      reason: 'unavailable',
    });
    const no = playback(json(200, { success: false, data: null }));
    expect(await readPublicApi(URL, { revalidate: 300, ...no })).toEqual({
      ok: false,
      reason: 'not-found',
    });
  });

  it("passes Next's cache window and a time limit to fetch", async () => {
    const { fetchImpl, calls, sleep } = playback(json(200, { success: true, data: 1 }));
    await readPublicApi(URL, { revalidate: 300, fetchImpl, sleep });
    const init = calls.mock.calls[0]?.[1] as { next?: unknown; signal?: unknown };
    expect(init.next).toEqual({ revalidate: 300 });
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });
});

describe('readPublicData', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('returns null for not-found, so the page can 404', async () => {
    const opts = { revalidate: 300, ...playback(json(404, { success: false })) };
    expect(await readPublicData(URL, opts)).toBeNull();
  });

  it('throws when api-rest is unreachable, so the last good page is kept', async () => {
    const opts = { revalidate: 300, ...playback(refused(), refused(), refused()) };
    await expect(readPublicData(URL, opts)).rejects.toBeInstanceOf(PublicApiUnavailableError);
  });

  it('returns null instead during next build, which must not fail on it', async () => {
    vi.stubEnv('NEXT_PHASE', 'phase-production-build');
    const opts = { revalidate: 300, ...playback(refused(), refused(), refused()) };
    expect(await readPublicData(URL, opts)).toBeNull();
  });
});

describe('orWhenUnavailable', () => {
  it('turns only the unavailable throw into the fallback', async () => {
    const down = Promise.reject(new PublicApiUnavailableError(URL));
    expect(await orWhenUnavailable(down, 'later')).toBe('later');
    await expect(orWhenUnavailable(Promise.reject(new Error('bug')), 'later')).rejects.toThrow(
      'bug'
    );
  });
});
