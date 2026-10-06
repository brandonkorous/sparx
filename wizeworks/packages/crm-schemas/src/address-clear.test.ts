import { describe, expect, it } from 'vitest';

import { UpdateCustomerAddressInput } from './customers';

// A cleared box on a saved address arrives as null, and null has to take the
// value off: omitted already means "leave it" (sparx persona issue 073).
describe('clearing part of a saved address', () => {
  it('accepts null for every optional line', () => {
    const parsed = UpdateCustomerAddressInput.parse({
      label: null,
      recipientName: null,
      company: null,
      line2: null,
      region: null,
      postalCode: null,
      phone: null,
    });
    expect(parsed.line2).toBeNull();
    expect(parsed.company).toBeNull();
    expect(parsed.label).toBeNull();
  });
});
