import { describe, expect, it } from 'vitest';
import { deriveLabor, type LaborEntry } from './costing.js';
import { periodKey, splitProportionally, type PayRate } from './pay.js';

const day = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);

function rate(over: Partial<PayRate> & Pick<PayRate, 'id' | 'effectiveFrom'>): PayRate {
  return {
    basis: 'hourly',
    amountCents: 2500,
    currency: 'USD',
    burdenPercent: 0,
    effectiveTo: null,
    note: null,
    ...over,
  };
}

function entry(over: Partial<LaborEntry> & Pick<LaborEntry, 'workedOn' | 'minutes'>): LaborEntry {
  return { propertyId: null, jobType: null, jobId: null, ...over };
}

const MARCH = { periodStart: day('2026-03-01'), periodEnd: day('2026-03-31') };

describe('splitProportionally', () => {
  it('splits so the parts sum to exactly the total', () => {
    // 100 across three equal weights is 33.33… each. Naive rounding gives 99 or
    // 102; a job-profitability screen whose parts do not add up to the expense
    // they came from is a screen nobody trusts twice.
    const parts = splitProportionally(100, [1, 1, 1]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(100);
    expect(parts).toEqual([34, 33, 33]);
  });

  it('gives the odd cents to the largest shares first', () => {
    const parts = splitProportionally(1000, [60, 30, 10]);
    expect(parts).toEqual([600, 300, 100]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(1000);
  });

  it('returns zeros when nothing has any weight', () => {
    expect(splitProportionally(5000, [0, 0])).toEqual([0, 0]);
  });

  it('holds over an awkward split', () => {
    const parts = splitProportionally(10_000, [7, 11, 13, 17]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(10_000);
  });
});

describe('periodKey', () => {
  it('names a whole calendar month by the month', () => {
    expect(periodKey(day('2026-03-01'), day('2026-03-31'))).toBe('2026-03');
    expect(periodKey(day('2026-02-01'), day('2026-02-28'))).toBe('2026-02');
  });

  it('names anything else by its span', () => {
    expect(periodKey(day('2026-03-16'), day('2026-03-31'))).toBe('2026-03-16..2026-03-31');
  });

  it('does not mistake a part-month ending on the 31st for the month', () => {
    expect(periodKey(day('2026-03-02'), day('2026-03-31'))).toBe('2026-03-02..2026-03-31');
  });
});

describe('deriveLabor — hourly', () => {
  const rates = [rate({ id: 'h', amountCents: 3000, effectiveFrom: day('2026-01-01') })];

  it('costs each entry at its own hours', () => {
    const result = deriveLabor({
      ...MARCH,
      rates,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 480 }),
        entry({ workedOn: day('2026-03-03'), minutes: 240 }),
      ],
      fallbackPropertyId: 'site-a',
    });
    expect(result.totalCents).toBe(24_000 + 12_000);
    expect(result.perSite).toHaveLength(1);
    expect(result.perSite[0]?.propertyId).toBe('site-a');
    expect(result.perSite[0]?.minutes).toBe(720);
  });

  it('allocates to the job the time was against, and leaves the rest unallocated', () => {
    const result = deriveLabor({
      ...MARCH,
      rates,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 480, jobType: 'order', jobId: 'order-1' }),
        entry({ workedOn: day('2026-03-03'), minutes: 120 }), // no job — sweeping up
      ],
      fallbackPropertyId: 'site-a',
    });
    const site = result.perSite[0];
    expect(site?.allocations).toEqual([
      { targetType: 'order', targetId: 'order-1', amountCents: 24_000 },
    ]);
    // The unattributed two hours stay OUT of the allocations rather than being
    // spread over the job that happened to be recorded.
    expect(site?.amountCents).toBe(30_000);
  });

  it('adds repeated time on one job together', () => {
    const result = deriveLabor({
      ...MARCH,
      rates,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 60, jobType: 'order', jobId: 'order-1' }),
        entry({ workedOn: day('2026-03-04'), minutes: 30, jobType: 'order', jobId: 'order-1' }),
      ],
      fallbackPropertyId: null,
    });
    expect(result.perSite[0]?.allocations).toEqual([
      { targetType: 'order', targetId: 'order-1', amountCents: 4_500 },
    ]);
  });

  it('splits across sites when someone works both businesses', () => {
    const result = deriveLabor({
      ...MARCH,
      rates,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 300, propertyId: 'site-a' }),
        entry({ workedOn: day('2026-03-03'), minutes: 180, propertyId: 'site-b' }),
      ],
      fallbackPropertyId: 'site-a',
    });
    const bySite = Object.fromEntries(result.perSite.map((s) => [s.propertyId, s.amountCents]));
    expect(bySite).toEqual({ 'site-a': 15_000, 'site-b': 9_000 });
  });

  it('applies the rate that was in force on the DAY, not the newest one', () => {
    // The trap the whole effective-dated table exists to prevent: a raise on the
    // 15th must not retro-price the first half of the month.
    const raised = [
      rate({
        id: 'old',
        amountCents: 2000,
        effectiveFrom: day('2025-01-01'),
        effectiveTo: day('2026-03-14'),
      }),
      rate({ id: 'new', amountCents: 3000, effectiveFrom: day('2026-03-15') }),
    ];
    const result = deriveLabor({
      ...MARCH,
      rates: raised,
      entries: [
        entry({ workedOn: day('2026-03-10'), minutes: 60 }),
        entry({ workedOn: day('2026-03-20'), minutes: 60 }),
      ],
      fallbackPropertyId: null,
    });
    expect(result.totalCents).toBe(2000 + 3000);
  });
});

