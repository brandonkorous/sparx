import { describe, expect, it } from 'vitest';
import { daysPastDue } from './days';

// "Today" is built from LOCAL parts on purpose, so these tests mean the same
// thing in every timezone the suite might run in: the reader's calendar day is
// September 16 wherever they are. Due dates are UTC instants, which is how they
// are stored and how `formatDay` prints them.
const NOW = new Date(2026, 8, 16, 21, 30); // local Sep 16, 9:30pm

describe('counting days past a due date', () => {
  it('counts whole calendar days, not elapsed time', () => {
    expect(daysPastDue('2026-09-08T12:00:00.000Z', NOW)).toBe(8);
  });

  it('gives two documents due the SAME DAY the same answer', () => {
    // THE DEFECT THIS EXISTS FOR. Eight invoices all printed "Due Sep 8, 2026";
    // seven were raised around 02:41 and one at noon. Counting elapsed
    // milliseconds called the noon one "8 days late" and the rest "9 days late",
    // on the same screen, under the same printed date. The hour a document was
    // raised is an accident of when somebody clicked, and it must never reach
    // the reader.
    const earlyMorning = daysPastDue('2026-09-08T02:41:59.579Z', NOW);
    const midday = daysPastDue('2026-09-08T12:00:00.000Z', NOW);
    const lateEvening = daysPastDue('2026-09-08T23:58:00.000Z', NOW);
    expect(earlyMorning).toBe(8);
    expect(midday).toBe(8);
    expect(lateEvening).toBe(8);
  });

  it('calls a document due today neither late nor early', () => {
    // At 9:30pm in a US timezone the server has already turned over to tomorrow
    // and the reader has not. A bill due today is not late yet.
    expect(daysPastDue('2026-09-16T12:00:00.000Z', NOW)).toBe(0);
  });

  it('is negative while the date is still ahead', () => {
    expect(daysPastDue('2026-09-22T12:00:00.000Z', NOW)).toBe(-6);
  });

  it('is null, not zero, when nobody set a date', () => {
    // "No deadline" and "due today" are different facts. Rendering the first as
    // the second invents a deadline nobody agreed to.
    expect(daysPastDue(null, NOW)).toBeNull();
    expect(daysPastDue(undefined, NOW)).toBeNull();
  });

  it('holds across a month end', () => {
    expect(daysPastDue('2026-08-31T23:00:00.000Z', NOW)).toBe(16);
    expect(daysPastDue('2026-09-01T01:00:00.000Z', NOW)).toBe(15);
  });
});
