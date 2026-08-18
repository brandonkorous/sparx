// DB-backed coverage for scan-driven operations (docs/146 Phase 3.5–3.7, 3.9).
//
// This is the highest-trust-risk code in the phase. A warehouse adopts scanning
// once; if a dropped connection ever double-books a delivery, they go back to
// clipboards and never come back. So the things tested here are the promises,
// not the plumbing:
//
//   1. Replaying a scan with the same key applies it ONCE. This is the whole
//      offline story, and it has to hold across the receive, count and transfer
//      paths independently — each writes somewhere different.
//   2. A case code adds a case. Twelve, not one.
//   3. Over-receipt is REFUSED, with the numbers in the message.
//   4. A refused or unrecognised scan is still RECORDED, because "I scanned it
//      and nothing happened" is otherwise undiagnosable.
//   5. Posting a scanned session produces exactly the ledger a typed receipt
//      would — the scan is an input method, not a second way to receive stock.
//   6. Counting ACCUMULATES, and an item not on the sheet gets added to it.
//
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import crypto from 'node:crypto';

import { withTenant } from '@wizeworks/db';
import { withGs1CheckDigit } from '@wizeworks/commerce-schemas';

import { createBarcode } from '../../src/services/barcodes.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { createPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createInventoryCount } from '../../src/services/inventory-counts.js';
import { createInventoryTransfer } from '../../src/services/inventory-transfers.js';
import {
  listScanEvents,
  postScannedReceipt,
  receivingSession,
  replayScanQueue,
  scanToCount,
  scanToReceive,
  scanToTransfer,
  undoReceivingScan,
} from '../../src/services/scan-workflows.js';
import {
  createInventoryFixture,
  createTestTenant,
  dropTestTenant,
  type InventoryFixture,
} from '../helpers.js';

let gtinSeed = 0;
/** A fresh valid EAN-13. Registry uniqueness is tenant-wide, which is the point. */
function freshGtin(): string {
  gtinSeed += 1;
  return withGs1CheckDigit(`750${gtinSeed.toString().padStart(9, '0')}`);
}
function key(): string {
  return `scan-${crypto.randomBytes(8).toString('hex')}`;
}

