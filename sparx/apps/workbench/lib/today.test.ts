import { describe, expect, it } from 'vitest';
import {
  dayBoxProblem,
  dayFromStored,
  dayIso,
  dayStartUtc,
  HALF_A_DAY,
  NOT_A_DATE,
  pickedDayUtc,
  todayIso,
  todayStartUtc,
} from './today';

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
    expect(saved).not.toBeNull();
    expect(new Date(saved ?? '').toISOString().slice(0, 10)).toBe('2026-09-30');
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

describe('dayStartUtc refuses what is not a day', () => {
  /**
   * "THIS PANEL RAN INTO A PROBLEM", FROM ONE MISTYPED YEAR.
   *
   * Money -> Bills to pay -> Shop rent, September, 2026-09-16. The empty "Late"
   * tab had just told the owner to open a cost and fill in "Due by", so she did.
   * A slip in the year box, and the whole editor was replaced by an error card,
   * taking the unsaved edit with it:
   *
   *     RangeError: Invalid time value
   *       at Date.toISOString
   *       at dayStartUtc            (lib/today.ts)
   *       at dateValue              (finance/expense-detail.tsx)
   *       at toDraft
   *       at ExpenseDetail.useMemo[draft]
   *
   * `<input type="date">` does not promise a real date. Chrome's year box takes
   * SIX digits (verified in the page: setting "20266-09-01" and "275760-09-13"
   * both read straight back out), so `new Date("20266-09-01T00:00:00.000Z")` is
   * an Invalid Date and `toISOString()` throws. The call sat in a render-time
   * `useMemo`, so the throw reached the error boundary rather than a catch.
   *
   * A function that is handed form values has to be TOTAL. Null is a result the
   * caller can show; an exception during render is not.
   */
  it('turns a real day into midnight UTC', () => {
    expect(dayStartUtc('2026-09-15')).toBe('2026-09-15T00:00:00.000Z');
  });

  it('returns null for the five- and six-digit years the date box allows', () => {
    expect(dayStartUtc('20266-09-01')).toBeNull();
    expect(dayStartUtc('275760-09-13')).toBeNull();
  });

  it('returns null rather than throwing on anything unparseable', () => {
    for (const bad of ['', 'abc', '2026-13-01', '2026-09', '2026/09/01', '  ']) {
      expect(() => dayStartUtc(bad)).not.toThrow();
      expect(dayStartUtc(bad)).toBeNull();
    }
  });

  it('returns null for a day that does not exist, rather than the day after', () => {
    // `new Date` accepts 2026-02-30 and rolls it to March 2. Handing back a day
    // nobody typed is the same class of lie as crashing.
    expect(dayStartUtc('2026-02-30')).toBeNull();
    expect(dayStartUtc('2026-02-28')).toBe('2026-02-28T00:00:00.000Z');
  });

  it('keeps a leap day', () => {
    expect(dayStartUtc('2028-02-29')).toBe('2028-02-29T00:00:00.000Z');
  });
});

/**
 * THE DAY A BUYER TYPED AND A DIFFERENT DAY SHE READ BACK.
 *
 * MEASURED 2026-09-18 in Los Angeles. A buyer opened a purchase order, typed
 * `09 / 10 / 2026` into "New expected date", pressed Record it, and got "New
 * date recorded". The Order details panel a few inches above then read
 * **September 9, 2026**.
 *
 * Nothing had failed. The order had TWO controls on one field and they did not
 * agree: one stored the day at UTC midnight, the other stored whatever local
 * midnight happened to be, and the formatter printed in the reader's own zone.
 * UTC midnight printed in Los Angeles is five o'clock the previous evening, so
 * the day came back one short.
 *
 * `dayMiddayUtc` above carries this same warning for invoicing, which met the
 * same bug first. Buying never got it.
 *
 * Every fixture is built with the LOCAL date constructor, so each means a wall
 * clock rather than an instant and the guards say the same thing on every
 * machine, UTC included.
 */
