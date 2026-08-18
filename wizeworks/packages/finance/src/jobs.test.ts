// The job-profitability arithmetic, tested without a database.
//
// The DB-coupled half (which orders and bookings are in the window, where the
// costs come from) is covered by the integration suite. What is here is the part
// that is easy to get subtly, silently wrong: the margin rate when there is no
// revenue to divide by, and the sort that decides which end of the list a person
// sees first.

import { describe, expect, it } from 'vitest';

import { jobMargin, sortJobs, type JobProfit } from './jobs';

describe('jobMargin', () => {
  it('takes goods, fees and charged-out spend off the revenue', () => {
    const result = jobMargin({
      revenueCents: 100_00,
      cogsCents: 30_00,
      feeCents: 5_00,
      allocatedCents: 15_00,
    });
    expect(result.costCents).toBe(50_00);
    expect(result.marginCents).toBe(50_00);
    expect(result.marginRate).toBeCloseTo(0.5, 10);
  });

  it('reports a loss as a negative margin, not as zero', () => {
    const result = jobMargin({
      revenueCents: 40_00,
      cogsCents: 55_00,
      feeCents: 0,
      allocatedCents: 0,
    });
    expect(result.marginCents).toBe(-15_00);
    expect(result.marginRate).toBeCloseTo(-0.375, 10);
  });

  /**
   * THE ONE THAT MATTERS. A job with cost and no revenue has no meaningful
   * margin RATE, and rendering it as 0% would rank it alongside a job that
   * genuinely broke even — presenting an absence as a measurement.
   */
  it('has NO margin rate when there is no revenue to divide by', () => {
    const result = jobMargin({
      revenueCents: 0,
      cogsCents: 0,
      feeCents: 0,
      allocatedCents: 80_00,
    });
    expect(result.marginCents).toBe(-80_00);
    expect(result.marginRate).toBeNull();
    // Explicitly NOT zero — the distinction this test exists to protect.
    expect(result.marginRate).not.toBe(0);
  });

  it('gives a break-even job a rate of exactly zero, which IS a measurement', () => {
    const result = jobMargin({
      revenueCents: 60_00,
      cogsCents: 60_00,
      feeCents: 0,
      allocatedCents: 0,
    });
    expect(result.marginRate).toBe(0);
  });

  it('reconciles: revenue always equals cost plus margin', () => {
    const cases = [
      { revenueCents: 0, cogsCents: 0, feeCents: 0, allocatedCents: 0 },
      { revenueCents: 1, cogsCents: 0, feeCents: 0, allocatedCents: 0 },
      { revenueCents: 999_99, cogsCents: 1_23, feeCents: 45, allocatedCents: 67_89 },
      { revenueCents: 10_00, cogsCents: 99_00, feeCents: 1_00, allocatedCents: 1 },
    ];
    for (const input of cases) {
      const { costCents, marginCents } = jobMargin(input);
      expect(costCents + marginCents).toBe(input.revenueCents);
    }
  });
});

function job(label: string, marginCents: number, revenueCents: number, iso: string): JobProfit {
  return {
    type: 'order',
    id: label,
    label,
    customerName: null,
    propertyId: null,
    occurredAt: new Date(iso),
    currency: 'USD',
    revenueCents,
    revenueBasis: 'collected',
    cogsCents: 0,
    feeCents: 0,
    allocatedCents: 0,
    marginCents,
    marginRate: revenueCents > 0 ? marginCents / revenueCents : null,
  };
}

describe('sortJobs', () => {
  const rows = (): JobProfit[] => [
    job('middling', 20_00, 100_00, '2027-02-01T00:00:00.000Z'),
    job('loss', -50_00, 10_00, '2027-01-01T00:00:00.000Z'),
    job('best', 90_00, 200_00, '2027-03-01T00:00:00.000Z'),
  ];

  it('puts the losses first by default — the actionable end of the list', () => {
    const list = rows();
    sortJobs(list, 'margin_asc');
    expect(list.map((r) => r.label)).toEqual(['loss', 'middling', 'best']);
  });

  it('can lead with the best instead', () => {
    const list = rows();
    sortJobs(list, 'margin_desc');
    expect(list.map((r) => r.label)).toEqual(['best', 'middling', 'loss']);
  });

  it('orders by revenue, which is NOT the same as by margin', () => {
    const list = rows();
    sortJobs(list, 'revenue_desc');
    expect(list.map((r) => r.label)).toEqual(['best', 'middling', 'loss']);
    // The distinction is real: the biggest job here is also the best, but a
    // high-revenue low-margin job must not be reordered by margin.
    const skewed = [
      job('big but thin', 1_00, 500_00, '2027-01-01T00:00:00.000Z'),
      job('small but fat', 40_00, 50_00, '2027-01-02T00:00:00.000Z'),
    ];
    sortJobs(skewed, 'revenue_desc');
    expect(skewed[0]?.label).toBe('big but thin');
    sortJobs(skewed, 'margin_desc');
    expect(skewed[0]?.label).toBe('small but fat');
  });

  it('orders by when the work happened, newest first', () => {
    const list = rows();
    sortJobs(list, 'recent');
    expect(list.map((r) => r.label)).toEqual(['best', 'middling', 'loss']);
  });
});
