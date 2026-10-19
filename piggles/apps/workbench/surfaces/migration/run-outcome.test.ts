// What a run of an import file says it did. MEASURED 2026-10-06: the same 30 customers imported twice
// read "30 of 30 rows brought over" both times, and the warning wrongly said a re-import replaces
// their address, which the importer never does when one is on file (sparx persona issue 106).

import { describe, expect, it } from 'vitest';

import { landedBreakdown, runHeadline } from './run-outcome';

const ALL_HERE = { imported: 0, updated: 30 };

describe('a run where nobody was new', () => {
  it('says so before and after', () => {
    expect(runHeadline({ status: 'completed', dryRun: true }, ALL_HERE, true).title).toBe(
      'Nobody in this file is new'
    );
    expect(runHeadline({ status: 'completed', dryRun: false }, ALL_HERE, true).title).toBe(
      'Nobody in this file was new'
    );
    expect(landedBreakdown(ALL_HERE, false, true)).toBe(
      'none of them new: every one was somebody you already had'
    );
  });

  it('never says their address is replaced', () => {
    for (const dryRun of [true, false]) {
      const { description } = runHeadline({ status: 'completed', dryRun }, ALL_HERE, true);
      expect(description).not.toMatch(/tags and address|details now match/);
      expect(description).toMatch(/address(es)? they already ha(ve|d) (are|were) kept/i);
    }
  });

  it('splits new from already here', () => {
    expect(landedBreakdown({ imported: 28, updated: 2 }, false, true)).toBe(
      '28 new · 2 already here'
    );
    expect(landedBreakdown({ imported: 30, updated: 0 }, false, true)).toBeNull();
  });
});

describe('a file of things, not people (issue 284)', () => {
  // Gillett's products file read "All 609 are people you already have … replaces
  // their name, phone and tags" over a Products card.
  it('speaks of things already here, not people', () => {
    const { title, description } = runHeadline(
      { status: 'completed', dryRun: true },
      ALL_HERE,
      false
    );
    expect(title).toBe('Nothing in this file is new');
    expect(description).not.toMatch(/people|name, phone|marketing/);
    expect(landedBreakdown(ALL_HERE, true, false)).toBe(
      'none of them new: every one is already here'
    );
  });
});