describe('deriveLabor — the unpriced case', () => {
  it('reports hours with no rate in force instead of costing them at zero', () => {
    // THE load-bearing test. Someone worked, nobody has recorded what they earn,
    // and the only honest output is "we cannot price this" — never $0.00, which
    // an owner reads as free labour.
    const result = deriveLabor({
      ...MARCH,
      rates: [rate({ id: 'h', effectiveFrom: day('2026-03-15') })],
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 480 }),
        entry({ workedOn: day('2026-03-03'), minutes: 90 }),
        entry({ workedOn: day('2026-03-20'), minutes: 60 }),
      ],
      fallbackPropertyId: null,
    });
    expect(result.unpricedMinutes).toBe(570);
    expect(result.unpricedDays).toEqual(['2026-03-02', '2026-03-03']);
    // Only the one priced hour reached the ledger.
    expect(result.totalCents).toBe(2500);
  });

  it('derives NOTHING at all when no rate has ever been set', () => {
    const result = deriveLabor({
      ...MARCH,
      rates: [],
      entries: [entry({ workedOn: day('2026-03-02'), minutes: 480 })],
      fallbackPropertyId: 'site-a',
    });
    expect(result.perSite).toEqual([]);
    expect(result.totalCents).toBe(0);
    expect(result.unpricedMinutes).toBe(480);
  });

  it('treats a `none` basis as a real zero, NOT as unpriced', () => {
    // A volunteer's hours genuinely cost nothing. That is a measured answer, so
    // it must not appear on the "needs a pay rate" list next to the ones that
    // are actually missing — the distinction is the whole point of both.
    const result = deriveLabor({
      ...MARCH,
      rates: [rate({ id: 'v', basis: 'none', amountCents: 0, effectiveFrom: day('2026-01-01') })],
      entries: [entry({ workedOn: day('2026-03-02'), minutes: 480 })],
      fallbackPropertyId: null,
    });
    expect(result.totalCents).toBe(0);
    expect(result.unpricedMinutes).toBe(0);
    expect(result.bases).toEqual(['none']);
  });

  it('leaves a commission-only person out of wages entirely', () => {
    // Their pay reaches the ledger as a StaffCommission. Counting it here too
    // would bill the business twice for one person.
    const result = deriveLabor({
      ...MARCH,
      rates: [
        rate({ id: 'c', basis: 'commission', amountCents: 0, effectiveFrom: day('2026-01-01') }),
      ],
      entries: [entry({ workedOn: day('2026-03-02'), minutes: 480 })],
      fallbackPropertyId: null,
    });
    expect(result.totalCents).toBe(0);
    expect(result.unpricedMinutes).toBe(0);
  });
});

