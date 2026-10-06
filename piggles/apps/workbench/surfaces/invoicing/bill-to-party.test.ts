import { describe, expect, it } from 'vitest';
import type { CustomerAddress } from '../crm/customers-data';
import { addressText, billedParty, billingAddressOf } from './bill-to-party';
import type { CustomerSummary } from './customer-picker-data';

/**
 * A BUSINESS ON ACCOUNT IS BILLED AS THE BUSINESS, AT ITS BILLING ADDRESS
 * (sparx persona issue 077).
 *
 * Picking Renée Castañeda, who buys for Wasatch Front Utility Contractors,
 * printed her own name and no address on a quote meant for their accounts
 * payable office, although that address was on her record.
 */

const RENEE: CustomerSummary = {
  id: 'fd7795a2-99f3-4583-b7be-efcb2d886a1b',
  firstName: 'Renée',
  lastName: 'Castañeda',
  company: null,
  email: 'renee.castaneda@wasatchutility.test',
  type: 'b2b',
  companyId: '8aa59a36-acc9-455f-b0ba-41c0b66292b9',
};

const MAIN_OFFICE: CustomerAddress = {
  id: 'a905ee96-bb95-4e39-a102-0d051c8a8fe8',
  type: 'both',
  label: 'Main office',
  isDefault: true,
  recipientName: 'Accounts Payable',
  company: 'Wasatch Front Utility Contractors, LLC',
  line1: '2275 S 900 W',
  line2: 'Suite 200',
  city: 'Salt Lake City',
  region: 'UT',
  postalCode: '84119',
  country: 'US',
  phone: null,
};

const YARD: CustomerAddress = {
  ...MAIN_OFFICE,
  id: 'yard',
  type: 'shipping',
  label: 'Yard',
  isDefault: false,
  recipientName: 'Receiving',
  line1: '1500 W 3300 S',
  line2: null,
};

describe('billedParty', () => {
  it('bills a wholesale customer as the business, at its accounts payable address', () => {
    expect(
      billedParty(RENEE, 'Wasatch Front Utility Contractors, LLC', [YARD, MAIN_OFFICE], 'US')
    ).toEqual({
      name: 'Wasatch Front Utility Contractors, LLC',
      email: 'renee.castaneda@wasatchutility.test',
      address: 'Accounts Payable\n2275 S 900 W\nSuite 200\nSalt Lake City, UT 84119',
      companyId: RENEE.companyId,
    });
  });

  it('bills a retail customer as themselves, with their address filled in', () => {
    const wren: CustomerSummary = {
      ...RENEE,
      id: 'wren',
      firstName: 'Wren',
      lastName: 'Ashcombe',
      email: 'wren@example.test',
      type: 'retail',
      companyId: null,
    };
    const home: CustomerAddress = {
      ...MAIN_OFFICE,
      recipientName: 'Wren Ashcombe',
      company: null,
      line1: '18 Larch Lane',
      line2: null,
      city: 'Eugene',
      region: 'OR',
      postalCode: '97401',
    };
    expect(billedParty(wren, null, [home], 'US')).toEqual({
      name: 'Wren Ashcombe',
      email: 'wren@example.test',
      address: '18 Larch Lane\nEugene, OR 97401',
      companyId: null,
    });
  });

  it('falls back to the person while the business name is unknown', () => {
    expect(billedParty(RENEE, null, []).name).toBe('Renée Castañeda');
  });
});

describe('billingAddressOf', () => {
  it('takes the default billing address, never a delivery-only one', () => {
    expect(billingAddressOf([YARD, MAIN_OFFICE])).toBe(MAIN_OFFICE);
    expect(billingAddressOf([{ ...YARD, isDefault: true }])).toBeNull();
  });
});

describe('addressText', () => {
  // Issue 083: a Salt Lake City customer's bill-to ended on "US", from a
  // business in Utah.
  it('leaves off the country when it is the business own', () => {
    expect(addressText(MAIN_OFFICE, 'Wasatch Front Utility Contractors, LLC', 'US')).not.toMatch(
      /\nUS$/
    );
  });

  it('keeps the country of a customer abroad, and when the home country is unknown', () => {
    const calgary: CustomerAddress = {
      ...MAIN_OFFICE,
      city: 'Calgary',
      region: 'AB',
      postalCode: 'T2P 1J9',
      country: 'CA',
    };
    expect(addressText(calgary, 'Wasatch Front Utility Contractors, LLC', 'US')).toMatch(/\nCA$/);
    expect(addressText(MAIN_OFFICE, 'Wasatch Front Utility Contractors, LLC', null)).toMatch(
      /\nUS$/
    );
  });

  it('keeps the company line when it is not the name already printed above', () => {
    expect(addressText(MAIN_OFFICE, 'Renée Castañeda').split('\n')[1]).toBe(
      'Wasatch Front Utility Contractors, LLC'
    );
  });
});
