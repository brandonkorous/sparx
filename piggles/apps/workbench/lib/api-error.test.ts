import { describe, expect, it } from 'vitest';
import { ApiError } from '@wizeworks/api-client';
import { apiErrorMessage, paneLoadReason } from './api-error';

// A failed load has four causes and each sends a person somewhere different:
// gone (no retry), our fault (5xx), refused (401/403), and not reached at all.
// Only the last may blame the connection (persona issues 467 and 260).
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

  // 403 is the thing being THERE and out of reach. It used to say "a problem
  // reaching the server" to someone the server had answered (persona issue 260).
  it('calls a 403 refused: the server answered, and the answer was no', () => {
    expect(paneLoadReason(apiError(403))).toBe('refused');
  });

  it('calls a 401 refused too', () => {
    expect(paneLoadReason(apiError(401))).toBe('refused');
  });

  it('calls any other answered 4xx failed, never unreachable', () => {
    expect(paneLoadReason(apiError(409))).toBe('failed');
    expect(paneLoadReason(apiError(429))).toBe('failed');
  });

  it('calls a plain network failure unreachable: there is no status to read', () => {
    expect(paneLoadReason(new Error('fetch failed'))).toBe('unreachable');
  });
});

// The schema's SENTENCE is not worth showing; its FIELD LIST is. Without it, a
// refused save on a twenty-field form named no box at all.
function refused(details: unknown, message = 'Request validation failed.'): ApiError {
  return new ApiError(422, {
    success: false,
    error: { code: 'VALIDATION_ERROR', message, request_id: 'r', details },
  });
}

const fallback = 'Could not save this account. Nothing was changed.';

describe('apiErrorMessage on a refused write', () => {
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
});

describe('apiErrorMessage on a rule a service explains', () => {
  it('keeps showing a SERVICE message, which explains a real rule', () => {
    // A plain business rule with no field named. Its sentence is the one
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

  it('shows a SERVICE sentence that names a field (persona issue 245)', () => {
    // Every service mapper passes its own `details` through; a field named by
    // a rule is not the schema talking about itself.
    const rule = refused(
      [{ field: 'lines', message: 'enter what you paid for it' }],
      'Nothing on record says what this item cost, so the credit to expect cannot be worked out.'
    );
    expect(apiErrorMessage(rule, fallback)).toBe(
      'Nothing on record says what this item cost, so the credit to expect cannot be worked out.'
    );
  });

  it("still hides Fastify's own schema report, which carries a `keyword`", () => {
    const ajv = refused(
      [{ keyword: 'required', instancePath: '', message: "must have required property 'name'" }],
      "body must have required property 'name'"
    );
    expect(apiErrorMessage(ajv, fallback)).not.toContain('must have required');
  });
});
