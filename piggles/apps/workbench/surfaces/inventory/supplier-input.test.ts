import { describe, expect, it } from 'vitest';

import { supplierInputFrom, type SupplierFormFields } from './supplier-input';

// Clearing a box on a supplier has to clear it on the record (sparx persona
// issue 073): omitted means "leave it", so only null takes a value off.
const FORM: SupplierFormFields = {
  name: 'Alliant Power',
  code: 'ALLIANT',
  contactName: 'Corbin Ashdown-Reyes',
  email: 'orders@alliantpower.test',
  phone: '+1 (800) 555-0150',
  website: '',
  line1: '1 Trade Park Way',
  line2: '',
  city: 'Salt Lake City',
  region: 'UT',
  postalCode: '84104',
  country: 'us',
  paymentTerms: 'Net 30',
  leadTimeDays: '5',
  currency: 'usd',
  notes: '',
};

describe('a supplier form as the API takes it', () => {
  it('sends a cleared box as null, which takes the value off', () => {
    const input = supplierInputFrom({ ...FORM, email: '  ', phone: '' });
    expect(input.email).toBeNull();
    expect(input.phone).toBeNull();
    expect(input.website).toBeNull();
  });

  it('sends what was typed, trimmed and in the shape the API wants', () => {
    const input = supplierInputFrom(FORM);
    expect(input.email).toBe('orders@alliantpower.test');
    expect(input.country).toBe('US');
    expect(input.currency).toBe('USD');
    expect(input.leadTimeDays).toBe(5);
  });

  it('clears lead time and country when emptied, and never wipes them over half-typed text', () => {
    expect(supplierInputFrom({ ...FORM, leadTimeDays: '' }).leadTimeDays).toBeNull();
    expect(supplierInputFrom({ ...FORM, country: '' }).country).toBeNull();
    expect('leadTimeDays' in supplierInputFrom({ ...FORM, leadTimeDays: 'five' })).toBe(false);
    expect('country' in supplierInputFrom({ ...FORM, country: 'U' })).toBe(false);
  });
});
