import { describe, expect, it } from 'vitest';
import { certificationState, daysUntilExpiry } from './certifications.js';
import { clockedMinutes } from './time.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
const TODAY = day('2026-03-15');

describe('certificationState', () => {
  it('is expired the day after it lapses', () => {
    expect(certificationState({ expiresOn: day('2026-03-14'), reminderLeadDays: 30 }, TODAY)).toBe(
      'expired'
    );
  });

  it('is still valid on the last day', () => {
    // An inspection certificate is good UNTIL its expiry date, not up to the day
    // before. Getting this off by one takes a van off the road a day early.
    expect(certificationState({ expiresOn: day('2026-03-15'), reminderLeadDays: 0 }, TODAY)).toBe(
      'expiring'
    );
  });

  it('is expiring once inside the lead window', () => {
    expect(certificationState({ expiresOn: day('2026-04-01'), reminderLeadDays: 30 }, TODAY)).toBe(
      'expiring'
    );
  });

  it('is valid outside the lead window', () => {
    expect(certificationState({ expiresOn: day('2026-06-01'), reminderLeadDays: 30 }, TODAY)).toBe(
      'valid'
    );
  });

  it('reports NO expiry as its own state, never as urgent', () => {
    // THE load-bearing one. A qualification that does not expire must not read
    // as "expiring today" or sort to the top of a list whose entire job is
    // showing what needs attention — an absent value is not a measured one.
    const state = certificationState({ expiresOn: null, reminderLeadDays: 30 }, TODAY);
    expect(state).toBe('none');
    expect(state).not.toBe('expiring');
    expect(state).not.toBe('expired');
  });

  it('respects a per-certification lead time', () => {
    // Something renewed by post needs more notice than something renewed online,
    // which is why the lead is per row rather than a global setting.
    const expires = { expiresOn: day('2026-05-01') };
    expect(certificationState({ ...expires, reminderLeadDays: 7 }, TODAY)).toBe('valid');
    expect(certificationState({ ...expires, reminderLeadDays: 90 }, TODAY)).toBe('expiring');
  });
});

describe('daysUntilExpiry', () => {
  it('counts forward, and negative once lapsed', () => {
    expect(daysUntilExpiry(day('2026-03-20'), TODAY)).toBe(5);
    expect(daysUntilExpiry(day('2026-03-10'), TODAY)).toBe(-5);
    expect(daysUntilExpiry(day('2026-03-15'), TODAY)).toBe(0);
  });

  it('returns null for something that never expires', () => {
    // Not Infinity and not a big number — both of those sort and format as
    // though somebody had measured them.
    expect(daysUntilExpiry(null, TODAY)).toBeNull();
  });
});

describe('clockedMinutes', () => {
  it('subtracts the break from the span', () => {
    expect(
      clockedMinutes(new Date('2026-03-02T09:00:00Z'), new Date('2026-03-02T17:00:00Z'), 30)
    ).toBe(450);
  });

  it('floors to the minute rather than rounding up', () => {
    // 7m59s is seven worked minutes. Rounding up systematically pays for time
    // nobody worked, which across a fortnight of short jobs is real money.
    expect(
      clockedMinutes(new Date('2026-03-02T09:00:00Z'), new Date('2026-03-02T09:07:59Z'), 0)
    ).toBe(7);
  });

  it('never goes negative when the break is longer than the shift', () => {
    // A data-entry mistake, and the honest answer is zero — a negative would
    // credit the business for labour it did not receive.
    expect(
      clockedMinutes(new Date('2026-03-02T09:00:00Z'), new Date('2026-03-02T09:30:00Z'), 60)
    ).toBe(0);
  });
});
