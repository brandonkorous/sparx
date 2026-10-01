import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { GoogleBusinessAdapter } from './google-business.js';
import { LinkedInAdapter } from './linkedin.js';
import { PinterestAdapter } from './pinterest.js';
import { ThreadsAdapter } from './threads.js';
import { TikTokAdapter } from './tiktok.js';
import { YouTubeAdapter } from './youtube.js';
import { HttpError, isRetryableError } from './_http.js';
import type { SocialAdapter } from '../types.js';

// A refused token refresh must read as PERMANENT, and a platform outage as transient.
//
// These six adapters threw a bare Error on any not-ok response, and isRetryableError
// calls every bare Error transient. So Pinterest answering `401 invalid_grant` to a
// refresh read as "the platform blipped": the connection was never marked expired, the
// inbox sweep failed five times every two minutes, and the owner was never told to
// reconnect (2026-10-01, prod). The worker decides "reconnect" vs "try again" from the
// status alone, so the status has to survive the throw.

const ENV = [
  'GOOGLE_OAUTH_CLIENT_ID',
  'GOOGLE_OAUTH_CLIENT_SECRET',
  'LINKEDIN_CLIENT_ID',
  'LINKEDIN_CLIENT_SECRET',
  'PINTEREST_APP_ID',
  'PINTEREST_APP_SECRET',
  'THREADS_APP_ID',
  'THREADS_APP_SECRET',
  'TIKTOK_CLIENT_KEY',
  'TIKTOK_CLIENT_SECRET',
];

const ADAPTERS: [string, () => SocialAdapter][] = [
  ['Google Business', () => new GoogleBusinessAdapter()],
  ['LinkedIn', () => new LinkedInAdapter()],
  ['Pinterest', () => new PinterestAdapter()],
  ['Threads', () => new ThreadsAdapter()],
  ['TikTok', () => new TikTokAdapter()],
  ['YouTube', () => new YouTubeAdapter()],
];

function answer(status: number, body: string): void {
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve(new Response(body, { status })))
  );
}

async function refreshError(adapter: SocialAdapter): Promise<unknown> {
  if (!adapter.refresh) throw new Error(`${adapter.name} has no refresh`);
  return adapter.refresh('stale-refresh-token').then(
    () => {
      throw new Error('refresh should have failed');
    },
    (e: unknown) => e
  );
}

beforeEach(() => {
  for (const name of ENV) process.env[name] = 'test-value';
});

afterEach(() => {
  vi.unstubAllGlobals();
  for (const name of ENV) delete process.env[name];
});

describe.each(ADAPTERS)('%s token refresh', (_name, make) => {
  it('a refused grant (401) is permanent and keeps its status', async () => {
    answer(401, '{"code":283,"message":"The authorization grant is invalid"}');
    const e = await refreshError(make());
    expect(e).toBeInstanceOf(HttpError);
    expect((e as HttpError).status).toBe(401);
    expect(isRetryableError(e)).toBe(false);
    // The platform's reason still reaches the log and the connection's last error.
    expect((e as Error).message).toContain('authorization grant is invalid');
  });

  it('an invalid_grant (400) is permanent', async () => {
    answer(400, '{"error":"invalid_grant"}');
    expect(isRetryableError(await refreshError(make()))).toBe(false);
  });

  it('a platform outage (503) is still retried', async () => {
    answer(503, 'unavailable');
    expect(isRetryableError(await refreshError(make()))).toBe(true);
  });
});
