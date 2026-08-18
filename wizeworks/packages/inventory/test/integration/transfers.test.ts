// DB-backed coverage for the transfers engine (docs/100 P4): a transfer moves
// stock between two warehouses through a system in-transit holding location, so
// total stock is conserved at every step. Draft → ship (source → in-transit) →
// receive (in-transit → destination); a short receipt is written off in transit,
// and cancelling an in-transit transfer returns the goods to source. Requires
// `pnpm db:up`; skipped in CI per vitest.config.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@wizeworks/db';

import { adjust } from '../../src/services/movements.js';
import { getLevel } from '../../src/services/levels.js';
import { listWarehouses } from '../../src/services/warehouses.js';
import {
  createInventoryTransfer,
  getInventoryTransfer,
} from '../../src/services/inventory-transfers.js';
import {
  cancelInventoryTransfer,
  receiveInventoryTransfer,
  shipInventoryTransfer,
} from '../../src/services/inventory-transfer-lifecycle.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('inventory transfers', () => {
  let tenantId: string;
  let fromWarehouseId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
    fromWarehouseId = (await createInventoryFixture(tenantId)).warehouseId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  async function newWarehouse(): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const w = await tx.warehouse.create({
        data: { tenantId, name: `WH ${tag}`, code: `WH-${tag}` },
      });
      return w.id;
    });
  }

  async function newVariant(): Promise<string> {
    const tag = crypto.randomBytes(3).toString('hex');
    return withTenant(ctx(), async (tx) => {
      const product = await tx.product.create({
        data: { tenantId, title: `Part ${tag}`, handle: `part-${tag}`, status: 'active' },
      });
      const v = await tx.productVariant.create({
        data: {
          tenantId,
          productId: product.id,
          sku: `SKU-${tag}`,
          priceCents: 1000,
          costCents: 500,
          currency: 'USD',
          isDefault: true,
        },
      });
      return v.id;
    });
  }

  async function stock(variantId: string, warehouseId: string, onHand: number): Promise<void> {
    if (onHand !== 0) {
      await adjust(ctx(), { variantId, warehouseId, delta: onHand, reason: 'manual' });
    }
  }

  function onHandAt(variantId: string, warehouseId: string): Promise<number> {
    return getLevel(ctx(), variantId, warehouseId).then((l) => l?.onHand ?? 0);
  }

  /** Total on-hand for a variant across EVERY warehouse (incl. in-transit). */
  function totalOnHand(variantId: string): Promise<number> {
    return withTenant(ctx(), (tx) =>
      tx.inventoryLevel
        .findMany({ where: { variantId }, select: { onHand: true } })
        .then((rows) => rows.reduce((sum, r) => sum + r.onHand, 0))
    );
  }

  function inTransitWarehouseId(): Promise<string | null> {
    return withTenant(ctx(), (tx) =>
      tx.warehouse
        .findFirst({ where: { isSystem: true }, select: { id: true } })
        .then((w) => w?.id ?? null)
    );
  }

  it('ships through in-transit and receives at the destination, conserving total stock', async () => {
    const toWarehouseId = await newWarehouse();
    const a = await newVariant();
    const b = await newVariant();
    await stock(a, fromWarehouseId, 30);
    await stock(b, fromWarehouseId, 12);
    const totalA = await totalOnHand(a);
    const totalB = await totalOnHand(b);

    const draft = await createInventoryTransfer(ctx(), {
      fromWarehouseId,
      toWarehouseId,
      lines: [
        { variantId: a, quantity: 10 },
        { variantId: b, quantity: 5 },
      ],
    });
    expect(draft.status).toBe('draft');
    expect(draft.lineCount).toBe(2);
    expect(draft.totalQuantity).toBe(15);

    // Ship: source drops, the units sit in the in-transit warehouse, total unchanged.
    const shipped = await shipInventoryTransfer(ctx(), draft.id);
    expect(shipped.status).toBe('in_transit');
    expect(shipped.shippedAt).not.toBeNull();
    expect(await onHandAt(a, fromWarehouseId)).toBe(20);
    expect(await onHandAt(b, fromWarehouseId)).toBe(7);
    const transitId = (await inTransitWarehouseId())!;
    expect(transitId).not.toBeNull();
    expect(await onHandAt(a, transitId)).toBe(10);
    expect(await onHandAt(b, transitId)).toBe(5);
    expect(await totalOnHand(a)).toBe(totalA); // conserved in motion
    expect(await totalOnHand(b)).toBe(totalB);
    // In-transit is a system warehouse — excluded from the ordinary picker.
    const { items } = await listWarehouses(ctx());
    expect(items.some((w) => w.id === transitId)).toBe(false);

    // Receive in full: in-transit drains, destination gains, total still conserved.
    const received = await receiveInventoryTransfer(ctx(), draft.id, {});
    expect(received.status).toBe('received');
    expect(received.receivedAt).not.toBeNull();
    expect(await onHandAt(a, toWarehouseId)).toBe(10);
    expect(await onHandAt(b, toWarehouseId)).toBe(5);
    expect(await onHandAt(a, transitId)).toBe(0);
    expect(await onHandAt(b, transitId)).toBe(0);
    expect(await totalOnHand(a)).toBe(totalA);
    expect(await totalOnHand(b)).toBe(totalB);
    for (const line of received.lines) expect(line.receivedQuantity).toBe(line.quantity);

    // Idempotent terminal: re-shipping / re-receiving a received transfer is rejected.
    await expect(shipInventoryTransfer(ctx(), draft.id)).rejects.toThrow(/received/i);
    await expect(receiveInventoryTransfer(ctx(), draft.id, {})).rejects.toThrow(/received/i);
  });

  it('blocks shipping when the source lacks available stock', async () => {
    const toWarehouseId = await newWarehouse();
    const a = await newVariant();
    await stock(a, fromWarehouseId, 3);

    const draft = await createInventoryTransfer(ctx(), {
      fromWarehouseId,
      toWarehouseId,
      lines: [{ variantId: a, quantity: 10 }],
    });
    await expect(shipInventoryTransfer(ctx(), draft.id)).rejects.toThrow(/out of stock/i);

    // Nothing moved; the transfer is still an editable draft.
    expect(await onHandAt(a, fromWarehouseId)).toBe(3);
    expect((await getInventoryTransfer(ctx(), draft.id)).status).toBe('draft');
  });

  it('cancels an in-transit transfer by returning the goods to source', async () => {
    const toWarehouseId = await newWarehouse();
    const a = await newVariant();
    await stock(a, fromWarehouseId, 8);

    const draft = await createInventoryTransfer(ctx(), {
      fromWarehouseId,
      toWarehouseId,
      lines: [{ variantId: a, quantity: 6 }],
    });
    await shipInventoryTransfer(ctx(), draft.id);
    const transitId = (await inTransitWarehouseId())!;
    expect(await onHandAt(a, fromWarehouseId)).toBe(2);
    expect(await onHandAt(a, transitId)).toBe(6);

    const cancelled = await cancelInventoryTransfer(ctx(), draft.id);
    expect(cancelled.status).toBe('cancelled');
    expect(cancelled.cancelledAt).not.toBeNull();
    // The goods came back to source; in-transit is drained again.
    expect(await onHandAt(a, fromWarehouseId)).toBe(8);
    expect(await onHandAt(a, transitId)).toBe(0);
    expect(await onHandAt(a, toWarehouseId)).toBe(0);
  });

  it('writes a short receipt off in transit (destination gets the received amount)', async () => {
    const toWarehouseId = await newWarehouse();
    const a = await newVariant();
    await stock(a, fromWarehouseId, 10);
    const total = await totalOnHand(a);

    const draft = await createInventoryTransfer(ctx(), {
      fromWarehouseId,
      toWarehouseId,
      lines: [{ variantId: a, quantity: 10 }],
    });
    const shipped = await shipInventoryTransfer(ctx(), draft.id);
    const lineId = shipped.lines[0]!.id;
    const transitId = (await inTransitWarehouseId())!;

    // Only 7 of the 10 arrive — the 3-unit shortfall is written off in transit.
    const received = await receiveInventoryTransfer(ctx(), draft.id, {
      lines: [{ lineId, receivedQuantity: 7 }],
    });
    expect(received.status).toBe('received');
    expect(received.lines[0]!.receivedQuantity).toBe(7);
    expect(await onHandAt(a, toWarehouseId)).toBe(7);
    expect(await onHandAt(a, transitId)).toBe(0); // nothing stranded
    expect(await onHandAt(a, fromWarehouseId)).toBe(0);
    // 3 units lost in transit — total drops by exactly the shortfall.
    expect(await totalOnHand(a)).toBe(total - 3);
  });
});
