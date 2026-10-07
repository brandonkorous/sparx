// What a run of an import file says it did.
//
// MEASURED 2026-10-06 on Gillett: importing the same 30 customers twice read
// "30 of 30 rows brought over" both times, and the warning said a re-import
// replaces their address, which the importer never does when one is on file
// (sparx persona issue 106).

import { describe, expect, it } from 'vitest';

import { landedBreakdown, runHeadline } from './run-outcome';

const ALL_HERE = { imported: 0, updated: 30 };

describe('a run where nobody was new', () => {
  it('says so before and after', () => {
    expect(runHeadline({ status: 'completed', dryRun: true }, ALL_HERE).title).toBe(
      'Nobody in this file is new'
    );
    expect(runHeadline({ status: 'completed', dryRun: false }, ALL_HERE).title).toBe(
      'Nobody in this file was new'
    );
    expect(landedBreakdown(ALL_HERE, false)).toBe(
      'none of them new: every one was somebody you already had'
    );
  });

  it('never says their address is replaced', () => {
    for (const dryRun of [true, false]) {
      const { description } = runHeadline({ status: 'completed', dryRun }, ALL_HERE);
      expect(description).not.toMatch(/tags and address|details now match/);
      expect(description).toMatch(/address(es)? they already ha(ve|d) (are|were) kept/i);
    }
  });

  it('splits new from already here', () => {
    expect(landedBreakdown({ imported: 28, updated: 2 }, false)).toBe('28 new · 2 already here');
    expect(landedBreakdown({ imported: 30, updated: 0 }, false)).toBeNull();
  });
});
