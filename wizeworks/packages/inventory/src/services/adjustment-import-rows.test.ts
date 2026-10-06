import { describe, expect, it } from 'vitest';

import { fieldReader, importTimeoutMs, locationNamed, planRow } from './adjustment-import';

const LOCATIONS = [
  { code: 'HQ', name: 'Main Office & Shop (Heritage Crest)' },
  { code: 'WH-CP', name: 'Warehouse (Concord Park)' },
];

describe('locationNamed', () => {
  it('finds a location by its code', () => {
    expect(locationNamed(LOCATIONS, 'wh-cp')?.code).toBe('WH-CP');
  });

  it("finds a location by its name, the way another system's export writes it", () => {
    expect(locationNamed(LOCATIONS, 'Warehouse (Concord Park)')?.code).toBe('WH-CP');
    expect(locationNamed(LOCATIONS, ' main office & shop (heritage crest) ')?.code).toBe('HQ');
  });

  it('prefers a code over a name that happens to match it', () => {
    const places = [
      { code: 'NORTH', name: 'Yard' },
      { code: 'YARD', name: 'North' },
    ];
    expect(locationNamed(places, 'North')?.code).toBe('NORTH');
  });

  it('finds nothing for a place that is not there, or for nothing at all', () => {
    expect(locationNamed(LOCATIONS, 'Boise')).toBeUndefined();
    expect(locationNamed(LOCATIONS, '  ')).toBeUndefined();
  });
});

describe('planRow', () => {
  const warehouses = [
    { id: 'wh-1', code: 'WH-CP', name: 'Warehouse (Concord Park)', isActive: true },
    { id: 'wh-2', code: 'OLD', name: 'Old Yard', isActive: false },
  ];
  const plan = (record: Record<string, string>) =>
    planRow({
      record,
      read: fieldReader({}),
      decimal: '.',
      customFields: [],
      line: 310,
      bySku: new Map([['0986435621', 'variant-1']]),
      warehouses,
      byId: new Map(warehouses.map((w) => [w.id, w])),
      onHandByKey: new Map(),
      fallbackWarehouseId: null,
    });

  it('keeps the location an unknown code named, so pointing the row at an item can land it', () => {
    const row = plan({ sku: '-', location: 'Warehouse (Concord Park)', on_hand: '3' });
    expect(row.outcome).toBe('error');
    expect(row.variantId).toBeNull();
    expect(row.warehouseId).toBe('wh-1');
    expect(row.newOnHand).toBe(3);
  });

  it('carries no location that is closed', () => {
    const row = plan({ sku: '-', location: 'Old Yard', on_hand: '3' });
    expect(row.warehouseId).toBeNull();
  });

  it('plans a known code at a location named in words', () => {
    const row = plan({ sku: '0986435621', location: 'Warehouse (Concord Park)', on_hand: '4' });
    expect(row.outcome).toBe('apply');
    expect(row.warehouseId).toBe('wh-1');
    expect(row.delta).toBe(4);
  });
});

describe('importTimeoutMs', () => {
  it("gives a real shop's opening stock more than Prisma's five seconds", () => {
    // Gillett Diesel's opening stock: 684 rows, which never fit in five seconds.
    expect(importTimeoutMs(684)).toBeGreaterThan(60_000);
  });

  it('grows with the file and stops at a ceiling', () => {
    expect(importTimeoutMs(10)).toBeLessThan(importTimeoutMs(1000));
    expect(importTimeoutMs(1_000_000)).toBe(10 * 60_000);
  });
});
