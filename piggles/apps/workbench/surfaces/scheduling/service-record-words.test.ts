// The staff side of a fleet service record (sparx persona issue 086): how a visit
// and its parts read, and the ticks that become the parts on a booking.

import { describe, expect, it } from 'vitest';

import {
  partLine,
  partName,
  partsChanged,
  partsToTicks,
  ticksToPicks,
  visitStatus,
} from './service-record-words';

const PART = {
  orderId: 'ord-1',
  orderItemId: 'line-1',
  orderNumber: 'SO-1042',
  variantId: 'var-1',
  sku: 'LF3349',
  title: 'Oil filter',
  quantity: 2,
};

describe('a visit reads as a state in a color that means it', () => {
  it.each([
    ['requested', 'Waiting for you to confirm', 'warning'],
    ['confirmed', 'Booked', 'info'],
    ['in_progress', 'In the shop', 'info'],
    ['completed', 'Done', 'success'],
    ['cancelled', 'Canceled', 'danger'],
    ['no_show', 'Did not turn up', 'danger'],
  ])('%s', (status, label, tone) => {
    expect(visitStatus(status)).toEqual({ label, tone });
  });

  it('never prints a raw code', () => {
    expect(visitStatus('mystery').label).toBe('Booked');
  });
});

describe('a part reads as a count, a name and a part number', () => {
  it('names all three', () => {
    expect(partLine(PART)).toBe('2 × Oil filter (LF3349)');
  });

  it('does not repeat a part number that is the name', () => {
    expect(partLine({ ...PART, sku: 'Oil filter' })).toBe('2 × Oil filter');
  });

  // sparx persona issue 086: the shop's titles already end in the part number.
  it('does not repeat a part number the name already carries', () => {
    const title = 'Cummins Fuel Injection Crossover Tube O-Ring (4062328)';
    expect(partLine({ ...PART, title, sku: '4062328', quantity: 1 })).toBe(`1 × ${title}`);
    expect(partName(title, '4062328')).toBe(title);
    expect(partName('LF3349 oil filter', 'lf3349')).toBe('LF3349 oil filter');
  });

  it('still names a part number that only looks like part of a longer one', () => {
    expect(partName('Filter kit 40623281', '4062328')).toBe('Filter kit 40623281 (4062328)');
    expect(partName('Oil filter', null)).toBe('Oil filter');
  });
});

describe('ticking parts from an order', () => {
  it('starts from what is already on the visit', () => {
    expect(partsToTicks([PART])).toEqual({ 'line-1': 2 });
  });

  it('ignores a stored part with no order line, which cannot be re-ticked', () => {
    expect(partsToTicks([{ ...PART, orderItemId: null }])).toEqual({});
  });

  it('sends only the lines that are ticked with a count', () => {
    expect(ticksToPicks({ 'line-1': 2, 'line-2': 0 })).toEqual([
      { orderItemId: 'line-1', quantity: 2 },
    ]);
  });

  it('knows when the ticks differ from what is saved', () => {
    expect(partsChanged({ 'line-1': 2 }, { 'line-1': 2 })).toBe(false);
    expect(partsChanged({ 'line-1': 2 }, { 'line-1': 3 })).toBe(true);
    expect(partsChanged({ 'line-1': 2 }, { 'line-1': 2, 'line-2': 0 })).toBe(false);
    expect(partsChanged({}, { 'line-2': 1 })).toBe(true);
  });
});
