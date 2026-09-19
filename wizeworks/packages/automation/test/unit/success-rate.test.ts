// ONE SCREEN, ONE SENTENCE, TWO DIFFERENT SUMS.
//
// The automations report draws a headline "Success rate" and, below it, a list
// of every rule with its own "64% ok". Between the two it says:
//
//     "A skipped run means the conditions no longer matched. It is not counted
//      against the success rate."
//
// That was true of the headline and false of every row. The headline used
// `successRateOf` — completed / (completed + failed). The per-rule overview had
// its own arithmetic two hundred lines further down the same file:
//
//     successRate: s.runs > 0 ? +(s.completed / s.runs).toFixed(4) : null
//
// `s.runs` counts EVERY run, skipped included, so a rule that fired ten times,
// finished five and skipped five read 50% under a sentence promising it would
// read 100%.
//
// Measured 2026-09-18: 1,154 runs on the platform, 1,081 completed and 73
// failed. Not one skipped. So the two sums agreed to the digit, and would have
// gone on agreeing until the first rule whose condition stopped matching.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// A pure function, so the rule can be pinned without a database.

import { describe, expect, it } from 'vitest';
import { successRateOf } from '../../src/service/run-report-service.js';

describe('the success rate a business owner is shown', () => {
  it('does not count a skipped run against the rule', () => {
    // Fired ten times, finished five, skipped five, failed none. Nothing went
    // wrong, so nothing should be marked wrong.
    expect(successRateOf(5, 0)).toBe(100);
  });

  it('counts a failure, because a failure is the thing she needs to see', () => {
    expect(successRateOf(5, 5)).toBe(50);
    expect(successRateOf(0, 8)).toBe(0);
  });

  it('rounds to one decimal, which is what the headline prints', () => {
    // 51 of 79 on one shop's screen, the day this was found.
    expect(successRateOf(51, 28)).toBe(64.6);
  });

  it('answers 0 rather than dividing by nothing', () => {
    // A rule that has never settled a run has no rate. The caller that needs to
    // say "no runs yet" checks the counts, not this.
    expect(successRateOf(0, 0)).toBe(0);
  });

  it('is the same sum whichever screen asks', () => {
    // The whole point of exporting it. If a caller ever computes its own again,
    // this is the number it has to match.
    for (const [done, bad] of [
      [1, 0],
      [0, 1],
      [3, 1],
      [17, 4],
      [1081, 73],
    ] as const) {
      expect(successRateOf(done, bad)).toBe(+((done / (done + bad)) * 100).toFixed(1));
    }
  });
});
