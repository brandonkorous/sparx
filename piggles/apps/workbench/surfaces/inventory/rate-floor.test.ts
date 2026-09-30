import { describe, expect, it } from 'vitest';
import { RATE_FLOOR, pickingRate, ratePercent } from './picking-data';

/**
 * "CAME UP SHORT 50.0%" - OUT OF TWO LINES.
 *
 * Juniper Row has picked two lines in her life. One came up short, so the pack
 * report told her in red that she came up short **50.0%** of the time, put the
 * same red beside her name in the picker table, and headed the shelf table
 * **"Shelves that keep coming up empty"** over a single event.
 *
 * One decimal place of precision, out of two events.
 *
 * The rule was already in this pane, on the one figure that got it: `pickingRate`
 * refuses to divide by a window under a minute and says why instead. Four other
 * figures on the same screen divided by whatever they were handed.
 */
const up = (r: number) => (r >= 90 ? 'success' : r >= 50 ? 'warning' : 'danger');
const down = (r: number) => (r >= 10 ? 'danger' : r >= 3 ? 'warning' : 'success');

describe('ratePercent', () => {
  it('will not make a percentage out of two events', () => {
    const f = ratePercent(1, 2, down, 1);
    expect(f.text).toBe('1 of 2');
    expect(f.text).not.toContain('%');
    expect(f.enough).toBe(false);
  });

  it('gives a count no alarm color, because one event is not a trend', () => {
    // 1 of 2 is 50%, which `down` calls danger. The count must not wear it.
    expect(ratePercent(1, 2, down).tone).toBeNull();
    expect(ratePercent(0, 2, up).tone).toBeNull();
  });

  it('starts being a rate at the floor and not before', () => {
    expect(ratePercent(1, RATE_FLOOR - 1, down).enough).toBe(false);
    expect(ratePercent(1, RATE_FLOOR, down).enough).toBe(true);
    expect(ratePercent(1, RATE_FLOOR, down).text).toBe('10%');
  });

  it('colors a real rate, and the two rates point opposite ways', () => {
    // A short rate is bad when HIGH; a scan rate is bad when LOW. One helper
    // that pretended otherwise is how a dashboard goes green on the wrong thing.
    expect(ratePercent(40, 100, down).tone).toBe('danger');
    expect(ratePercent(40, 100, up).tone).toBe('danger');
    expect(ratePercent(99, 100, down).tone).toBe('danger');
    expect(ratePercent(99, 100, up).tone).toBe('success');
  });

  it('says nothing at all when nothing was measured', () => {
    const f = ratePercent(0, 0, down);
    expect(f.text).toBe('\u2014');
    expect(f.tone).toBeNull();
    expect(f.enough).toBe(false);
  });

  it('spends a decimal place only where one is asked for', () => {
    expect(ratePercent(1, 3000, down, 1).text).toBe('0.0%');
    expect(ratePercent(1, 3000, down, 0).text).toBe('0%');
  });
});

describe('pickingRate, the figure that already had the rule', () => {
  it('refuses a rate from a window too short to have one', () => {
    const r = pickingRate(1, 0);
    expect(r.value).toBe('\u2014');
    expect(r.hint).toContain('too close together in time');
  });

  it('gives one once there is a window', () => {
    expect(pickingRate(30, 60).value).toBe('30.0');
  });
});
