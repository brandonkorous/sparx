import { describe, expect, it } from 'vitest';

import {
  lineShipRefusal,
  orderShipRefusal,
  shippableUnits,
  unitsWaitingForCore,
} from './ship-gate';

// One rule for every way out of the building (persona issues 057, 058).

const injector = {
  name: 'Bosch Remanufactured Fuel Injector',
  quantity: 2,
  quantityFulfilled: 0,
  coreFirst: false,
  coreHoldReleasedAt: null,
  coresReturned: 0,
};

describe('orderShipRefusal', () => {
  it('holds an order that is waiting for approval', () => {
    expect(orderShipRefusal({ status: 'pending_approval', orderNumber: '1042' })).toBe(
      'Order 1042 is waiting for approval. Approve it before anything on it is sent.'
    );
  });

  it('lets a placed order go', () => {
    expect(orderShipRefusal({ status: 'placed' })).toBeNull();
  });
});

describe('a send-the-old-part-first line', () => {
  const first = { ...injector, coreFirst: true };

  it('waits while no old part has arrived', () => {
    expect(shippableUnits(first)).toBe(0);
    expect(unitsWaitingForCore(first)).toBe(2);
    expect(lineShipRefusal(first, 1)).toMatch(/is held until the customer's old part arrives/);
  });

  it('lets one unit go per old part that arrived', () => {
    const one = { ...first, coresReturned: 1 };
    expect(shippableUnits(one)).toBe(1);
    expect(lineShipRefusal(one, 1)).toBeNull();
    expect(lineShipRefusal(one, 2)).toBe(
      "Only 1 of Bosch Remanufactured Fuel Injector can go now: 1 is waiting for the customer's old part."
    );
  });

  it('does not count a unit already sent against a later arrival', () => {
    expect(shippableUnits({ ...first, coresReturned: 1, quantityFulfilled: 1 })).toBe(0);
  });

  it('ships in full once the business chooses not to wait', () => {
    const released = { ...first, coreHoldReleasedAt: '2026-10-01T16:00:00Z' };
    expect(shippableUnits(released)).toBe(2);
    expect(lineShipRefusal(released, 2)).toBeNull();
  });
});

describe('an ordinary line', () => {
  it('ships everything not yet sent, whatever its cores', () => {
    expect(shippableUnits(injector)).toBe(2);
    expect(unitsWaitingForCore(injector)).toBe(0);
  });

  it('refuses more than is left', () => {
    expect(lineShipRefusal({ ...injector, quantityFulfilled: 2 }, 1)).toBe(
      'All of Bosch Remanufactured Fuel Injector has already been sent.'
    );
  });
});