describe('scan-driven operations — DB-backed', () => {
  let tenantId: string;
  const ctx = () => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** A submitted PO for `quantity` of one item, plus a barcode to scan at it. */
  async function orderedItem(quantity: number, packSize = 1) {
    const f = await createInventoryFixture(tenantId);
    const barcode = freshGtin();
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: barcode,
      packSize,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const supplier = await createSupplier(ctx(), {
      name: 'Test Supplier',
      code: `SUP-${crypto.randomBytes(3).toString('hex')}`,
    });
    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity, unitCostCents: 400 }],
    });
    await submitPurchaseOrder(ctx(), po.id, {});
    return { fixture: f, barcode, purchaseOrderId: po.id };
  }

  function levelOf(f: InventoryFixture) {
    return withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({
        where: { variantId_warehouseId: { variantId: f.variantId, warehouseId: f.warehouseId } },
      })
    );
  }

  // ── 1. Idempotency ─────────────────────────────────────────────────────────

  it('applies a replayed receiving scan exactly once', async () => {
    // The offline queue's core promise. The client keeps the key with the queued
    // scan and sends it again; the second arrival must change nothing at all.
    const { barcode, purchaseOrderId } = await orderedItem(10);
    const k = key();

    const first = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: k,
    });
    expect(first.outcome).toBe('applied');
    expect(first.sessionQuantity).toBe(1);

    const replay = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: k,
    });
    expect(replay.outcome).toBe('duplicate');

    const session = await receivingSession(ctx(), purchaseOrderId);
    expect(session.lines[0]?.scanned).toBe(1);
  });

  it('applies a replayed COUNT scan exactly once', async () => {
    // A separate write path, so a separate guarantee. Counting is where a double
    // application is most dangerous: it silently becomes a stock correction.
    const f = await createInventoryFixture(tenantId);
    const barcode = freshGtin();
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: barcode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const count = await createInventoryCount(ctx(), {
      warehouseId: f.warehouseId,
      type: 'cycle',
      variantIds: [f.variantId],
    });
    const k = key();

    await scanToCount(ctx(), { countId: count.id, value: barcode, idempotencyKey: k });
    const replay = await scanToCount(ctx(), {
      countId: count.id,
      value: barcode,
      idempotencyKey: k,
    });
    expect(replay.outcome).toBe('duplicate');

    const line = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findFirst({ where: { countId: count.id, variantId: f.variantId } })
    );
    expect(line?.countedQuantity).toBe(1);
  });

  it('applies a replayed TRANSFER scan exactly once', async () => {
    const from = await createInventoryFixture(tenantId);
    const to = await createInventoryFixture(tenantId);
    const barcode = freshGtin();
    await createBarcode(ctx(), {
      variantId: from.variantId,
      value: barcode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const transfer = await createInventoryTransfer(ctx(), {
      fromWarehouseId: from.warehouseId,
      toWarehouseId: to.warehouseId,
      lines: [],
    });
    const k = key();

    await scanToTransfer(ctx(), { transferId: transfer.id, value: barcode, idempotencyKey: k });
    const replay = await scanToTransfer(ctx(), {
      transferId: transfer.id,
      value: barcode,
      idempotencyKey: k,
    });
    expect(replay.outcome).toBe('duplicate');

    const lines = await withTenant(ctx(), (tx) =>
      tx.inventoryTransferLine.findMany({ where: { transferId: transfer.id } })
    );
    expect(lines).toHaveLength(1);
    expect(lines[0]?.quantity).toBe(1);
  });

  it('replays a whole queue idempotently, in the order the triggers were pulled', async () => {
    const { barcode, purchaseOrderId } = await orderedItem(10);
    const keys = [key(), key(), key()];
    const queue = keys.map((k, i) => ({
      contextType: 'receipt' as const,
      contextId: purchaseOrderId,
      value: barcode,
      idempotencyKey: k,
      scannedAt: new Date(Date.now() - (3 - i) * 60_000).toISOString(),
    }));

    const first = await replayScanQueue(ctx(), queue);
    expect(first.every((r) => r.outcome === 'applied')).toBe(true);
    expect((await receivingSession(ctx(), purchaseOrderId)).lines[0]?.scanned).toBe(3);

    // The client did not get our response and sends the same queue again.
    const second = await replayScanQueue(ctx(), queue);
    expect(second.every((r) => r.outcome === 'duplicate')).toBe(true);
    expect((await receivingSession(ctx(), purchaseOrderId)).lines[0]?.scanned).toBe(3);
  });

  it('records the gap between the trigger pull and our hearing about it', async () => {
    // This is what makes a replayed count honest: the sheet describes the shelf
    // as it was at 06:02, not as it was when the connection came back.
    const { barcode, purchaseOrderId } = await orderedItem(5);
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
      scannedAt: twoHoursAgo,
      deviceId: 'gun-04',
    });

    const { items } = await listScanEvents(ctx(), {
      contextType: 'receipt',
      contextId: purchaseOrderId,
    });
    expect(items[0]?.deviceId).toBe('gun-04');
    expect(items[0]?.replayLagSeconds).toBeGreaterThan(7000);
  });

  // ── 2. Pack size ───────────────────────────────────────────────────────────

  it('adds a case, not one, when the code on the box is a case code', async () => {
    // The single commonest silent receiving error there is, made impossible.
    const { barcode, purchaseOrderId } = await orderedItem(24, 12);
    const result = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
    });
    expect(result.quantity).toBe(12);
    expect(result.sessionQuantity).toBe(12);
  });

  // ── 3. Over-receipt ────────────────────────────────────────────────────────

  it('refuses to book more than was ordered, and says by how much', async () => {
    const { barcode, purchaseOrderId } = await orderedItem(2);
    await scanToReceive(ctx(), { purchaseOrderId, value: barcode, idempotencyKey: key() });
    await scanToReceive(ctx(), { purchaseOrderId, value: barcode, idempotencyKey: key() });

    const third = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
    });
    expect(third.outcome).toBe('rejected');
    expect(third.message).toMatch(/fully received/);
    expect((await receivingSession(ctx(), purchaseOrderId)).lines[0]?.scanned).toBe(2);
  });

  it('refuses a case that overshoots what is left, naming the remainder', async () => {
    const { barcode, purchaseOrderId } = await orderedItem(6, 12);
    const result = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
    });
    expect(result.outcome).toBe('rejected');
    expect(result.message).toMatch(/Only 6 more/);
  });

  it('refuses an item that is not on the purchase order at all', async () => {
    const { purchaseOrderId } = await orderedItem(10);
    const stranger = await createInventoryFixture(tenantId);
    const strangerCode = freshGtin();
    await createBarcode(ctx(), {
      variantId: stranger.variantId,
      value: strangerCode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });

    const result = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: strangerCode,
      idempotencyKey: key(),
    });
    expect(result.outcome).toBe('rejected');
    expect(result.message).toMatch(/is not on purchase order/);
  });

  // ── 4. Failed scans are still recorded ─────────────────────────────────────

  it('records an unrecognised code so "I scanned it and nothing happened" is answerable', async () => {
    const { purchaseOrderId } = await orderedItem(10);
    const result = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: '999888777666',
      idempotencyKey: key(),
    });
    expect(result.outcome).toBe('not_found');
    expect(result.scanEventId).not.toBeNull();

    const session = await receivingSession(ctx(), purchaseOrderId);
    expect(session.unresolved.map((u) => u.value)).toContain('999888777666');
  });

  // ── 5. Posting ─────────────────────────────────────────────────────────────

  it('posts a scanned session into the same ledger a typed receipt would write', async () => {
    const { fixture, barcode, purchaseOrderId } = await orderedItem(10);
    for (let i = 0; i < 4; i += 1) {
      await scanToReceive(ctx(), { purchaseOrderId, value: barcode, idempotencyKey: key() });
    }

    const receipt = await postScannedReceipt(ctx(), { purchaseOrderId, reference: 'PACK-1' });
    expect(receipt.quantityReceived).toBe(4);
    expect((await levelOf(fixture))?.onHand).toBe(4);

    const movements = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({ where: { variantId: fixture.variantId, reason: 'receive' } })
    );
    expect(movements).toHaveLength(1);
    expect(movements[0]?.delta).toBe(4);
  });

  it('empties the session on post, so a second post has nothing to post', async () => {
    const { barcode, purchaseOrderId } = await orderedItem(10);
    await scanToReceive(ctx(), { purchaseOrderId, value: barcode, idempotencyKey: key() });
    await postScannedReceipt(ctx(), { purchaseOrderId });

    expect((await receivingSession(ctx(), purchaseOrderId)).lines[0]?.scanned).toBe(0);
    await expect(postScannedReceipt(ctx(), { purchaseOrderId })).rejects.toThrow(
      /Nothing has been scanned/
    );
  });

  it('keeps the scans attached to the receipt they became', async () => {
    // The provenance that lets a receipt say which gun booked it.
    const { barcode, purchaseOrderId } = await orderedItem(10);
    await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
      deviceId: 'gun-07',
    });
    const receipt = await postScannedReceipt(ctx(), { purchaseOrderId });

    const { items } = await listScanEvents(ctx(), {
      contextType: 'receipt',
      contextId: receipt.id,
    });
    expect(items).toHaveLength(1);
    expect(items[0]?.deviceId).toBe('gun-07');
  });

  it('books damaged units as arrived-and-written-off, never as sellable stock', async () => {
    const { fixture, barcode, purchaseOrderId } = await orderedItem(10);
    await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
      quantity: 5,
      damagedQuantity: 2,
    });
    await postScannedReceipt(ctx(), { purchaseOrderId });

    // Three good units are sellable; the two broken ones arrived and were
    // written off, so the level nets to three rather than five.
    expect((await levelOf(fixture))?.onHand).toBe(3);
    const damage = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({ where: { variantId: fixture.variantId, reason: 'damage' } })
    );
    expect(damage).toHaveLength(1);
    expect(damage[0]?.delta).toBe(-2);
  });

  it('lets a mis-scan be undone before anything reaches the ledger', async () => {
    const { barcode, purchaseOrderId } = await orderedItem(10);
    const scan = await scanToReceive(ctx(), {
      purchaseOrderId,
      value: barcode,
      idempotencyKey: key(),
    });
    const after = await undoReceivingScan(ctx(), purchaseOrderId, scan.scanEventId!);
    expect(after.lines[0]?.scanned).toBe(0);
  });

  // ── 6. Counting ────────────────────────────────────────────────────────────

  it('accumulates, because counting a shelf is one pull per item', async () => {
    const f = await createInventoryFixture(tenantId);
    const barcode = freshGtin();
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: barcode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const count = await createInventoryCount(ctx(), {
      warehouseId: f.warehouseId,
      type: 'cycle',
      variantIds: [f.variantId],
    });

    for (let i = 0; i < 7; i += 1) {
      await scanToCount(ctx(), { countId: count.id, value: barcode, idempotencyKey: key() });
    }
    const line = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findFirst({ where: { countId: count.id, variantId: f.variantId } })
    );
    expect(line?.countedQuantity).toBe(7);
  });

  it('replaces rather than adds when the operator typed the total', async () => {
    const f = await createInventoryFixture(tenantId);
    const barcode = freshGtin();
    await createBarcode(ctx(), {
      variantId: f.variantId,
      value: barcode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const count = await createInventoryCount(ctx(), {
      warehouseId: f.warehouseId,
      type: 'cycle',
      variantIds: [f.variantId],
    });

    await scanToCount(ctx(), { countId: count.id, value: barcode, idempotencyKey: key() });
    await scanToCount(ctx(), {
      countId: count.id,
      value: barcode,
      idempotencyKey: key(),
      quantity: 40,
      accumulate: false,
    });
    const line = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findFirst({ where: { countId: count.id, variantId: f.variantId } })
    );
    expect(line?.countedQuantity).toBe(40);
  });

  it('adds an item the sheet did not have — that discovery is the point of counting', async () => {
    const onSheet = await createInventoryFixture(tenantId);
    const surprise = await createInventoryFixture(tenantId);
    const surpriseCode = freshGtin();
    await createBarcode(ctx(), {
      variantId: surprise.variantId,
      value: surpriseCode,
      packSize: 1,
      isPrimary: true,
      source: 'manual',
      allowInvalidCheckDigit: false,
    });
    const count = await createInventoryCount(ctx(), {
      warehouseId: onSheet.warehouseId,
      type: 'cycle',
      variantIds: [onSheet.variantId],
    });

    const result = await scanToCount(ctx(), {
      countId: count.id,
      value: surpriseCode,
      idempotencyKey: key(),
    });
    expect(result.outcome).toBe('applied');

    const lines = await withTenant(ctx(), (tx) =>
      tx.inventoryCountLine.findMany({ where: { countId: count.id } })
    );
    expect(lines).toHaveLength(2);
    const added = lines.find((l) => l.variantId === surprise.variantId);
    // Expected zero: the system did not know this was here, which IS the variance.
    expect(added?.expectedQuantity).toBe(0);
    expect(added?.countedQuantity).toBe(1);
  });
});
