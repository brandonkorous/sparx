// Sparx persona issue 357: "Mark it as sent" under a packed box sent the units
// nobody could find, and never the box.

import { describe, expect, it } from 'vitest';

import { boxIsWaiting, handoverSends, sentSoFarWords } from './packed-box';

const items = [
  { id: 'inj', name: 'Bosch Remanufactured Fuel Injector (0986435621)' },
  { id: 'ring', name: 'Cummins Fuel Injection Crossover Tube O-Ring (4062328)' },
];

describe('boxIsWaiting', () => {
  it('is a box sealed at the bench and not sent', () => {
    expect(boxIsWaiting({ status: 'pending', carrier: null })).toBe(true);
  });

  it('is not a parcel on its way, or a collection', () => {
    expect(boxIsWaiting({ status: 'shipped', carrier: 'ups' })).toBe(false);
    expect(boxIsWaiting({ status: 'pending', carrier: 'pickup' })).toBe(false);
  });
});

describe('handoverSends', () => {
  it('names what the form sends', () => {
    expect(
      handoverSends(
        [
          { orderItemId: 'inj', quantity: 6 },
          { orderItemId: 'ring', quantity: 2 },
        ],
        items,
        false
      )
    ).toBe(
      'This sends 6 × Bosch Remanufactured Fuel Injector (0986435621), 2 × Cummins Fuel Injection Crossover Tube O-Ring (4062328).'
    );
  });

  it('says it is not the packed box when one is waiting', () => {
    const says = handoverSends([{ orderItemId: 'inj', quantity: 4 }], items, true);
    expect(says).toContain('A box is packed and waiting above; send it from there.');
    expect(says).toContain('4 × Bosch Remanufactured Fuel Injector (0986435621)');
  });
});

// Sparx persona issue 359: "2 of 6 sent so far" for a box still on the bench.
describe('sentSoFarWords', () => {
  it('names a packed box apart from what went', () => {
    expect(sentSoFarWords({ quantity: 6, quantityFulfilled: 2, quantityHandedOver: 0 })).toBe(
      '0 of 6 sent so far · 2 packed, waiting to go'
    );
  });

  it('is what went once the box has gone', () => {
    expect(sentSoFarWords({ quantity: 6, quantityFulfilled: 2, quantityHandedOver: 2 })).toBe(
      '2 of 6 sent so far'
    );
  });

  it('reads what was fulfilled when the server does not say', () => {
    expect(sentSoFarWords({ quantity: 6, quantityFulfilled: 2 })).toBe('2 of 6 sent so far');
  });
});
