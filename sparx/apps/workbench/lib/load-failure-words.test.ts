// One place decides why a load failed and what to say (persona issue 260). Every
// pane used to say "a problem reaching the server", whatever had gone wrong.

import { describe, expect, it } from 'vitest';
import { ApiError } from '@wizeworks/api-client';

import { loadFailureWords, workFailureWords } from './api-error';

function apiError(status: number): ApiError {
  return new ApiError(status, {
    success: false,
    error: { code: 'X', message: 'boom', request_id: 'r', details: null },
  });
}

const CALLER = 'This is a problem reaching the server. Your orders are unaffected.';

describe('loadFailureWords', () => {
  it('keeps the screen’s own words when the server could not be reached', () => {
    expect(loadFailureWords(new Error('fetch failed'), CALLER)).toBe(CALLER);
  });

  it('owns the words for a server failure', () => {
    expect(loadFailureWords(apiError(500), CALLER)).toMatch(/at our end/);
  });

  it('owns the words for a refusal, and does not blame the connection', () => {
    const words = loadFailureWords(apiError(403), CALLER);
    expect(words).not.toMatch(/reaching the server/);
    expect(words).toMatch(/not allowed/);
  });

  it('owns the words for something that is gone', () => {
    expect(loadFailureWords(apiError(404), CALLER)).toMatch(/deleted/);
  });
});

// A calculation (a tax quote, a price preview) is not a read: an answered 400,
// 404 or 422 is about what was sent, never a deleted record (persona issue 260).
describe('workFailureWords', () => {
  it('never says a refused calculation was deleted', () => {
    for (const status of [400, 404, 422]) {
      const words = workFailureWords(apiError(status), 'x');
      expect(words).not.toMatch(/deleted/);
      expect(words).toMatch(/could not work this out/);
    }
  });

  it('keeps the other causes as a read has them', () => {
    expect(workFailureWords(apiError(500), 'x')).toMatch(/at our end/);
    expect(workFailureWords(new Error('fetch failed'), 'x')).toBe('x');
  });
});
