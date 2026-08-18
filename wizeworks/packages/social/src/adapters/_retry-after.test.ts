import { describe, expect, it } from 'vitest';

import { HttpError, isRetryableError, parseRetryAfter } from './_http.js';

/** A minimal Response stand-in — only its headers matter here. */
function withHeader(value?: string): Response {
  return new Response(null, {
    headers: value === undefined ? {} : { 'retry-after': value },
  });
}

// Honouring the number a platform actually sent is the difference between backing off
// and stampeding a rate limit into a longer ban.
describe('parseRetryAfter', () => {
  it('is undefined when the platform did not say', () => {
    expect(parseRetryAfter(withHeader())).toBeUndefined();
  });

  it('reads a plain seconds value', () => {
    expect(parseRetryAfter(withHeader('90'))).toBe(90);
  });

  it('reads zero as zero, not as absent', () => {
    expect(parseRetryAfter(withHeader('0'))).toBe(0);
  });

  it('reads an HTTP-date and converts it to a wait', () => {
    const inTwoMinutes = new Date(Date.now() + 120_000).toUTCString();
    const seconds = parseRetryAfter(withHeader(inTwoMinutes));
    // Second-resolution formatting makes this approximate by design.
    expect(seconds).toBeGreaterThan(110);
    expect(seconds).toBeLessThanOrEqual(120);
  });

  it('treats a date already in the past as "go now" rather than a negative wait', () => {
    const anHourAgo = new Date(Date.now() - 3_600_000).toUTCString();
    expect(parseRetryAfter(withHeader(anHourAgo))).toBe(0);
  });

  it('clamps an absurd value — a header asking for a month is their bug, not an order', () => {
    expect(parseRetryAfter(withHeader('9999999'))).toBe(86_400);
  });

  it('is undefined for something unparseable', () => {
    expect(parseRetryAfter(withHeader('soon'))).toBeUndefined();
  });
});

describe('HttpError carries the wait', () => {
  it('keeps the seconds it was given', () => {
    expect(new HttpError('slow down', 429, 30).retryAfterSeconds).toBe(30);
  });

  it('leaves it undefined when there was none, rather than inventing a default', () => {
    expect(new HttpError('slow down', 429).retryAfterSeconds).toBeUndefined();
  });
});

describe('isRetryableError', () => {
  it('retries a rate limit and a server fault', () => {
    expect(isRetryableError(new HttpError('x', 429))).toBe(true);
    expect(isRetryableError(new HttpError('x', 500))).toBe(true);
    expect(isRetryableError(new HttpError('x', 503))).toBe(true);
  });

  it('does not retry a rejection the same request will never clear', () => {
    expect(isRetryableError(new HttpError('x', 400))).toBe(false);
    expect(isRetryableError(new HttpError('x', 401))).toBe(false);
    expect(isRetryableError(new HttpError('x', 404))).toBe(false);
  });

  it('retries an error with no status — a network drop is usually transient', () => {
    expect(isRetryableError(new Error('socket hang up'))).toBe(true);
  });
});
