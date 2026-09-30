// A PANEL THAT ANSWERS "WHERE DID THEY COME FROM" MUST NOT COUNT THE ONES IT
// CANNOT ANSWER FOR.
//
// Devi's numbers, exactly as they came off the dev database on 2026-09-25:
// 32 customers with no order, 4 from her website, 3 added by hand, 1 through
// wholesale. The old panel drew the 32 as a source called "Direct" — a full-
// width bar at 80% that squashed the three real answers to nothing.
//
// The test that matters is the last one: removing the split makes the bars add
// up to the whole population again, and a bar can read 80% while meaning "we
// never found out".

import { describe, expect, it } from 'vitest';

import { NO_ORDER_YET, notKnownNote, splitLeadSources } from './lead-sources';
import type { LeadSourceRow } from './reports-data';

/** Devi's shop, last 90 days. `sharePct` is the API's own figure over the whole
 *  population, which is what the panel used to draw. */
const DEVI: LeadSourceRow[] = [
  { source: NO_ORDER_YET, count: 32, sharePct: 80 },
  { source: 'storefront', count: 4, sharePct: 10 },
  { source: 'admin', count: 3, sharePct: 7.5 },
  { source: 'b2b_portal', count: 1, sharePct: 2.5 },
];

describe('splitting where new customers came from', () => {
  it('draws only the ways somebody really did arrive', () => {
    const view = splitLeadSources(DEVI);
    expect(view.observed.map((row) => row.source)).toEqual(['storefront', 'admin', 'b2b_portal']);
    expect(view.observed.some((row) => row.source === NO_ORDER_YET)).toBe(false);
  });

  it('counts the ones it cannot answer for, and keeps the whole total', () => {
    const view = splitLeadSources(DEVI);
    expect(view.notKnown).toBe(32);
    expect(view.total).toBe(40);
  });

  it('works out each share over the answered ones, not over everybody', () => {
    // 4 of the 8 who actually ordered. Over all 40 it would read 10%, which
    // invites a comparison against a bar that means "unknown".
    const view = splitLeadSources(DEVI);
    expect(view.observed[0]).toEqual({ source: 'storefront', count: 4, sharePct: 50 });
    const total = view.observed.reduce((sum, row) => sum + row.sharePct, 0);
    expect(Math.round(total)).toBe(100);
  });

  it('measures the tallest bar against the answered ones too', () => {
    // The unknown bucket was the peak on every shop measured, so every real
    // bar was drawn as a fraction of a number that meant nothing.
    expect(splitLeadSources(DEVI).peak).toBe(4);
  });

  it('holds up when nobody has ordered at all', () => {
    const view = splitLeadSources([{ source: NO_ORDER_YET, count: 12, sharePct: 100 }]);
    expect(view.observed).toEqual([]);
    expect(view.notKnown).toBe(12);
    expect(view.peak).toBe(1);
  });

  it('holds up when everybody has ordered', () => {
    const view = splitLeadSources([{ source: 'storefront', count: 5, sharePct: 100 }]);
    expect(view.notKnown).toBe(0);
    expect(view.observed[0]?.sharePct).toBe(100);
  });

  it('holds up on no customers at all', () => {
    const view = splitLeadSources(undefined);
    expect(view).toEqual({ observed: [], notKnown: 0, total: 0, peak: 1 });
  });
});

describe('what the panel admits it does not know', () => {
  it('says how many of them have not ordered', () => {
    expect(notKnownNote(32, 40)).toBe(
      '32 of these 40 have not ordered yet. Until somebody orders, there is nothing to say about where they came from.'
    );
  });

  it('says so differently when it is all of them', () => {
    expect(notKnownNote(12, 12)).toContain('None of these 12 have ordered yet.');
  });

  it('speaks about one customer as one customer', () => {
    expect(notKnownNote(1, 1)).toContain('This customer has not ordered yet.');
  });

  it('says nothing when every customer has ordered', () => {
    // Nothing is missing, so there is nothing to admit. A panel that always
    // carries a caveat teaches people to stop reading it.
    expect(notKnownNote(0, 9)).toBeNull();
  });
});
