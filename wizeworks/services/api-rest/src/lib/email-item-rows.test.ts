// Sparx persona issue 358: a box of 2 injectors was emailed as "Shipped: 6".

import { describe, expect, it } from 'vitest';

import { invoiceItemRows, invoiceMoneyIn, parcelItemRows } from './email-item-rows';

const injector = {
  name: 'Bosch Remanufactured Fuel Injector (0986435621)',
  description: null,
  quantity: 6,
  unitPrice: '528.00',
  lineSubtotal: '3168.00',
  coreCharge: '150.00',
};

describe('parcelItemRows', () => {
  it('prints the parcel quantity and its share of the line', () => {
    const [part] = parcelItemRows(2, injector);
    expect(part).toEqual({
      name: 'Bosch Remanufactured Fuel Injector (0986435621)',
      quantity: '2',
      unitPrice: '$528.00',
      lineTotal: '$1,056.00',
    });
  });

  it('puts the core deposit for the parcel under the part', () => {
    const rows = parcelItemRows(2, injector);
    expect(rows).toHaveLength(2);
    expect(rows[1]).toMatchObject({ quantity: '2', unitPrice: '$150.00', lineTotal: '$300.00' });
  });

  it('has no deposit row for a part without one', () => {
    const rows = parcelItemRows(2, {
      ...injector,
      name: 'O-Ring',
      quantity: 2,
      lineSubtotal: '7.60',
      coreCharge: null,
    });
    expect(rows).toEqual([
      { name: 'O-Ring', quantity: '2', unitPrice: '$528.00', lineTotal: '$7.60' },
    ]);
  });
});

// Sparx persona issue 361: invoice emails listed lines with no name, and the
// receipt counted a returned core's credit as money paid.
describe('invoiceItemRows', () => {
  it('names the line, and puts its core deposit under it', () => {
    const rows = invoiceItemRows({
      description: 'Bosch Remanufactured Fuel Injector (0986435621)',
      quantity: '2.000',
      unitPrice: '510.00',
      lineSubtotal: '1020.00',
      coreCharge: '150.00',
    });
    expect(rows[0]).toMatchObject({
      name: 'Bosch Remanufactured Fuel Injector (0986435621)',
      quantity: '2',
      lineTotal: '$1,020.00',
    });
    expect(rows[1]).toMatchObject({ quantity: '2', unitPrice: '$150.00', lineTotal: '$300.00' });
  });
});

describe('invoiceMoneyIn', () => {
  it('counts money in, and the core credit apart', () => {
    expect(
      invoiceMoneyIn([
        { kind: 'payment', amount: '500.00' },
        { kind: 'payment', amount: '600.00' },
        { kind: 'credit', amount: '220.00' },
      ])
    ).toEqual({ paidCents: 110000, creditedCents: 22000 });
  });

  it('takes refunds off what came in, and counts a deposit', () => {
    expect(
      invoiceMoneyIn([
        { kind: 'deposit', amount: '100.00' },
        { kind: 'refund', amount: '40.00' },
      ])
    ).toEqual({ paidCents: 6000, creditedCents: 0 });
  });
});
