import { describe, expect, it } from 'vitest';

import {
  neededByWords,
  refillReport,
  savedCartSummary,
  type RefillResultView,
} from './buying-again-words';

// What a trade buyer is told after Order again or a saved cart's Add to cart
// (sparx persona issue 086): what went in, what did not, and why, in words they
// can act on. Prices are today's, never the old order's, and the report says so.

const empty: RefillResultView = { added: [], skipped: [] };

describe('refillReport', () => {
  it('says everything went in, at today’s prices', () => {
    const report = refillReport({
      added: [
        { name: 'Bosch Remanufactured Fuel Injector', quantity: 6, requested: 6 },
        { name: 'Fuel Filter, 10 micron', quantity: 12, requested: 12 },
      ],
      skipped: [],
    });
    expect(report.tone).toBe('success');
    expect(report.headline).toBe(
      'Both items are in your cart, at today’s prices for your account.'
    );
    expect(report.added).toEqual([
      'Bosch Remanufactured Fuel Injector, 6',
      'Fuel Filter, 10 micron, 12',
    ]);
    expect(report.skipped).toEqual([]);
  });

  it('names how much went in when there was less than asked for', () => {
    const report = refillReport({
      added: [{ name: 'Bosch Remanufactured Fuel Injector', quantity: 4, requested: 6 }],
      skipped: [],
    });
    expect(report.tone).toBe('warning');
    expect(report.added).toEqual([
      'Bosch Remanufactured Fuel Injector, 4 of the 6 asked for. That is all there is right now.',
    ]);
  });

  it('lists what was skipped with the reason, and says the rest went in', () => {
    const report = refillReport({
      added: [{ name: 'Injector seals', quantity: 6, requested: 6 }],
      skipped: [
        {
          name: 'Old Gasket Kit',
          quantity: 2,
          reason: 'not_sold',
          message: 'Old Gasket Kit is no longer sold.',
        },
        {
          name: 'Hydraulic Hose',
          quantity: 5,
          reason: 'limited',
          message: 'Wasatch buys Hydraulic Hose in cases of 12. Choose 12, 24 or 36.',
        },
      ],
    });
    expect(report.tone).toBe('warning');
    expect(report.headline).toBe(
      '1 item is in your cart, at today’s prices for your account. 2 could not be added.'
    );
    expect(report.skipped).toEqual([
      'Old Gasket Kit is no longer sold.',
      'Wasatch buys Hydraulic Hose in cases of 12. Choose 12, 24 or 36.',
    ]);
  });

  it('says plainly when nothing went in', () => {
    const report = refillReport({
      added: [],
      skipped: [
        {
          name: 'Fuel Filter',
          quantity: 12,
          reason: 'out_of_stock',
          message: 'Fuel Filter is out of stock.',
        },
      ],
    });
    expect(report.tone).toBe('danger');
    expect(report.headline).toBe('Nothing was added to your cart.');
    expect(report.skipped).toEqual(['Fuel Filter is out of stock.']);
  });

  it('does not claim anything for an empty list', () => {
    expect(refillReport(empty).headline).toBe('Nothing was added to your cart.');
  });

  it('counts three or more in figures', () => {
    const report = refillReport({
      added: [
        { name: 'A', quantity: 1, requested: 1 },
        { name: 'B', quantity: 1, requested: 1 },
        { name: 'C', quantity: 1, requested: 1 },
      ],
      skipped: [],
    });
    expect(report.headline).toBe(
      'All 3 items are in your cart, at today’s prices for your account.'
    );
  });
});

describe('savedCartSummary', () => {
  it('says how many items and units, and who saved it', () => {
    expect(savedCartSummary({ itemCount: 2, unitCount: 30, savedBy: 'Renée Castañeda' })).toBe(
      '2 items, 30 in all · Saved by Renée Castañeda'
    );
    expect(savedCartSummary({ itemCount: 1, unitCount: 1, savedBy: null })).toBe('1 item');
  });
});

describe('neededByWords', () => {
  it('reads a calendar day as that day, without a time zone shifting it', () => {
    expect(neededByWords('2026-10-20')).toBe('Oct 20, 2026');
  });

  it('is null for nothing, or for something that is not a day', () => {
    expect(neededByWords(null)).toBeNull();
    expect(neededByWords('soon')).toBeNull();
  });
});
