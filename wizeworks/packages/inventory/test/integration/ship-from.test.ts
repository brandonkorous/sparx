// The place online orders ship from (issue 929), against the database.
//
//   1. With no place named, the oldest place of her own ships, and the list
//      and the resolver say the same thing.
//   2. Naming another place moves the channel there and takes it off the old
//      one, so two places never both claim it.
//   3. One place read on its own says how much is in it and whether it ships,
//      so its pane can say both.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import {
  createWarehouse,
  getWarehouse,
  listWarehouses,
  updateWarehouse,
} from '../../src/services/warehouses.js';
import { resolveDefaultWarehouseId } from '../../src/services/sell-path.js';
import { createTestTenant, dropTestTenant } from '../helpers.js';

const address = { line1: '1 Dock Rd', city: 'Portland', postalCode: '97214', country: 'US' };

describe('where online orders ship from', () => {
  let tenantId: string;
  let userId: string;
  const ctx = () => ({ tenantId, userId });

  beforeAll(async () => {
    const tenant = await createTestTenant();
    tenantId = tenant.tenantId;
    userId = tenant.userId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  const shipping = async () =>
    (await listWarehouses(ctx())).items.filter((row) => row.shipsOnline).map((row) => row.code);

  it('is the oldest place of her own when none is named, on screen and in postage', async () => {
    const studio = await createWarehouse(ctx(), { name: 'Studio', code: 'STUDIO', address });
    await createWarehouse(ctx(), { name: 'Back room', code: 'BACK', address });
    expect(await shipping()).toEqual(['STUDIO']);
    expect(await resolveDefaultWarehouseId(ctx(), 'storefront')).toBe(studio.id);
  });

  it('moves to the place she names, and leaves the old one', async () => {
    const shop = await createWarehouse(ctx(), {
      name: 'Shop',
      code: 'SHOP',
      address,
      defaultForChannel: ['storefront'],
    });
    expect(await shipping()).toEqual(['SHOP']);

    const { items } = await listWarehouses(ctx());
    const back = items.find((row) => row.code === 'BACK')!;
    const moved = await updateWarehouse(ctx(), back.id, { defaultForChannel: ['storefront'] });
    expect(moved.shipsOnline).toBe(true);

    const after = (await listWarehouses(ctx())).items;
    expect(
      after.filter((row) => row.defaultForChannel.includes('storefront')).map((r) => r.code)
    ).toEqual(['BACK']);
    expect(await shipping()).toEqual(['BACK']);
    expect(await resolveDefaultWarehouseId(ctx(), 'storefront')).not.toBe(shop.id);
  });

  it('reads one place with its counts and whether it ships', async () => {
    const { items } = await listWarehouses(ctx());
    const back = items.find((row) => row.code === 'BACK')!;
    const one = await getWarehouse(ctx(), back.id);
    expect(one.onHand).toBe(0);
    expect(one.binCount).toBe(0);
    expect(one.shipsOnline).toBe(true);
  });
});
