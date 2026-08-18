import { describe, expect, it } from 'vitest';

import { mapGoogleBusinessMetrics } from './google-business.js';

// The Google Business adapter's pure metric mapping. The localPosts + reviews calls are
// integration surface; what's locked here is how a LISTING's numbers translate onto the
// shared post-metric shape — a listing has no likes, comments, or shares to report, and
// saying so with nulls (not zeros) is the whole point.

describe('mapGoogleBusinessMetrics', () => {
  it('maps the search-view count onto impressions', () => {
    expect(
      mapGoogleBusinessMetrics([
        { metric: 'LOCAL_POST_VIEWS_SEARCH', totalValue: { value: '1450' } },
      ])
    ).toEqual({ impressions: 1450 });
  });

  // Google omits a metric entirely when it's zero, and answers int64 as a string.
  it('parses the string count and ignores metrics it has no home for', () => {
    expect(
      mapGoogleBusinessMetrics([
        { metric: 'LOCAL_POST_VIEWS_SEARCH', totalValue: { value: '7' } },
        { metric: 'LOCAL_POST_ACTIONS_CALL_TO_ACTION', totalValue: { value: '3' } },
      ])
    ).toEqual({ impressions: 7 });
  });

  // A storefront listing has no feed engagement — showing 0 likes would read as "nobody
  // engaged" when the platform simply has no such concept.
  it('never fabricates engagement the platform does not have', () => {
    const metrics = mapGoogleBusinessMetrics([
      { metric: 'LOCAL_POST_VIEWS_SEARCH', totalValue: { value: '99' } },
    ]);
    expect(metrics.likes).toBeUndefined();
    expect(metrics.comments).toBeUndefined();
    expect(metrics.shares).toBeUndefined();
    expect(metrics.reach).toBeUndefined();
  });

  it('omits impressions when nothing usable came back', () => {
    expect(mapGoogleBusinessMetrics(undefined)).toEqual({});
    expect(mapGoogleBusinessMetrics([])).toEqual({});
    expect(mapGoogleBusinessMetrics([{ metric: 'LOCAL_POST_VIEWS_SEARCH' }])).toEqual({});
    expect(
      mapGoogleBusinessMetrics([
        { metric: 'LOCAL_POST_VIEWS_SEARCH', totalValue: { value: 'many' } },
      ])
    ).toEqual({});
  });
});
