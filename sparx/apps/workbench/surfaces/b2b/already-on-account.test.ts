// Who the Add someone picker will not let you pick twice (sparx persona issue
// 086).
//
// It offered Renée to Wasatch Front while she was already on the account, and
// the server refused her only after she was chosen and Add was clicked. Now
// she shows in the results with the reason under her name and cannot be
// clicked. Someone who was switched off can still be picked: adding them again
// turns them back on, which the server allows.

import { describe, expect, it } from 'vitest';
import { alreadyOnAccount, type AccountContact } from './accounts-data';
import { customerPickerRow, type CustomerSummary } from '../invoicing/customer-picker-data';

function contact(over: Partial<AccountContact> & { customerId: string }): AccountContact {
  const { customerId, ...rest } = over;
  return {
    id: `contact-${customerId}`,
    role: 'buyer',
    isActive: true,
    customer: {
      id: customerId,
      firstName: 'Renée',
      lastName: 'Castañeda',
      email: null,
      company: null,
    },
    ...rest,
  };
}

const RENEE: CustomerSummary = {
  id: 'renee',
  firstName: 'Renée',
  lastName: 'Castañeda',
  company: null,
  email: 'renee.castaneda@wasatchutility.test',
  type: 'b2b',
  companyId: null,
};

describe('alreadyOnAccount', () => {
  it('names each active person with what they can already do', () => {
    const taken = alreadyOnAccount([
      contact({ customerId: 'renee' }),
      contact({ customerId: 'marcus', role: 'viewer' }),
    ]);
    expect(taken.get('renee')).toBe('Already on this account (can place orders)');
    expect(taken.get('marcus')).toBe('Already on this account (can view only)');
  });

  it('leaves someone who was switched off free to pick, so adding them turns them back on', () => {
    const taken = alreadyOnAccount([contact({ customerId: 'teo', isActive: false })]);
    expect(taken.has('teo')).toBe(false);
  });
});

describe('customerPickerRow', () => {
  it('carries the reason onto the row, so the picker draws it and will not pick it', () => {
    const taken = alreadyOnAccount([contact({ customerId: 'renee' })]);
    expect(
      customerPickerRow(RENEE, 'Wasatch Front Utility Contractors, LLC', taken.get('renee'))
        .unavailable
    ).toBe('Already on this account (can place orders)');
  });

  it('leaves a row that can be picked without one', () => {
    expect(customerPickerRow(RENEE, null).unavailable).toBeUndefined();
  });
});
