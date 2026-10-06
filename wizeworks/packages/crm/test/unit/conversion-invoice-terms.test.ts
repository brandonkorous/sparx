// An order made from a trade account's quote is invoiced on the account's terms
// (sparx persona issue 084). Wasatch Front's accepted quote became order
// O-000008 with no invoice, while the same order placed at checkout gets one.

import { describe, expect, it } from 'vitest';

import {
  billingSnapshotFrom,
  invoiceTermsDays,
} from '../../src/services/billing-document-conversion-service';

describe('invoiceTermsDays', () => {
  it('invoices an account on day terms, for its own number of days', () => {
    expect(invoiceTermsDays('net30')).toBe(30);
    // Salt Lake County is on Net 45.
    expect(invoiceTermsDays('net45')).toBe(45);
  });

  it('does not invoice an account that pays first, or has no terms yet', () => {
    expect(invoiceTermsDays('prepay')).toBeNull();
    expect(invoiceTermsDays(null)).toBeNull();
    expect(invoiceTermsDays(undefined)).toBeNull();
  });
});

// The order made from Wasatch Front's quote read "Billing address: Not given".
describe('billingSnapshotFrom', () => {
  const base = {
    recipientName: 'Accounts Payable',
    company: null,
    line2: 'Suite 200',
    region: 'UT',
    postalCode: '84119',
    country: 'US',
    phone: null,
  };
  const yard = {
    ...base,
    type: 'shipping',
    isDefault: true,
    line1: '1400 W 2100 S',
    city: 'Salt Lake City',
  };
  const office = {
    ...base,
    type: 'both',
    isDefault: true,
    line1: '2275 S 900 W',
    city: 'Salt Lake City',
  };

  it('takes the default billing address, never a delivery-only one', () => {
    expect(billingSnapshotFrom([yard, office])).toEqual({
      recipientName: 'Accounts Payable',
      line1: '2275 S 900 W',
      line2: 'Suite 200',
      city: 'Salt Lake City',
      region: 'UT',
      postalCode: '84119',
      country: 'US',
    });
  });

  it('is null when there is no billing address at all', () => {
    expect(billingSnapshotFrom([yard])).toBeNull();
    expect(billingSnapshotFrom([])).toBeNull();
  });
});
