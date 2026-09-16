import { describe, expect, it } from 'vitest';
import { dayIso, dayStartUtc, todayIso, todayStartUtc } from './today';

/**
 * THE EVENING A COST DISAPPEARED.
 *
 * At 22:00 on Tuesday 15 September in Los Angeles, a shop recorded $12.50 of
 * horn buttons. The row said "Cost recorded". The list, still open above it,
 * went on saying 3 costs and $2,136.80, and a full reload did not bring the
 * fourth one back.
 *
 * It had saved. `incurred_at` was `2026-09-16 04:58:55+00`, because the row
 * stamped `new Date().toISOString()` and in UTC it was already Wednesday. The
 * list asks for `2026-09-01` to `2026-09-15` — the local calendar day, which
 * `period.ts` had right all along. So the cost was stamped a day that had not
 * started where she was standing, and no range ending today could reach it.
 *
 * The cost form's own default did the same thing a different way: it offered
 * `2026-09-16` in the date box while her wall said the fifteenth.
 *
 * On the LAST day of a month that is not a few hours of confusion. A cost
 * entered at six in the evening on 30 September belongs to October from then
 * on, so one month's figures are short and the next month's are long, and
 * nothing on any screen says so.
 *
 * Every fixture below is built with the LOCAL date constructor, so each one
 * means a wall clock rather than an instant and the guards say the same thing
 * on every machine. A test that asked the real clock what day it is would agree
 * with the bug for seventeen hours out of twenty-four.
 */
describe('today, as the person reading the screen would say it', () => {
  it('answers the day on the wall in front of the reader', () => {
    // Tuesday evening, the fifteenth, wherever this runs.
    expect(todayIso(new Date(2026, 8, 15, 22, 0, 18))).toBe('2026-09-15');
    expect(dayIso(new Date(2026, 8, 15, 22, 0, 18))).toBe('2026-09-15');
  });

  it('still says the fifteenth one minute before midnight', () => {
    // The hours the defect lived in. Anywhere west of UTC this instant is
    // already the sixteenth in UTC, and `toISOString().slice(0, 10)` said so.
    expect(todayIso(new Date(2026, 8, 15, 23, 59, 59))).toBe('2026-09-15');
  });

  it('does not answer the UTC day, wherever that differs from the wall', () => {
    // Asserted as an inequality, because "equals the local day" passes just as
    // happily on a machine set to UTC — where the defect cannot show at all. On
    // such a machine there is nothing to separate, and the guard says so rather
    // than asserting something untrue.
    const lateEvening = new Date(2026, 8, 15, 22, 0, 18);
    const utcDay = lateEvening.toISOString().slice(0, 10);
    if (lateEvening.getTimezoneOffset() > 0) {
      expect(todayIso(lateEvening)).not.toBe(utcDay);
    }
    expect(todayIso(lateEvening)).toBe('2026-09-15');
  });

  it('pads a single-digit month and day, so the server can read it', () => {
    expect(dayIso(new Date(2026, 0, 5, 12, 0, 0))).toBe('2026-01-05');
    expect(dayIso(new Date(2026, 11, 31, 12, 0, 0))).toBe('2026-12-31');
  });

  it('keeps a day at midnight UTC, which is where the server keeps one', () => {
    expect(dayStartUtc('2026-09-15')).toBe('2026-09-15T00:00:00.000Z');
  });

  it('does not slide a day backwards on the way to midnight and out again', () => {
    // The round trip a form makes: show a day, save it, read it back. A LOCAL
    // midnight here would come back as the day before for anyone east of UTC.
    const saved = dayStartUtc('2026-09-30');
    expect(new Date(saved).toISOString().slice(0, 10)).toBe('2026-09-30');
  });

  it("stamps the reader's own day, at that midnight, in one step", () => {
    // What the quick cost row saves. It has no date field to show, so both
    // halves happen at once and neither can be got wrong on its own.
    const lateEvening = new Date(2026, 8, 15, 22, 0, 18);
    expect(todayStartUtc(lateEvening)).toBe('2026-09-15T00:00:00.000Z');
    // The defect, stated: the raw instant is NOT what may be stored.
    expect(todayStartUtc(lateEvening)).not.toBe(lateEvening.toISOString());
  });

  it('puts the last evening of a month in that month, not the next one', () => {
    // The expensive case. Six in the evening on 30 September is 1 October in
    // UTC, and a cost stamped that way leaves September's books for good.
    const monthEnd = new Date(2026, 8, 30, 18, 0, 0);
    expect(todayIso(monthEnd)).toBe('2026-09-30');
    expect(todayStartUtc(monthEnd)).toBe('2026-09-30T00:00:00.000Z');
  });
});
