import { describe, expect, it } from 'vitest';

import { HttpError, isRetryableError, splitScopes } from './_http.js';

// The publish drain retries TRANSIENT failures (5xx / 429 / network) up to MAX_ATTEMPTS
// but must FAIL a permanent 4xx immediately — a bad image, caption, or revoked token
// won't clear on a re-drain, so churning all 5 attempts on it just delays the failure.
describe('isRetryableError', () => {
  it('does NOT retry a permanent 4xx', () => {
    for (const status of [400, 401, 403, 404, 410, 422]) {
      expect(isRetryableError(new HttpError(`boom ${status}`, status))).toBe(false);
    }
  });

  it('retries a rate-limit (429) and any 5xx', () => {
    for (const status of [429, 500, 502, 503]) {
      expect(isRetryableError(new HttpError(`boom ${status}`, status))).toBe(true);
    }
  });

  it('retries a non-HttpError (network drop / timeout / bug has no status)', () => {
    expect(isRetryableError(new Error('fetch failed'))).toBe(true);
    expect(isRetryableError(new TypeError('network error'))).toBe(true);
    expect(isRetryableError('a bare string')).toBe(true);
  });

  it('carries the status on the error for logging', () => {
    const e = new HttpError('Facebook photo post: 422 Missing or invalid image file', 422);
    expect(e.status).toBe(422);
    expect(e.name).toBe('HttpError');
    expect(e).toBeInstanceOf(Error);
  });
});

describe('splitScopes', () => {
  it('splits a comma-separated scope string (Meta, TikTok, Pinterest)', () => {
    expect(splitScopes('pages_show_list,pages_manage_posts')).toEqual([
      'pages_show_list',
      'pages_manage_posts',
    ]);
  });

  it('splits a space-separated scope string (LinkedIn, Google)', () => {
    expect(splitScopes('openid profile w_organization_social')).toEqual([
      'openid',
      'profile',
      'w_organization_social',
    ]);
  });

  it('handles the mixed separators a platform sometimes echoes back', () => {
    expect(splitScopes('a, b,c  d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('is empty for nothing at all, so an unreported scope set reads as unknown', () => {
    expect(splitScopes(undefined)).toEqual([]);
    expect(splitScopes(null)).toEqual([]);
    expect(splitScopes('')).toEqual([]);
    expect(splitScopes('   ')).toEqual([]);
  });

  it('drops duplicates — the only use is set comparison', () => {
    expect(splitScopes('pins:read,pins:read,pins:write')).toEqual(['pins:read', 'pins:write']);
  });
});
