// A trial that ends tomorrow says "tomorrow" (persona issue 272): 25 hours left
// read "ends in 2 days", because the server rounds 24-hour blocks up.

import { describe, expect, it } from 'vitest';

import { calendarDaysLeft, staysWords, whenWords } from './days-left';

const view = (phase: 'trialing' | 'grace', end: string, daysLeft: number) =>
  ({ phase, daysLeft, trialEndsAt: end, suspendsAt: end }) as const;

describe('days left, counted on the calendar', () => {
  it('is tomorrow when the end falls on the next day, however many hours', () => {
    const now = new Date('2026-10-14T18:00:00Z');
    expect(calendarDaysLeft(view('trialing', '2026-10-15T19:00:00Z', 2), now)).toBe(1);
    expect(whenWords(1)).toBe('tomorrow');
  });

  it('is today on the last day', () => {
    const now = new Date('2026-10-15T15:00:00Z');
    expect(calendarDaysLeft(view('trialing', '2026-10-15T19:00:00Z', 1), now)).toBe(0);
    expect(whenWords(0)).toBe('today');
  });

  it('counts whole days further out', () => {
    const now = new Date('2026-10-14T18:00:00Z');
    expect(calendarDaysLeft(view('grace', '2026-10-19T18:00:00Z', 5), now)).toBe(5);
    expect(whenWords(5)).toBe('in 5 days');
    expect(staysWords(5)).toBe('for 5 more days');
    expect(staysWords(1)).toBe('until tomorrow');
    expect(staysWords(0)).toBe('until the end of today');
  });

  it('keeps the server count when there is no end to count to', () => {
    expect(
      calendarDaysLeft({ phase: 'trialing', daysLeft: 4, trialEndsAt: null, suspendsAt: null })
    ).toBe(4);
    expect(
      calendarDaysLeft({ phase: 'active', daysLeft: null, trialEndsAt: null, suspendsAt: null })
    ).toBeNull();
  });
});