describe('a picked day survives the round trip', () => {
  it('stores the day the person saw, not local midnight pushed into UTC', () => {
    // A date control hands back LOCAL midnight. `toISOString()` on that is
    // 07:00Z in Los Angeles and the PREVIOUS day at 23:00Z in Berlin, which is
    // the whole defect.
    expect(pickedDayUtc(new Date(2026, 8, 10))).toBe('2026-09-10T00:00:00.000Z');
  });

  it('keeps the day whatever time of day the control was used', () => {
    for (const at of [
      new Date(2026, 8, 10, 0, 0),
      new Date(2026, 8, 10, 12, 30),
      new Date(2026, 8, 10, 23, 59),
    ]) {
      expect(pickedDayUtc(at)).toBe('2026-09-10T00:00:00.000Z');
    }
  });

  it('gives the same day back to the control that stored it', () => {
    const picked = new Date(2026, 8, 10);
    const stored = pickedDayUtc(picked);
    const shown = dayFromStored(stored);
    expect(shown).not.toBeNull();
    expect(shown?.getFullYear()).toBe(2026);
    expect(shown?.getMonth()).toBe(8);
    expect(shown?.getDate()).toBe(10);
  });

  it('reads a day stored the OLD way back as the same day', () => {
    // Rows already in the table were written as local midnight by the other
    // control. Taking the UTC calendar day off them still lands on the day that
    // was typed for every reader west of Greenwich, so the reader can be fixed
    // without a data migration.
    const shown = dayFromStored('2026-09-04T07:00:00.000Z');
    expect(shown?.getMonth()).toBe(8);
    expect(shown?.getDate()).toBe(4);
  });

  it('carries a month end and a leap day across', () => {
    expect(pickedDayUtc(new Date(2026, 8, 30))).toBe('2026-09-30T00:00:00.000Z');
    expect(pickedDayUtc(new Date(2028, 1, 29))).toBe('2028-02-29T00:00:00.000Z');
  });

  it('says nothing rather than guessing, on nothing', () => {
    expect(pickedDayUtc(null)).toBeNull();
    expect(pickedDayUtc(undefined)).toBeNull();
    expect(pickedDayUtc(new Date('nonsense'))).toBeNull();
    expect(dayFromStored(null)).toBeNull();
    expect(dayFromStored('')).toBeNull();
    expect(dayFromStored('not a date')).toBeNull();
  });
});

/**
 * THE DATE THAT WAS TYPED AND NOT SAVED.
 *
 * A wholesale price was being agreed until the end of March. The date box took
 * "03", "31" and "2027" and showed all three on screen. The form read the box,
 * got the empty string, decided no end date had been given, and lit its button
 * with the words "Set this price" instead of "Record this agreement".
 *
 * A native date box holds three cells and reports a value only when all three
 * are filled. Until then `value` is "" and `validity.badInput` is true, and
 * every one of the 82 date boxes in the two consoles read the first and asked
 * nothing about the second. Issue 741.
 */
describe('dayBoxProblem', () => {
  it('says nothing about an empty box, because empty is a different question', () => {
    expect(dayBoxProblem('', false)).toBeNull();
  });

  it('says nothing about a real day', () => {
    expect(dayBoxProblem('2027-03-31', false)).toBeNull();
  });

  it('catches the half-typed box the value cannot describe', () => {
    // The state that shipped invisibly: what the control reports is EMPTY, and
    // the only thing that knows better is the control's own validity.
    expect(dayBoxProblem('', true)).toBe(HALF_A_DAY);
  });

  it('still catches a complete date that is not a real day', () => {
    expect(dayBoxProblem('2027-02-31', false)).toBe(NOT_A_DATE);
  });

  it('tells the two apart, because the remedies are different', () => {
    // "Finish it" and "that is not a date" send a person to do different
    // things. [[feedback_one_outcome_two_causes]]
    expect(dayBoxProblem('', true)).not.toBe(dayBoxProblem('2027-02-31', false));
  });
});
