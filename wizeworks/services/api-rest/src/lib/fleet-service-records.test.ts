// The service record for a fleet vehicle (sparx persona issue 086): which vehicle
// a booking was for, frozen at the time, and the parts from the account's orders
// that went into it, each still pointing at the order it came from.

import { describe, expect, it } from 'vitest';

import {
  buildLinkedParts,
  PartLinkError,
  readLinkedParts,
  readVehicleSnapshot,
  toServiceRecord,
  vehicleSnapshot,
} from './fleet-service-records.js';

const RAM = {
  id: 'veh-12',
  label: 'Unit 12',
  year: 2019,
  make: null,
  model: null,
  vin: '3C63R3EL5KG123456',
  notes: 'Tow package',
  mileage: 148_000,
  count: 1,
  domainId: 'dom-1',
  nodeId: 'node-1',
  nodePath: ['Ram', '3500', '6.7L Cummins'],
};

const ORDERS = [
  {
    id: 'ord-1',
    orderNumber: 'SO-1042',
    items: [
      {
        id: 'line-1',
        variantId: 'var-1',
        productId: 'prod-1',
        sku: 'LF3349',
        name: 'Oil filter',
        quantity: 4,
      },
      {
        id: 'line-2',
        variantId: 'var-2',
        productId: 'prod-2',
        sku: 'OIL-15W40',
        name: '15W-40, 1 gal',
        quantity: 6,
      },
    ],
  },
  {
    id: 'ord-2',
    orderNumber: 'SO-1077',
    items: [
      {
        id: 'line-3',
        variantId: null,
        productId: null,
        sku: 'CUSTOM',
        name: 'Hose cut to length',
        quantity: 1,
      },
    ],
  },
];

describe('the vehicle on a booking', () => {
  it('keeps the fleet id and a snapshot of what the vehicle was', () => {
    expect(vehicleSnapshot(RAM)).toEqual({
      vehicleId: 'veh-12',
      name: 'Unit 12',
      label: 'Unit 12, 2019 Ram 3500 6.7L Cummins',
      description: '2019 Ram 3500 6.7L Cummins',
      year: 2019,
      make: 'Ram',
      model: '3500',
      engine: '6.7L Cummins',
      vin: '3C63R3EL5KG123456',
      nodePath: ['Ram', '3500', '6.7L Cummins'],
    });
  });

  it('uses the typed make and model when the vehicle was not picked from a list', () => {
    const snap = vehicleSnapshot({ ...RAM, nodePath: [], make: 'Ford', model: 'F-350' });
    expect(snap).toMatchObject({ make: 'Ford', model: 'F-350', engine: null });
    expect(snap.label).toBe('Unit 12, 2019 Ford F-350');
  });

  it('reads a snapshot back, and nothing from a booking with no vehicle', () => {
    expect(readVehicleSnapshot(vehicleSnapshot(RAM))?.vehicleId).toBe('veh-12');
    expect(readVehicleSnapshot(null)).toBeNull();
    expect(readVehicleSnapshot({ year: 2019, make: 'Ram' })).toBeNull();
  });
});

describe('linking parts from an order', () => {
  it('snapshots each ticked line with its order', () => {
    expect(buildLinkedParts([{ orderItemId: 'line-1', quantity: 2 }], ORDERS)).toEqual([
      {
        orderId: 'ord-1',
        orderItemId: 'line-1',
        orderNumber: 'SO-1042',
        productId: 'prod-1',
        variantId: 'var-1',
        sku: 'LF3349',
        title: 'Oil filter',
        quantity: 2,
      },
    ]);
  });

  it('takes lines from more than one order', () => {
    const parts = buildLinkedParts(
      [
        { orderItemId: 'line-2', quantity: 6 },
        { orderItemId: 'line-3', quantity: 1 },
      ],
      ORDERS
    );
    expect(parts.map((p) => p.orderNumber)).toEqual(['SO-1042', 'SO-1077']);
    expect(parts[1]).not.toHaveProperty('variantId');
  });

  it('refuses a line that is not on one of the account orders', () => {
    expect(() => buildLinkedParts([{ orderItemId: 'line-x', quantity: 1 }], ORDERS)).toThrow(
      PartLinkError
    );
  });

  it('refuses more than the order had, and says how many it had', () => {
    expect(() => buildLinkedParts([{ orderItemId: 'line-1', quantity: 5 }], ORDERS)).toThrow(
      'Order SO-1042 has 4 of Oil filter, so no more than 4 can go on this visit.'
    );
  });

  it('adds up the same line ticked twice instead of listing it twice', () => {
    const parts = buildLinkedParts(
      [
        { orderItemId: 'line-1', quantity: 1 },
        { orderItemId: 'line-1', quantity: 2 },
      ],
      ORDERS
    );
    expect(parts).toHaveLength(1);
    expect(parts[0]?.quantity).toBe(3);
  });

  it('reads stored parts, the older shape included', () => {
    expect(readLinkedParts([{ sku: 'LF3349', quantity: 2 }, 'junk', null])).toEqual([
      {
        orderId: null,
        orderItemId: null,
        orderNumber: null,
        variantId: null,
        sku: 'LF3349',
        title: 'LF3349',
        quantity: 2,
      },
    ]);
  });
});

describe('the record a person reads', () => {
  const row = {
    id: 'bk-1',
    startAt: new Date('2026-10-05T15:00:00Z'),
    endAt: new Date('2026-10-05T16:30:00Z'),
    timezone: 'America/Chicago',
    status: 'completed',
    notes: 'Customer says it pulls left',
    staffNotes: 'Torque spec checked twice',
    assetRef: vehicleSnapshot(RAM),
    partsLinked: buildLinkedParts([{ orderItemId: 'line-1', quantity: 1 }], ORDERS),
    service: { name: 'Oil and filter change' },
  };

  it('keeps the private team note away from the buyer', () => {
    const forBuyer = toServiceRecord(row, { staff: false });
    expect(forBuyer).not.toHaveProperty('staffNotes');
    expect(forBuyer).toMatchObject({
      id: 'bk-1',
      serviceName: 'Oil and filter change',
      status: 'completed',
      notes: 'Customer says it pulls left',
      startAt: '2026-10-05T15:00:00.000Z',
      vehicle: { vehicleId: 'veh-12' },
    });
    expect(forBuyer.parts[0]?.orderNumber).toBe('SO-1042');
  });

  it('shows the team note to staff', () => {
    expect(toServiceRecord(row, { staff: true }).staffNotes).toBe('Torque spec checked twice');
  });
});
