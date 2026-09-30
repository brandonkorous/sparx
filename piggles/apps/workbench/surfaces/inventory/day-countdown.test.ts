// A DAY is not a moment, and counting one in hours says the wrong thing
// (issue 885).
//
// A supplier invoice due on the 30th read, one click apart:
//
//     list    Due today    · September 30, 2026
//     detail  15 hours ago · September 30, 2026
//
// It was twenty past nine in the morning on the day it was due. She had not
// missed it. The list asked for a DAY COUNT; the invoice handed the same stored
// value to silica's `<Timestamp format="relative">`, which is an elapsed-time
// reading on the reader's own clock.
//
// `format="absolute"` is no safer on a day-valued field: it renders on the
// reader's clock too, so a backorder promised for September 10 showed
// "September 9" for everyone west of Greenwich.
//
// The COUNT is `daysUntilDue` in lib/console/days.ts, which is the console's
// one rule and counts calendar days in the BUSINESS's zone. These cases check
// the words Buying puts on it, and that the two agree about the day she is
// standing in.

import { describe, expect, it } from 'vitest';

import { daysUntilDue } from '../../lib/console/days';
import { dayCountLabel, dayCountTone } from './purchase-orders-data';

/** A day-valued field is stored at UTC midnight. */
const day = (iso: string) => `${iso}T00:00:00.000Z`;
/** Juniper Row's own moment: 09:20 in Denver on the day FT-INV-2291 fell due. */
const THAT_MORNING = new Date('2026-09-30T15:20:00.000Z');
const DENVER = 'America/Denver';

describe('what Buying says about a bill due today', () => {
  it('says due today, never hours ago', () => {
    // THE DEFECT. Fifteen hours have passed and none of her day has been used
    // up as far as this question is concerned.
    const label = dayCountLabel(daysUntilDue(day('2026-09-30'), THAT_MORNING, DENVER));

    expect(label).toBe('Due today');
    expect(label).not.toContain('ago');
    expect(label).not.toContain('overdue');
  });

  it('warns rather than alarms on the day itself: she has all of it', () => {
    expect(dayCountTone(daysUntilDue(day('2026-09-30'), THAT_MORNING, DENVER))).toBe('warning');
  });

  it('counts by the calendar the BUSINESS keeps, not the reader', () => {
    // Nine in the evening in Denver is already lunchtime tomorrow in Tokyo. One
    // instant, one due date, two businesses, two honest answers.
    //
    // Asserting both is what makes this able to go red. Asserting only one
    // passes on a machine that happens to sit in that zone, which is exactly
    // how a zone-blind version stayed green here.
    // [[feedback_a_test_that_cannot_go_red]]
    const instant = new Date('2026-10-01T03:00:00.000Z');

    expect(daysUntilDue(day('2026-10-01'), instant, DENVER)).toBe(1);
    expect(daysUntilDue(day('2026-10-01'), instant, 'Asia/Tokyo')).toBe(0);
    expect(dayCountLabel(daysUntilDue(day('2026-10-01'), instant, DENVER))).toBe('in 1 day');
    expect(dayCountLabel(daysUntilDue(day('2026-10-01'), instant, 'Asia/Tokyo'))).toBe('Due today');
  });

  it('ignores the hour somebody happened to raise the invoice at', () => {
    // The fault days.ts was written for: eight invoices all printed "Due Sep 8"
    // and the screen called seven of them 9 days late and the eighth 8, because
    // the eighth was raised at noon. Elapsed milliseconds let the clock on a
    // stored date decide the answer. Calendar days cannot.
    const midnight = daysUntilDue(day('2026-10-09'), THAT_MORNING, DENVER);

    expect(daysUntilDue('2026-10-09T02:00:00.000Z', THAT_MORNING, DENVER)).toBe(midnight);
    expect(daysUntilDue('2026-10-09T20:00:00.000Z', THAT_MORNING, DENVER)).toBe(midnight);
  });

  it('counts the days left, so a payment run can be worked from it', () => {
    expect(daysUntilDue(day('2026-10-09'), THAT_MORNING, DENVER)).toBe(9);
    expect(dayCountLabel(9)).toBe('in 9 days');
    expect(dayCountLabel(1)).toBe('in 1 day');
  });

  it('says how many days late, once it genuinely is', () => {
    expect(daysUntilDue(day('2026-09-18'), THAT_MORNING, DENVER)).toBe(-12);
    expect(dayCountLabel(-12)).toBe('12 days overdue');
    expect(dayCountLabel(-1)).toBe('1 day overdue');
    expect(dayCountTone(-1)).toBe('danger');
  });

  it('never invents a deadline nobody set', () => {
    // Null is not zero. "No date" and "due today" are different facts.
    expect(daysUntilDue(null, THAT_MORNING, DENVER)).toBeNull();
    expect(dayCountLabel(null)).toBe('No date');
    expect(dayCountLabel(null, 'No due date')).toBe('No due date');
    expect(dayCountTone(null)).toBe('neutral');
  });

  it('keeps counting when nobody has said where the business is', () => {
    // Most tenants have not set a zone, and a list must not throw or blank.
    expect(daysUntilDue(day('2026-09-30'), THAT_MORNING, null)).not.toBeNull();
    expect(daysUntilDue(day('2026-09-30'), THAT_MORNING, 'Not/AZone')).not.toBeNull();
  });

  it('warns while the date is close and stays quiet beyond it', () => {
    expect(dayCountTone(3)).toBe('warning');
    expect(dayCountTone(4)).toBe('info');
  });
});