describe('deriveLabor — salary', () => {
  const salaried = [
    rate({
      id: 's',
      basis: 'salary',
      amountCents: 7_300_000, // $73,000 — 365 days, so $200/day exactly
      effectiveFrom: day('2026-01-01'),
    }),
  ];

  it('costs the calendar, not the timesheet', () => {
    // A salary is incurred whether or not anyone logged time. Deriving it from
    // hours would make a quiet month look cheap and a busy one look expensive,
    // which is the opposite of what a salary means.
    const worked = deriveLabor({
      ...MARCH,
      rates: salaried,
      entries: [entry({ workedOn: day('2026-03-02'), minutes: 480 })],
      fallbackPropertyId: 'site-a',
    });
    const quiet = deriveLabor({
      ...MARCH,
      rates: salaried,
      entries: [],
      fallbackPropertyId: 'site-a',
    });
    expect(worked.totalCents).toBe(31 * 20_000);
    expect(quiet.totalCents).toBe(31 * 20_000);
  });

  it('attributes the amortised cost across jobs by share of logged time', () => {
    const result = deriveLabor({
      ...MARCH,
      rates: salaried,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 300, jobType: 'order', jobId: 'order-1' }),
        entry({
          workedOn: day('2026-03-03'),
          minutes: 100,
          jobType: 'booking',
          jobId: 'booking-1',
        }),
      ],
      fallbackPropertyId: 'site-a',
    });
    const site = result.perSite[0];
    expect(site?.amountCents).toBe(620_000);
    const allocated = (site?.allocations ?? []).reduce((sum, a) => sum + a.amountCents, 0);
    // Every logged minute was on a job, so all of it attributes — and the parts
    // sum to the whole rather than drifting a cent.
    expect(allocated).toBe(620_000);
    expect(site?.allocations.find((a) => a.targetId === 'order-1')?.amountCents).toBe(465_000);
  });

  it('leaves the share of unlogged time unallocated rather than inflating the jobs', () => {
    const result = deriveLabor({
      ...MARCH,
      rates: salaried,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 100, jobType: 'order', jobId: 'order-1' }),
        entry({ workedOn: day('2026-03-03'), minutes: 300 }), // admin, no job
      ],
      fallbackPropertyId: 'site-a',
    });
    const site = result.perSite[0];
    const allocated = (site?.allocations ?? []).reduce((sum, a) => sum + a.amountCents, 0);
    expect(site?.amountCents).toBe(620_000);
    expect(allocated).toBe(155_000); // a quarter of the minutes, a quarter of the cost
    expect(allocated).toBeLessThan(site?.amountCents ?? 0);
  });

  it('costs a mid-period raise as two segments', () => {
    const raised = [
      rate({
        id: 'before',
        basis: 'salary',
        amountCents: 7_300_000,
        effectiveFrom: day('2025-01-01'),
        effectiveTo: day('2026-03-15'),
      }),
      rate({
        id: 'after',
        basis: 'salary',
        amountCents: 10_950_000, // $300/day
        effectiveFrom: day('2026-03-16'),
      }),
    ];
    const result = deriveLabor({
      ...MARCH,
      rates: raised,
      entries: [],
      fallbackPropertyId: 'site-a',
    });
    expect(result.totalCents).toBe(15 * 20_000 + 16 * 30_000);
  });

  it('splits an amortised salary across two businesses by logged time', () => {
    const result = deriveLabor({
      ...MARCH,
      rates: salaried,
      entries: [
        entry({ workedOn: day('2026-03-02'), minutes: 450, propertyId: 'site-a' }),
        entry({ workedOn: day('2026-03-03'), minutes: 150, propertyId: 'site-b' }),
      ],
      fallbackPropertyId: 'site-a',
    });
    const bySite = Object.fromEntries(result.perSite.map((s) => [s.propertyId, s.amountCents]));
    expect(bySite['site-a']).toBe(465_000);
    expect(bySite['site-b']).toBe(155_000);
    expect(result.totalCents).toBe(620_000);
  });
});

describe('deriveLabor — mixed bases in one period', () => {
  it('costs an hourly first half and a salaried second half each their own way', () => {
    const rates = [
      rate({
        id: 'hourly',
        amountCents: 3000,
        effectiveFrom: day('2025-01-01'),
        effectiveTo: day('2026-03-15'),
      }),
      rate({
        id: 'salary',
        basis: 'salary',
        amountCents: 7_300_000,
        effectiveFrom: day('2026-03-16'),
      }),
    ];
    const result = deriveLabor({
      ...MARCH,
      rates,
      entries: [
        entry({ workedOn: day('2026-03-10'), minutes: 120 }), // hourly: 2h × $30
        entry({ workedOn: day('2026-03-20'), minutes: 480 }), // salaried: hours don't add cost
      ],
      fallbackPropertyId: 'site-a',
    });
    expect(result.bases.sort()).toEqual(['hourly', 'salary']);
    expect(result.totalCents).toBe(6_000 + 16 * 20_000);
  });
});
