// A task about an order names the customer (sparx persona issue 085). The
// engine's own customer fields carried no name at all, so "Order O-000012 from
// {{customer.fullName}} is waiting for your sign-off" read "from  is waiting".

import { describe, expect, it } from 'vitest';

import { customerFields } from '../../src/resolvers/builtins';

const dana = {
  id: 'c-dana',
  firstName: 'Dana',
  lastName: 'Whitcomb-Nguyen',
  type: 'contact',
  lifecycleStage: 'customer',
  leadStatus: null,
  email: 'dana.whitcomb-nguyen@slcopw.test',
  companyName: null,
  doNotContact: false,
  tags: [],
  totalSpent: 0,
  orderCount: 0,
  firstOrderAt: null,
  lastOrderAt: null,
  createdAt: new Date('2026-10-02T17:00:00Z'),
  propertyId: null,
};

describe('customerFields', () => {
  it('carries the name an automation writes into a task or an email', () => {
    const fields = customerFields(dana, new Date('2026-10-02T21:49:00Z'));
    expect(fields['customer.fullName']).toBe('Dana Whitcomb-Nguyen');
    expect(fields['customer.firstName']).toBe('Dana');
    expect(fields['customer.lastName']).toBe('Whitcomb-Nguyen');
  });

  it('is null rather than blank for a customer with no name on file', () => {
    const fields = customerFields({ ...dana, firstName: null, lastName: null }, new Date());
    expect(fields['customer.fullName']).toBeNull();
  });
});
