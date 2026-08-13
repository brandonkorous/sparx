import { describe, expect, it } from 'vitest';
import {
  applyBurden,
  daysInYear,
  dayKey,
  hourlyCostCents,
  inclusiveDayCount,
  rateInForceOn,
  rateSegments,
  salaryCostCents,
  windowsOverlap,
  type PayRate,
} from './pay.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

function rate(over: Partial<PayRate> & Pick<PayRate, 'id' | 'effectiveFrom'>): PayRate {
  return {
    basis: 'hourly',
    amountCents: 2500,
    currency: 'USD',
    burdenPercent: 0,
    effectiveTo: null,
    ...over,
  };
}

describe('calendar helpers', () => {
  it('reads a date in UTC, so a boundary does not move west of Greenwich', () => {
    // Prisma hands a @db.Date back at UTC midnight. Local getters would report
    // the previous day for anyone in the Americas — and a pay rate that starts a
    // day early is a rate applied to work it never covered.
    expect(dayKey(new Date('2026-03-01T00:00:00.000Z'))).toBe('2026-03-01');
  });

  it('counts days inclusively, so a one-day period is one day and not zero', () => {
    expect(inclusiveDayCount(day('2026-03-01'), day('2026-03-01'))).toBe(1);
    expect(inclusiveDayCount(day('2026-03-01'), day('2026-03-31'))).toBe(31);
  });

  it('counts nothing for a backwards range rather than a negative', () => {
    expect(inclusiveDayCount(day('2026-03-31'), day('2026-03-01'))).toBe(0);
  });

  it('knows a leap year', () => {
    expect(daysInYear(2026)).toBe(365);
    expect(daysInYear(2028)).toBe(366);
    expect(daysInYear(2100)).toBe(365);
    expect(daysInYear(2000)).toBe(366);
  });
});

describe('rateInForceOn', () => {
  const rates = [
    rate({
      id: 'old',
      amountCents: 2000,
      effectiveFrom: day('2025-01-01'),
      effectiveTo: day('2026-02-28'),
    }),
    rate({ id: 'new', amountCents: 2500, effectiveFrom: day('2026-03-01') }),
  ];

  it('picks the window the day falls in', () => {
    expect(rateInForceOn(rates, day('2026-01-15'))?.id).toBe('old');
    expect(rateInForceOn(rates, day('2026-03-15'))?.id).toBe('new');
  });

  it('includes both ends of a closed window', () => {
    expect(rateInForceOn(rates, day('2025-01-01'))?.id).toBe('old');
    expect(rateInForceOn(rates, day('2026-02-28'))?.id).toBe('old');
  });

  it('returns NULL before anyone was hired — never a zero rate', () => {
    // The whole point. A defaulted zero would tell an owner that a week of
    // someone's labour cost nothing, which is a measurement they never made.
    const result = rateInForceOn(rates, day('2024-06-01'));
    expect(result).toBeNull();
    expect(result?.amountCents).not.toBe(0);
  });

  it('lets a later start supersede an unclosed older row', () => {
    const messy = [
      rate({ id: 'never-closed', amountCents: 2000, effectiveFrom: day('2025-01-01') }),
      rate({ id: 'correction', amountCents: 3000, effectiveFrom: day('2026-03-01') }),
    ];
    expect(rateInForceOn(messy, day('2026-06-01'))?.id).toBe('correction');
  });
});

describe('windowsOverlap', () => {
  it('detects a shared day', () => {
    expect(
      windowsOverlap(
        { effectiveFrom: day('2026-01-01'), effectiveTo: day('2026-06-30') },
        { effectiveFrom: day('2026-06-30'), effectiveTo: null }
      )
    ).toBe(true);
  });

  it('allows a window that starts the day after another ends', () => {
    expect(
      windowsOverlap(
        { effectiveFrom: day('2026-01-01'), effectiveTo: day('2026-06-30') },
        { effectiveFrom: day('2026-07-01'), effectiveTo: null }
      )
    ).toBe(false);
  });

  it('treats an open-ended window as running forever', () => {
    expect(
      windowsOverlap(
        { effectiveFrom: day('2025-01-01'), effectiveTo: null },
        { effectiveFrom: day('2030-01-01'), effectiveTo: null }
      )
    ).toBe(true);
  });
});

