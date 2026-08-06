import { describe, expect, it } from 'vitest';

import { pickReconnectedTarget, toMetricRow } from './collect.js';

// The pure mapping from an adapter's metrics to a snapshot row. The I/O path
// (collectPostMetrics) is integration surface, like the publish drain — the load-bearing
// rule to lock here is: a metric a platform DIDN'T report becomes NULL, never 0.

describe('toMetricRow', () => {
  it('passes numbers through, including a genuine zero', () => {
    expect(
      toMetricRow({ likes: 12, comments: 0, shares: 3, impressions: 900, reach: 720 })
    ).toEqual({ likes: 12, comments: 0, shares: 3, impressions: 900, reach: 720 });
  });

  it('maps a missing metric to null — an ungranted insights scope must not read as 0 reach', () => {
    expect(toMetricRow({ likes: 5, comments: 1 })).toEqual({
      likes: 5,
      comments: 1,
      shares: null,
      impressions: null,
      reach: null,
    });
  });

  it('maps an empty result to all nulls', () => {
    expect(toMetricRow({})).toEqual({
      likes: null,
      comments: null,
      shares: null,
      impressions: null,
      reach: null,
    });
  });
});

// Reconnecting an account mints a new target row with a new id, so every post published
// before the reconnect points at an id that no longer resolves. Measured on production
// while diagnosing "the post pane has no stats": 19 published destinations, 5 whose
// original target row still existed. The rest were skipped silently, so a tenant's
// numbers stopped moving with nothing broken and nothing logged.
describe('pickReconnectedTarget', () => {
  const page = { name: 'Sparx' };
  const other = { name: 'Other Page' };

  it('matches the same account by name after a reconnect', () => {
    expect(pickReconnectedTarget([other, page], 'Sparx')).toBe(page);
  });

  it('uses the only account on the platform when the name has changed', () => {
    // A Page renamed on the platform still has one obvious answer.
    expect(pickReconnectedTarget([page], 'Old Name')).toBe(page);
  });

  it('refuses to guess between accounts — a gap beats the wrong Page', () => {
    expect(pickReconnectedTarget([page, other], 'Third Page')).toBeNull();
  });

  it('returns null when the platform has been disconnected entirely', () => {
    expect(pickReconnectedTarget([], 'Sparx')).toBeNull();
  });

  it('prefers the name match over sole-account, so order cannot decide it', () => {
    expect(pickReconnectedTarget([other, page], 'Sparx')).toBe(page);
  });
});
