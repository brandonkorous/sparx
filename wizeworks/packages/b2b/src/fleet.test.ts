// A trade account's fleet: stable vehicle ids and which parts fit (sparx persona
// issue 086).
//
// What this pins, and why:
//
//   1. Every vehicle has an id that does not move. Service bookings are linked
//      to it, so an edit that minted a new id would orphan a truck's history,
//      and a vehicle saved before ids existed has to read back with the SAME id
//      every time until a save writes it down.
//
//   2. The year a buyer types is what parts match on. It is stored into the
//      fitment list's Year range, or "2019 Ram 3500" would fit a 2005 part.
//
//   3. No fitment data is not "does not fit". A product with no rows for this
//      kind of vehicle must be ABSENT from the answer, so the website says
//      nothing, rather than present-and-empty, which the website prints as a
//      warning that it fits none of their vehicles.

import { describe, expect, it } from 'vitest';

import {
  FleetVehicleEntry,
  fitByProduct,
  legacyVehicleId,
  readFleet,
  toStoredFleet,
  vehicleFitsRule,
  type FitRule,
  type IdentifiedFleetVehicle,
} from './fleet.js';

const ACCOUNT = '8aa59a36-acc9-455f-b0ba-41c0b66292b9';
const VEHICLE_DOMAIN = '0b7e0d55-2f3a-4c8e-9a51-6f2f6d0b1a01';
const PET_DOMAIN = '0b7e0d55-2f3a-4c8e-9a51-6f2f6d0b1a02';
const RAM = '11111111-1111-4111-8111-111111111111';
const RAM_3500 = '22222222-2222-4222-8222-222222222222';
const CUMMINS_HO = '33333333-3333-4333-8333-333333333333';
const FORD = '44444444-4444-4444-8444-444444444444';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

describe('vehicle ids', () => {
  it('keeps the id a vehicle was saved with', () => {
    const [v] = readFleet(ACCOUNT, [{ id: RAM, label: 'Unit 12' }]);
    expect(v!.id).toBe(RAM);
  });

  it('gives an older vehicle the same uuid-shaped id on every read', () => {
    const stored = [{ label: 'Unit 12', nodeId: CUMMINS_HO }, { label: 'Unit 14' }];
    const first = readFleet(ACCOUNT, stored);
    const again = readFleet(ACCOUNT, stored);
    expect(first.map((v) => v.id)).toEqual(again.map((v) => v.id));
    expect(first[0]!.id).toMatch(UUID);
    expect(first[0]!.id).not.toBe(first[1]!.id);
    expect(first[0]!.id).toBe(legacyVehicleId(ACCOUNT, 0, stored[0]!));
  });

  it('two accounts with the same older vehicle do not share an id', () => {
    const other = '9bb59a36-acc9-455f-b0ba-41c0b66292b9';
    expect(legacyVehicleId(ACCOUNT, 0, { label: 'Unit 1' })).not.toBe(
      legacyVehicleId(other, 0, { label: 'Unit 1' })
    );
  });

  it('keeps ids across a save and mints one only for a new vehicle', () => {
    const input = [
      FleetVehicleEntry.parse({ id: RAM, label: 'Unit 12' }),
      FleetVehicleEntry.parse({ label: 'Unit 15' }),
    ];
    const stored = toStoredFleet(input, new Map(), () => FORD);
    expect(stored.map((v) => v.id)).toEqual([RAM, FORD]);
  });

  it('refuses the same id twice, so one truck never takes another one’s history', () => {
    const input = [
      FleetVehicleEntry.parse({ id: RAM, label: 'Unit 12' }),
      FleetVehicleEntry.parse({ id: RAM, label: 'Unit 13' }),
    ];
    expect(() => toStoredFleet(input, new Map())).toThrow(/same id/);
  });
});

describe('what a vehicle form accepts', () => {
  it('reads blanks as not given and a VIN in any case', () => {
    const v = FleetVehicleEntry.parse({
      label: ' Unit 12 ',
      year: '2019',
      make: '',
      vin: '3c63rrhl5kg123456',
      notes: null,
      mileage: '',
    });
    expect(v).toMatchObject({ label: 'Unit 12', year: 2019, vin: '3C63RRHL5KG123456', count: 1 });
    expect(v.make).toBeUndefined();
    expect(v.mileage).toBeUndefined();
  });

  it('says what a VIN looks like when it is not one', () => {
    const r = FleetVehicleEntry.safeParse({ label: 'Unit 12', vin: 'OOPS' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]?.message).toBe(
      'A VIN is 17 letters and numbers, and never uses the letters I, O or Q.'
    );
  });
});

