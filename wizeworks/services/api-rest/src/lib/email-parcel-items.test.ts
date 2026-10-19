// Sparx persona issue 358: a box of 2 injectors was emailed as "Shipped: 6".

import { describe, expect, it } from 'vitest';

import { parcelItemRows } from './email-parcel-items';

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
