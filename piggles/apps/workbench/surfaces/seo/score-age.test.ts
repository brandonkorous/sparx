// How old the scores on the page list are (issue 872).
//
// The list is a stored snapshot and its freshness marker reported the BROWSER's
// fetch time, so 370 of 370 audits platform-wide read "updated a few seconds
// ago" while averaging 47 days old and reaching 117.
//
// The rule these pin: **a list is only as current as its OLDEST row.** Reporting
// the newest would let one rescan of one page speak for a hundred stale ones,
// which is the same wrong answer the fetch time gave, arrived at differently.

import { describe, expect, it } from 'vitest';

import { STALE_AFTER_DAYS, scoreAge, scoreAgeAdvice } from './score-age';

const NOW = Date.parse('2026-09-29T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW - n * 86_400_000).toISOString();

const rows = (...isos: (string | null | undefined)[]) => isos.map((computedAt) => ({ computedAt }));

describe('it reports the oldest, never the newest', () => {
  it('takes the oldest of a mixed list', () => {
    // Devi's own spread: builder pages scored 31 days ago, everything else 12.
    const age = scoreAge(rows(daysAgo(12), daysAgo(31), daysAgo(12)), NOW);
    expect(age?.oldest).toBe(daysAgo(31));
  });

  it('never lets one fresh rescan speak for the stale ones', () => {
    const age = scoreAge(rows(daysAgo(0), daysAgo(117)), NOW);
    expect(age?.oldest).toBe(daysAgo(117));
    expect(age?.stale).toBe(true);
  });
});

describe('when a rescan becomes the honest next step', () => {
  it('is not stale inside the threshold', () => {
    const age = scoreAge(rows(daysAgo(STALE_AFTER_DAYS - 1)), NOW);
    expect(age?.stale).toBe(false);
    expect(scoreAgeAdvice(age!)).toBe('');
  });

  it('is stale past it', () => {
    const age = scoreAge(rows(daysAgo(STALE_AFTER_DAYS + 1)), NOW);
    expect(age?.stale).toBe(true);
  });

  it('offers the remedy plainly when every score is old', () => {
    const age = scoreAge(rows(daysAgo(40), daysAgo(50)), NOW);
    expect(scoreAgeAdvice(age!)).toBe('Rescan to bring them up to date.');
  });

  it('counts them when only some are old, rather than tarring the list', () => {
    const age = scoreAge(rows(daysAgo(40), daysAgo(1), daysAgo(1)), NOW);
    expect(age?.staleCount).toBe(1);
    expect(age?.total).toBe(3);
    expect(scoreAgeAdvice(age!)).toBe(
      '1 of 3 is more than a week old. Rescan to bring them up to date.'
    );
  });

  it('gets the plural right', () => {
    const age = scoreAge(rows(daysAgo(40), daysAgo(40), daysAgo(1)), NOW);
    expect(scoreAgeAdvice(age!)).toBe(
      '2 of 3 are more than a week old. Rescan to bring them up to date.'
    );
  });
});

describe('it says nothing rather than guessing', () => {
  it('has nothing to say about an empty list', () => {
    expect(scoreAge([], NOW)).toBeNull();
  });

  it('ignores a stamp it cannot read, rather than treating it as now', () => {
    // An unreadable stamp is not evidence of freshness. Inventing "just now"
    // from it is the bug this replaces, arrived at from the other direction.
    expect(scoreAge(rows('not a date'), NOW)).toBeNull();
    expect(scoreAge(rows(null, undefined, ''), NOW)).toBeNull();
  });

  it('still reports the readable ones when one stamp is bad', () => {
    const age = scoreAge(rows('not a date', daysAgo(30)), NOW);
    expect(age?.oldest).toBe(daysAgo(30));
    expect(age?.total).toBe(1);
  });
});

describe('the real measurement', () => {
  it('calls the platform-wide state stale, which is what it is', () => {
    // 370 audits, oldest 117 days, average 47. Every one past a week.
    const age = scoreAge(rows(daysAgo(117), daysAgo(47), daysAgo(10)), NOW);
    expect(age?.stale).toBe(true);
    expect(age?.staleCount).toBe(3);
    expect(scoreAgeAdvice(age!)).toBe('Rescan to bring them up to date.');
  });
});