describe('the year is what parts match on', () => {
  it('stores the year into the list’s Year range', () => {
    const [v] = toStoredFleet(
      [FleetVehicleEntry.parse({ label: 'Unit 12', year: 2019, domainId: VEHICLE_DOMAIN })],
      new Map([[VEHICLE_DOMAIN, 'year']])
    );
    expect(v!.rangeValues).toEqual([{ dimensionKey: 'year', value: 2019 }]);
  });

  it('replaces an old year rather than keeping both', () => {
    const [v] = toStoredFleet(
      [
        FleetVehicleEntry.parse({
          label: 'Unit 12',
          year: 2021,
          domainId: VEHICLE_DOMAIN,
          rangeValues: [{ dimensionKey: 'year', value: 2019 }],
        }),
      ],
      new Map([[VEHICLE_DOMAIN, 'year']])
    );
    expect(v!.rangeValues).toEqual([{ dimensionKey: 'year', value: 2021 }]);
  });
});

// Unit 12: a 2019 Ram 3500 6.7L Cummins HO. Its ancestry is Ram > 3500 > engine.
const unit12: IdentifiedFleetVehicle = {
  id: 'v-12',
  label: 'Unit 12',
  domainId: VEHICLE_DOMAIN,
  nodeId: CUMMINS_HO,
  rangeValues: [{ dimensionKey: 'year', value: 2019 }],
};
const ancestry = new Map([[CUMMINS_HO, [RAM, RAM_3500, CUMMINS_HO]]]);

function rule(over: Partial<FitRule> = {}): FitRule {
  return { productId: 'p', domainId: VEHICLE_DOMAIN, nodeId: CUMMINS_HO, ranges: [], ...over };
}

describe('vehicleFitsRule', () => {
  it('fits a part made for its engine', () => {
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule())).toBe(true);
  });

  it('fits a part made for every Ram', () => {
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule({ nodeId: RAM }))).toBe(true);
  });

  it('fits a universal part', () => {
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule({ nodeId: null }))).toBe(true);
  });

  it('does not fit a Ford part', () => {
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule({ nodeId: FORD }))).toBe(false);
  });

  it('does not fit a part for other years', () => {
    const years = [{ dimensionKey: 'year', min: 2003, max: 2010 }];
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule({ ranges: years }))).toBe(false);
    const open = [{ dimensionKey: 'year', min: 2013, max: null }];
    expect(vehicleFitsRule(unit12, ancestry.get(CUMMINS_HO), rule({ ranges: open }))).toBe(true);
  });

  it('a vehicle typed by hand, with no list entry, fits nothing', () => {
    expect(vehicleFitsRule({ id: 'v', label: 'Plow truck', make: 'Mack' }, undefined, rule())).toBe(
      false
    );
  });
});

describe('fitByProduct', () => {
  const unit14: IdentifiedFleetVehicle = {
    id: 'v-14',
    label: 'Unit 14',
    domainId: VEHICLE_DOMAIN,
    nodeId: FORD,
  };
  const fleet = [unit12, unit14];
  const both = new Map([...ancestry, [FORD, [FORD]]]);

  it('names every vehicle a part fits', () => {
    const fits = fitByProduct(fleet, both, [
      rule({ productId: 'filter', nodeId: RAM }),
      rule({ productId: 'filter', nodeId: FORD }),
    ]);
    expect(fits.get('filter')).toEqual(['v-12', 'v-14']);
  });

  it('says a part with fitment data fits none of them, as an empty list', () => {
    const other = '55555555-5555-4555-8555-555555555555';
    const fits = fitByProduct(fleet, both, [rule({ productId: 'injector', nodeId: other })]);
    expect(fits.has('injector')).toBe(true);
    expect(fits.get('injector')).toEqual([]);
  });

  it('says NOTHING about a part with no fitment data', () => {
    const fits = fitByProduct(fleet, both, []);
    expect(fits.has('shop-rags')).toBe(false);
  });

  it('says nothing about a part fitted only to another kind of thing', () => {
    const fits = fitByProduct(fleet, both, [
      rule({ productId: 'dog-harness', domainId: PET_DOMAIN, nodeId: null }),
    ]);
    expect(fits.has('dog-harness')).toBe(false);
  });
});
