// The sentence an owner reads when postage cannot be priced (issue 929). It
// printed column names ("missing line1, postalCode") and pointed at a screen
// neither console has.

import { describe, expect, it } from 'vitest';
import { shipFromIncompleteMessage } from './shipping-request-resolver';

describe('a ship-from that couriers cannot use', () => {
  it('names the location and what it lacks in the form’s words', () => {
    expect(shipFromIncompleteMessage('Main Warehouse', ['line1', 'postalCode'])).toBe(
      'Main Warehouse, the location your online orders ship from, needs a street address and a postal code before a courier can price postage or print a label. Add them under Locations.'
    );
  });

  it('lists three parts with commas', () => {
    expect(shipFromIncompleteMessage('Studio', ['line1', 'city', 'postalCode'])).toContain(
      'needs a street address, a town or city and a postal code before'
    );
  });

  it('never prints a column name', () => {
    const sentence = shipFromIncompleteMessage('Studio', [
      'line1',
      'city',
      'postalCode',
      'country',
    ]);
    expect(sentence).not.toMatch(/line1|postalCode|Warehouses/);
  });
});
