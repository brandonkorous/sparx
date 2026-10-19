// "Why this number", read as a shop owner would (persona issue 278). Gillett's
// Bosch fuel rail said "0.7143 a day", "Measured over the last 7 days: 5 sold in
// 90 days across 1 days", and wore a red "Not measured" over a reorder point
// that was worked out, because under a year of history the season counted as
// missing although the sum assumes an average month.

import { describe, expect, it } from 'vitest';

import { describeInputs, worstConfidence } from './planning-provenance';

const velocity = {
  variantId: 'bosch-rail',
  warehouseId: 'concord-park',
  units7: 5,
  units30: 5,
  units90: 5,
  perDay7: 0.7143,
  perDay30: 0.4167,
  perDay90: 0.4167,
  forecastPerDay: 0.7143,
  forecastBasis: '7d' as const,
  demandStdDev: 1.4392,
  demandCv: 2.01,
  daysWithDemand: 1,
  seasonalityIndex: null,
  historyDays: 12,
  firstMovementAt: null,
  lastSaleAt: null,
  computedAt: '2026-10-14T08:40:00Z',
};

const inputs = describeInputs({
  velocity,
  leadTimeDays: null,
  leadTimeStdDev: 0,
  leadTimeSource: 'default',
  sampleCount: 0,
  supplierName: null,
  serviceLevel: 0.95 as never,
  safetyStockOverride: null,
  leadTimeOverride: null,
});
const input = (key: string) => inputs.find((i) => i.key === key);

describe('why this number, in an owner\u2019s words', () => {
  it('says the rate at a readable precision', () => {
    expect(input('demand')?.value).toBe('0.71 a day');
  });

  it('says where the rate came from without mixing windows or "1 days"', () => {
    const source = input('demand')?.source ?? '';
    expect(source).toBe(
      'Worked out from the last 7 days (5 sold). 5 sold in the last 90 days, on 1 day.'
    );
  });

  it('calls an average season assumed, not missing', () => {
    expect(input('seasonality')?.confidence).toBe('assumed');
    expect(worstConfidence(inputs)).not.toBe('missing');
  });
});
