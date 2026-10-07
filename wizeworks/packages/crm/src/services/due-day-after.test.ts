// A due date worked out from terms is the business's day, stored at midday.
//
// MEASURED 2026-10-06 on Gillett: Wasatch Front's O-000014, placed on account
// at 10:11 PM Mountain on Oct 3, made INV-000014 due at 05:11 UTC on Nov 3.
// Owed to you printed Nov 3 (one day more than Net 30), and the Wholesale list
// printed Nov 2 (sparx persona issue 099).

import { describe, expect, it } from 'vitest';

import { daysPastDue, dueDayAfter } from './billing-ar';

const DENVER = 'America/Denver';
// Oct 3, 2026, 10:11 PM in Denver: already Oct 4 in UTC.
const PLACED = new Date('2026-10-04T04:11:53.365Z');

describe('dueDayAfter', () => {
  it('counts Net 30 from the business day the order was placed', () => {
    expect(dueDayAfter(PLACED, 30, DENVER).toISOString()).toBe('2026-11-02T12:00:00.000Z');
  });

  it('prints and ages as that day', () => {
    const due = dueDayAfter(PLACED, 30, DENVER);
    // The evening of Nov 2 in Denver: due today, not late.
    expect(daysPastDue(due, new Date('2026-11-03T04:00:00.000Z'), DENVER)).toBe(0);
    // The next morning: one day late.
    expect(daysPastDue(due, new Date('2026-11-03T15:00:00.000Z'), DENVER)).toBe(1);
  });

  it('counts from the UTC day when the business has not said where it is', () => {
    expect(dueDayAfter(PLACED, 30, null).toISOString()).toBe('2026-11-03T12:00:00.000Z');
  });

  it('dates "due on receipt" on the day itself', () => {
    expect(dueDayAfter(PLACED, 0, DENVER).toISOString()).toBe('2026-10-03T12:00:00.000Z');
  });
});
