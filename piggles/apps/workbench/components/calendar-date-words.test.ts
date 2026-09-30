import { describe, expect, it } from 'vitest';
import { calendarDateText } from './calendar-date-words';

/**
 * A BALANCE RECORDED ON THE 19TH, FILED UNDER THE 18TH.
 *
 * "Stock versus your books" keys its rows on the day, and its own copy promises
 * "recorded per date, so last year's reconciliation keeps saying what it said".
 * The row was stored correctly as `2026-09-19`, came back as
 * `2026-09-19T00:00:00.000Z`, and a `<Timestamp>` drew it in the reader's zone.
 * Seven hours behind UTC, that is Sep 18.
 *
 * `<Timestamp>` is not at fault: it is for moments, and it renders them where
 * the reader is. A calendar date is not a moment.
 *
 * These run in whatever zone the machine is set to, so they assert that the day
 * SURVIVES rather than asserting a formatted string, which would only pass in
 * one zone and hide the bug in every other.
 */
describe('calendarDateText', () => {
  it('draws the day that was stored, whatever zone the reader is in', () => {
    expect(calendarDateText('2026-09-19')).toContain('19');
    expect(calendarDateText('2026-09-19')).toContain('2026');
    expect(calendarDateText('2026-09-19')).not.toContain('18');
  });

  it('does not slip on the first of a month, which is where it slips', () => {
    // Midnight UTC on the 1st is the previous month for anyone behind UTC.
    expect(calendarDateText('2026-01-01')).toContain('1');
    expect(calendarDateText('2026-01-01')).toContain('2026');
    expect(calendarDateText('2026-01-01')).not.toContain('31');
    expect(calendarDateText('2026-01-01')).not.toContain('2025');
  });

  it('does not slip on the last of a month either', () => {
    // And midnight UTC on the 31st is the next day for anyone ahead of it.
    const words = calendarDateText('2026-03-31');
    expect(words).toContain('31');
    expect(words).not.toContain('30');
  });

  it('takes a longer ISO string and still draws the stored day', () => {
    // A column not yet converted on the server must not go backwards here.
    expect(calendarDateText('2026-09-19T00:00:00.000Z')).toBe(calendarDateText('2026-09-19'));
  });

  it('can leave the year off for a recent row', () => {
    expect(calendarDateText('2026-09-19', false)).not.toContain('2026');
    expect(calendarDateText('2026-09-19', false)).toContain('19');
  });

  it('gives back what it was handed rather than inventing a date', () => {
    expect(calendarDateText('not a date')).toBe('not a date');
  });
});
