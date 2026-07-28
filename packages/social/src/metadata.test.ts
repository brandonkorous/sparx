import { describe, expect, it } from 'vitest';

import { paramsFromSocialMetadata } from './metadata.js';

describe('paramsFromSocialMetadata', () => {
  it('reads the string params off socialParams', () => {
    expect(
      paramsFromSocialMetadata({ socialParams: { orgUrn: 'urn:li:organization:42' } })
    ).toEqual({ orgUrn: 'urn:li:organization:42' });
  });

  it('is undefined rather than an empty object when there is nothing to carry', () => {
    expect(paramsFromSocialMetadata({})).toBeUndefined();
    expect(paramsFromSocialMetadata({ socialParams: {} })).toBeUndefined();
  });

  // This reads untyped JSON off a row, so every wrong shape must degrade, never throw —
  // a malformed blob on one connection cannot be allowed to take down a publish run.
  it('survives every wrong shape', () => {
    expect(paramsFromSocialMetadata(null)).toBeUndefined();
    expect(paramsFromSocialMetadata(undefined)).toBeUndefined();
    expect(paramsFromSocialMetadata('nope')).toBeUndefined();
    expect(paramsFromSocialMetadata([1, 2, 3])).toBeUndefined();
    expect(paramsFromSocialMetadata({ socialParams: 'nope' })).toBeUndefined();
    expect(paramsFromSocialMetadata({ socialParams: ['a'] })).toBeUndefined();
  });

  it('drops non-string values instead of coercing them', () => {
    expect(
      paramsFromSocialMetadata({ socialParams: { keep: 'yes', drop: 7, alsoDrop: null } })
    ).toEqual({ keep: 'yes' });
  });
});
