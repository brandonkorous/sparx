// The booking button names the DAY as well as the time, on the business's clock
// (sparx persona issue 086). "Book 9:00 AM" under a calendar the reader has just
// scrolled through does not say which 9:00 AM they are agreeing to.

import { describe, expect, it } from 'vitest';

import { bookButtonLabel, formatDayAndTime } from './booking-clock';

const DENVER = 'America/Denver';
// Saturday, October 3, 2026 at 9:00 AM in Salt Lake City.
const RENEE = '2026-10-03T15:00:00.000Z';

describe('the booking button says which day', () => {
  it('names the day and the time on the business clock', () => {
    expect(formatDayAndTime(RENEE, DENVER)).toBe('Sat, Oct 3 at 9:00 AM');
  });

  it('reads "Book Sat, Oct 3 at 9:00 AM", with the zone only when the reader is elsewhere', () => {
    expect(bookButtonLabel(RENEE, DENVER)).toMatch(/^Book Sat, Oct 3 at 9:00 AM( MDT)?$/);
  });

  it('keeps the business day when the reader is a day ahead', () => {
    // 9:00 PM Friday in Denver is already Saturday in UTC.
    expect(formatDayAndTime('2026-10-03T03:00:00.000Z', DENVER)).toBe('Fri, Oct 2 at 9:00 PM');
  });
});
