import { describe, expect, it } from 'vitest';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage, paneLoadReason } from './api-error';

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

  it('calls a 400 missing: the server answered, and the address is wrong', () => {
    expect(paneLoadReason(apiError(400))).toBe('missing');
  });

  it('calls a 422 missing too, which is what a truncated id in a link returns', () => {
    expect(paneLoadReason(apiError(422))).toBe('missing');
  });

  // 403 is the thing being THERE and out of reach, which is neither of the
  // other two. It stays where it was rather than being called deleted.
  it('leaves a 403 on unreachable', () => {
    expect(paneLoadReason(apiError(403))).toBe('unreachable');
  });

  it('calls a plain network failure unreachable: there is no status to read', () => {
    expect(paneLoadReason(new Error('fetch failed'))).toBe('unreachable');
  });
});

/**
 * THE SCHEMA'S SENTENCE IS NOT WORTH SHOWING. ITS FIELD LIST IS.
 *
 * `apiErrorMessage` was right to drop "Request validation failed." and wrong to
 * drop what came with it. Every one of the 83 call sites in this console said
 * only the caller's own sentence, so a refused save named no box at all.
 */
function refused(details: unknown, message = 'Request validation failed.'): ApiError {
  return new ApiError(422, {
    success: false,
    error: { code: 'VALIDATION_ERROR', message, request_id: 'r', details },
  });
}

describe('apiErrorMessage on a refused write', () => {
  const fallback = 'Could not save this account. Nothing was changed.';

  it('adds the box the server refused', () => {
    const said = apiErrorMessage(refused([{ path: 'physicalAddress' }]), fallback);
    expect(said).toBe(`${fallback} The problem is with Physical address.`);
  });

  it('still never repeats the schema describing itself', () => {
    expect(apiErrorMessage(refused([{ path: 'price' }]), fallback)).not.toContain(
      'Request validation failed'
    );
  });

  it('leaves the plain sentence alone when no field was named', () => {
    // A rule that refuses the whole request has nowhere to point.
    expect(apiErrorMessage(refused([{ path: '' }]), fallback)).toBe(fallback);
  });

  it('keeps showing a SERVICE message, which explains a real rule', () => {
    // A service never attaches per-field details, and its sentence is the one
    // the operator actually needs (persona issue 224).
    const rule = new ApiError(422, {
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'No payment gateway is configured to settle this refund.',
        request_id: 'r',
        details: null,
      },
    });
    expect(apiErrorMessage(rule, fallback)).toBe(
      'No payment gateway is configured to settle this refund.'
    );
  });
});
