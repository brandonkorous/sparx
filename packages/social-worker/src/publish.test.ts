import { describe, expect, it } from 'vitest';
import { HttpError } from '@sparx/social';

import { derivePostStatus, isAuthRejection } from './publish.js';

describe('derivePostStatus', () => {
  it('is publishing while any target is still pending', () => {
    expect(derivePostStatus(['published', 'pending'])).toBe('publishing');
    expect(derivePostStatus(['publishing'])).toBe('publishing');
  });

  it('is published when every non-skipped target published', () => {
    expect(derivePostStatus(['published', 'published'])).toBe('published');
  });

  it('treats skipped opt-outs as not demoting a full success', () => {
    expect(derivePostStatus(['published', 'skipped'])).toBe('published');
  });

  it('is partially_published when some published and some failed', () => {
    expect(derivePostStatus(['published', 'failed'])).toBe('partially_published');
  });

  it('is failed when nothing published', () => {
    expect(derivePostStatus(['failed', 'failed'])).toBe('failed');
    expect(derivePostStatus(['failed', 'skipped'])).toBe('failed');
    expect(derivePostStatus(['skipped'])).toBe('failed');
  });
});

// Telling "this ACCOUNT is broken" apart from "this POST is wrong" is what decides
// whether the tenant gets one "reconnect this account" notice or watches post after post
// fail while Connections still says everything is fine.
describe('isAuthRejection', () => {
  it('is true for the two statuses that mean the sign-in is no longer valid', () => {
    expect(isAuthRejection(new HttpError('unauthorized', 401))).toBe(true);
    expect(isAuthRejection(new HttpError('forbidden', 403))).toBe(true);
  });

  it('is false for a bad post — the account is fine, the content is not', () => {
    expect(isAuthRejection(new HttpError('bad image', 400))).toBe(false);
    expect(isAuthRejection(new HttpError('unprocessable', 422))).toBe(false);
  });

  it('is false for a transient platform problem', () => {
    expect(isAuthRejection(new HttpError('rate limited', 429))).toBe(false);
    expect(isAuthRejection(new HttpError('bad gateway', 502))).toBe(false);
  });

  it('is false for anything without a status — a network drop is not a revoked grant', () => {
    expect(isAuthRejection(new Error('socket hang up'))).toBe(false);
    expect(isAuthRejection('nope')).toBe(false);
  });
});
