import { describe, expect, it } from 'vitest';
import { ApiError } from '@wizeworks/api-client';
import { paneLoadReason } from './api-error';

/**
 * WHY THESE ARE THREE STATES AND NOT TWO.
 *
 * A pane that could not load has to say WHY, because the three causes send a
 * person somewhere different:
 *
 *   404 → the thing is gone. Retrying cannot help.
 *   5xx → the server answered, and its answer was that it had failed. The fault
 *         is ours; checking their connection is wasted effort.
 *   otherwise → the server was never reached. Retrying is exactly right.
 *
 * The middle one wore the last one's sentence until persona issue 467: every
 * request the By-job screen made in its default filter answered 500, and the
 * screen told the shop the server could not be reached.
 */
function apiError(status: number): ApiError {
  return new ApiError(status, {
    success: false,
    error: { code: 'X', message: 'boom', request_id: 'r', details: null },
  });
}

describe('paneLoadReason', () => {
  it('calls a 404 missing, because retrying cannot bring it back', () => {
    expect(paneLoadReason(apiError(404))).toBe('missing');
  });

  it('calls a 500 failed, NOT unreachable: the server answered', () => {
    expect(paneLoadReason(apiError(500))).toBe('failed');
  });

  it('calls a 503 failed too', () => {
    expect(paneLoadReason(apiError(503))).toBe('failed');
  });

  it('leaves a 4xx that is not 404 on unreachable, unchanged by this split', () => {
    expect(paneLoadReason(apiError(403))).toBe('unreachable');
  });

  it('calls a plain network failure unreachable: there is no status to read', () => {
    expect(paneLoadReason(new Error('fetch failed'))).toBe('unreachable');
  });
});
