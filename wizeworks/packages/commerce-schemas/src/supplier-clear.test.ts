import { describe, expect, it } from 'vitest';

import { CreateSupplierInput, UpdateSupplierInput } from './inventory';

// A cleared box on a supplier arrives as null, and null has to mean "take it
// off": omitted already means "leave it" (sparx persona issue 073).
describe('clearing a supplier field', () => {
  it('accepts null for every optional detail on an update', () => {
    const parsed = UpdateSupplierInput.parse({
      email: null,
      phone: null,
      contactName: null,
      line1: null,
      country: null,
      leadTimeDays: null,
      notes: null,
    });
    expect(parsed.email).toBeNull();
    expect(parsed.leadTimeDays).toBeNull();
    expect(parsed.country).toBeNull();
  });

  it('accepts the same blanks on a new supplier', () => {
    expect(
      CreateSupplierInput.parse({ name: 'Alliant Power', code: 'ALLIANT', email: null }).email
    ).toBeNull();
  });

  it('still refuses a value that is not an email address', () => {
    expect(() => UpdateSupplierInput.parse({ email: 'orders at alliant' })).toThrow();
  });
});