describe('rateSegments', () => {
  it('splits a period at a mid-period raise', () => {
    const rates = [
      rate({
        id: 'before',
        amountCents: 2000,
        effectiveFrom: day('2025-01-01'),
        effectiveTo: day('2026-03-14'),
      }),
      rate({ id: 'after', amountCents: 2500, effectiveFrom: day('2026-03-15') }),
    ];
    const segments = rateSegments(rates, day('2026-03-01'), day('2026-03-31'));
    expect(segments.map((s) => [s.rate.id, s.days])).toEqual([
      ['before', 14],
      ['after', 17],
    ]);
    // The two halves must account for the whole month; a gap here is a day of
    // labour that costs nothing and nobody notices.
    expect(segments.reduce((sum, s) => sum + s.days, 0)).toBe(31);
  });

  it('leaves an uncovered stretch OUT rather than extending a neighbouring rate', () => {
    const rates = [rate({ id: 'hired-mid-month', effectiveFrom: day('2026-03-10') })];
    const segments = rateSegments(rates, day('2026-03-01'), day('2026-03-31'));
    expect(segments).toHaveLength(1);
    expect(segments[0]?.days).toBe(22);
    expect(segments[0] && dayKey(segments[0].from)).toBe('2026-03-10');
  });

  it('produces two segments when a rate lapses and resumes', () => {
    const rates = [
      rate({ id: 'first', effectiveFrom: day('2026-03-01'), effectiveTo: day('2026-03-10') }),
      rate({ id: 'second', effectiveFrom: day('2026-03-20') }),
    ];
    const segments = rateSegments(rates, day('2026-03-01'), day('2026-03-31'));
    expect(segments.map((s) => s.rate.id)).toEqual(['first', 'second']);
    expect(segments.map((s) => s.days)).toEqual([10, 12]);
  });
});

describe('applyBurden', () => {
  it('adds the employer share in integer cents', () => {
    // $100.00 at 22.5% burden = $122.50, and it must land there exactly rather
    // than at 12249 or 12251 — money never goes through a float here.
    expect(applyBurden(10_000, 22.5)).toBe(12_250);
  });

  it('is a no-op at zero', () => {
    expect(applyBurden(9_999, 0)).toBe(9_999);
  });

  it('rounds a half-cent up rather than truncating it away', () => {
    // 1 cent at 50% is half a cent. Truncation would make burden free on small
    // figures, which across a month of short entries is a real shortfall.
    expect(applyBurden(1, 50)).toBe(2);
  });
});

describe('hourlyCostCents', () => {
  const hourly = rate({ id: 'h', amountCents: 2500, effectiveFrom: day('2026-01-01') });

  it('costs a whole hour at the rate', () => {
    expect(hourlyCostCents(hourly, 60)).toBe(2500);
  });

  it('costs part of an hour proportionally', () => {
    expect(hourlyCostCents(hourly, 90)).toBe(3750);
    expect(hourlyCostCents(hourly, 7)).toBe(292); // 25.00 * 7/60 = 2.9166…
  });

  it('adds burden on top of the hours, not beside them', () => {
    const withBurden = rate({
      id: 'h2',
      amountCents: 2500,
      burdenPercent: 20,
      effectiveFrom: day('2026-01-01'),
    });
    expect(hourlyCostCents(withBurden, 60)).toBe(3000);
  });

  it('costs nothing for a basis that is not hourly', () => {
    const salaried = rate({
      id: 's',
      basis: 'salary',
      amountCents: 5_000_000,
      effectiveFrom: day('2026-01-01'),
    });
    expect(hourlyCostCents(salaried, 480)).toBe(0);
  });
});

describe('salaryCostCents', () => {
  const salary = rate({
    id: 's',
    basis: 'salary',
    amountCents: 5_200_000, // $52,000 a year
    effectiveFrom: day('2026-01-01'),
  });

  it('amortises by days, so February costs less than March', () => {
    const feb = salaryCostCents(salary, 28);
    const mar = salaryCostCents(salary, 31);
    expect(mar).toBeGreaterThan(feb);
    expect(feb).toBe(Math.round((5_200_000 * 28) / 365));
  });

  it('sums back to the annual figure across a whole year, within rounding', () => {
    // Twelve monthly runs must not quietly drift away from the salary that was
    // typed in — a P&L that is $40 out every year is a P&L someone stops trusting.
    const monthLengths = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    const total = monthLengths.reduce((sum, days) => sum + salaryCostCents(salary, days), 0);
    expect(Math.abs(total - 5_200_000)).toBeLessThanOrEqual(12);
  });

  it('costs nothing for a basis that is not salary', () => {
    const hourly = rate({ id: 'h', amountCents: 2500, effectiveFrom: day('2026-01-01') });
    expect(salaryCostCents(hourly, 31)).toBe(0);
  });
});
