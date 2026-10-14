// The "Expected" box on an order says what a blank box will really become, for
// the supplier chosen (persona issue 257). It promised a lead time Kestrel did not have.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { expectedDateHelp } from './expected-date-words';

const read = (name: string) => readFileSync(fileURLToPath(new URL(name, import.meta.url)), 'utf8');

describe('what a blank expected date becomes', () => {
  it('names the days when the supplier has a usual time', () => {
    expect(expectedDateHelp({ name: 'Kestrel Paper Co.', leadTimeDays: 10 })).toBe(
      'When you expect it. Left blank, it is set 10 days after you place the order: Kestrel Paper Co.’s usual time.'
    );
    expect(expectedDateHelp({ name: 'Alliant Power', leadTimeDays: 1 })).toContain(
      'set 1 day after'
    );
  });

  it('says there will be no date when the supplier has no usual time', () => {
    expect(expectedDateHelp({ name: 'Kestrel Paper Co.', leadTimeDays: null })).toBe(
      'When you expect it. Kestrel Paper Co. has no usual delivery time, so left blank the order has no expected date.'
    );
  });

  it('promises nothing before a supplier is chosen', () => {
    expect(expectedDateHelp(null)).toBe('When you expect it.');
  });
});

describe('the forms', () => {
  it('the order form asks the chosen supplier instead of promising', () => {
    const order = read('./purchase-order-fields-terms.tsx');
    expect(order).not.toContain('usual lead time fills it in');
    expect(order).toContain('expectedDateHelp(');
  });

  it('the supplier form shows no number in an empty box', () => {
    expect(read('./supplier-detail-fields.tsx')).not.toMatch(/placeholder="\d+"/);
  });
});
