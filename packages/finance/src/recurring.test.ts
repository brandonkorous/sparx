// The recurring date arithmetic. Pure and UTC-only, so no database is involved.
//
// The cases that matter are the ones a naive `setMonth(+1)` gets wrong: month-end
// anchors, February, leap years, and a worker that slept through several periods.

import { describe, expect, it } from 'vitest';

import {
  advanceOccurrence,
  anchorDayFor,
  firstOccurrence,
  occurrencesDue,
  periodKey,
} from './recurring';

const d = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

describe('advanceOccurrence', () => {
  it('steps week-based cadences by whole weeks', () => {
    expect(advanceOccurrence('weekly', d('2027-03-04'), 4)).toEqual(d('2027-03-11'));
    expect(advanceOccurrence('biweekly', d('2027-03-04'), 4)).toEqual(d('2027-03-18'));
  });

  it('crosses a month boundary on a weekly cadence', () => {
    expect(advanceOccurrence('weekly', d('2027-03-29'), 29)).toEqual(d('2027-04-05'));
  });

  it('clamps a month-end anchor into a short month', () => {
    // The 31st of January bills on the 28th of February...
    expect(advanceOccurrence('monthly', d('2027-01-31'), 31)).toEqual(d('2027-02-28'));
  });

  it('RESTORES the anchor after a clamp instead of drifting', () => {
    // ...and then back on the 31st in March. This is why the anchor is passed
    // explicitly rather than read off the clamped date — reading it back would
    // move the template to the 28th permanently.
    expect(advanceOccurrence('monthly', d('2027-02-28'), 31)).toEqual(d('2027-03-31'));
  });

  it('handles February in a leap year', () => {
    expect(advanceOccurrence('monthly', d('2028-01-31'), 31)).toEqual(d('2028-02-29'));
  });

  it('rolls the year over on a December step', () => {
    expect(advanceOccurrence('monthly', d('2027-12-15'), 15)).toEqual(d('2028-01-15'));
    expect(advanceOccurrence('quarterly', d('2027-11-15'), 15)).toEqual(d('2028-02-15'));
    expect(advanceOccurrence('annual', d('2027-06-30'), 30)).toEqual(d('2028-06-30'));
  });
});

describe('anchorDayFor', () => {
  it('prefers the explicit day of month', () => {
    expect(anchorDayFor({ dayOfMonth: 1, startsOn: d('2027-03-17') })).toBe(1);
  });

  it('falls back to the start date’s own day', () => {
    expect(anchorDayFor({ dayOfMonth: null, startsOn: d('2027-03-17') })).toBe(17);
  });
});

describe('firstOccurrence', () => {
  it('bills this month when the anchor has not passed yet', () => {
    expect(
      firstOccurrence({ cadence: 'monthly', dayOfMonth: 20, startsOn: d('2027-03-05') })
    ).toEqual(d('2027-03-20'));
  });

  it('waits for next month when the anchor already passed', () => {
    // Started on the 20th, anchored to the 1st: the 1st of THIS month is behind
    // us, so the first bill is next month rather than a backdated one.
    expect(
      firstOccurrence({ cadence: 'monthly', dayOfMonth: 1, startsOn: d('2027-03-20') })
    ).toEqual(d('2027-04-01'));
  });

  it('starts week-based cadences on the start date itself', () => {
    expect(
      firstOccurrence({ cadence: 'weekly', dayOfMonth: null, startsOn: d('2027-03-20') })
    ).toEqual(d('2027-03-20'));
  });
});

describe('occurrencesDue', () => {
  it('is empty when the next run is still ahead', () => {
    const due = occurrencesDue(
      {
        cadence: 'monthly',
        dayOfMonth: 1,
        startsOn: d('2027-01-01'),
        endsOn: null,
        nextRunOn: d('2027-05-01'),
      },
      d('2027-04-15')
    );
    expect(due).toEqual([]);
  });

  it('catches up every period a sleeping worker missed', () => {
    // The whole reason this returns a LIST: a worker down for a quarter must not
    // silently skip to the current month and leave a hole in the ledger.
    const due = occurrencesDue(
      {
        cadence: 'monthly',
        dayOfMonth: 1,
        startsOn: d('2027-01-01'),
        endsOn: null,
        nextRunOn: d('2027-01-01'),
      },
      d('2027-04-15')
    );
    expect(due).toEqual([d('2027-01-01'), d('2027-02-01'), d('2027-03-01'), d('2027-04-01')]);
  });

  it('stops at the template’s end date', () => {
    const due = occurrencesDue(
      {
        cadence: 'monthly',
        dayOfMonth: 1,
        startsOn: d('2027-01-01'),
        endsOn: d('2027-02-28'),
        nextRunOn: d('2027-01-01'),
      },
      d('2027-06-01')
    );
    expect(due).toEqual([d('2027-01-01'), d('2027-02-01')]);
  });

  it('respects the runaway limit', () => {
    const due = occurrencesDue(
      {
        cadence: 'weekly',
        dayOfMonth: null,
        startsOn: d('2020-01-01'),
        endsOn: null,
        nextRunOn: d('2020-01-01'),
      },
      d('2027-01-01'),
      12
    );
    expect(due).toHaveLength(12);
  });
});

describe('periodKey', () => {
  it('is the calendar day, which is what makes a replay idempotent', () => {
    expect(periodKey(d('2027-02-28'))).toBe('2027-02-28');
  });
});
