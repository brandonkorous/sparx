import { describe, expect, it } from 'vitest';

import { toMetricRow } from './collect.js';

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
