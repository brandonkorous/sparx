// DB-backed coverage for receiving (docs/100 P3c): a receipt raises stock through
// the ledger (receive movements), bumps the PO line's received count + advances
// the PO to partial/received, seeds + blends the moving-average cost, mints/extends
// a lot, and guards against receiving an un-orderable PO or an unknown line.
// Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { InventoryConflictError, InventoryValidationError } from '../../src/errors.js';
import { createSupplier } from '../../src/services/suppliers.js';
import { createPurchaseOrder, getPurchaseOrder } from '../../src/services/purchase-orders.js';
import { submitPurchaseOrder } from '../../src/services/purchase-order-lifecycle.js';
import { createGoodsReceipt } from '../../src/services/goods-receipts.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('goods-receipt service — receiving', () => {
  let tenantId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  function levelOf(variantId: string, warehouseId: string) {
    return withTenant(ctx(), (tx) =>
      tx.inventoryLevel.findUnique({ where: { variantId_warehouseId: { variantId, warehouseId } } })
    );
  }

  it('receives partial then full, raising stock + advancing the PO status', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), { name: 'Bosch', code: 'BOSCH' });
    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity: 10, unitCostCents: 400 }],
    });
    const submitted = await submitPurchaseOrder(ctx(), po.id, {});
    const poLineId = submitted.lines[0]!.id;

    // Partial: receive 4 of 10.
    const r1 = await createGoodsReceipt(ctx(), {
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderLineId: poLineId, quantity: 4 }],
    });
    expect(r1.number).toBe('GR-000001');
    expect(r1.quantityReceived).toBe(4);

    let poNow = await getPurchaseOrder(ctx(), po.id);
    expect(poNow.status).toBe('partial');
    expect(poNow.lines[0]!.quantityReceived).toBe(4);

    const lvl1 = await levelOf(f.variantId, f.warehouseId);
    expect(lvl1?.onHand).toBe(4);
    expect(lvl1?.avgCostCents).toBe(400); // seeded from the receipt cost (onHand was 0)

    const moves = await withTenant(ctx(), (tx) =>
      tx.inventoryMovement.findMany({ where: { variantId: f.variantId, reason: 'receive' } })
    );
    expect(moves).toHaveLength(1);

    // Full: receive the remaining 6 → PO received.
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: po.id,
      lines: [{ purchaseOrderLineId: poLineId, quantity: 6 }],
    });
    poNow = await getPurchaseOrder(ctx(), po.id);
    expect(poNow.status).toBe('received');
    expect(poNow.receivedAt).not.toBeNull();
    expect(poNow.lines[0]!.quantityReceived).toBe(10);
    expect((await levelOf(f.variantId, f.warehouseId))?.onHand).toBe(10);

    // A fully-received PO can't be received against again.
    await expect(
      createGoodsReceipt(ctx(), {
        purchaseOrderId: po.id,
        lines: [{ purchaseOrderLineId: poLineId, quantity: 1 }],
      })
    ).rejects.toBeInstanceOf(InventoryConflictError);
  });

  it('mints/extends a lot on receipt and blends the moving-average cost', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), { name: 'Acme', code: 'ACME' });
    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity: 8, unitCostCents: 300 }],
    });
    const submitted = await submitPurchaseOrder(ctx(), po.id, {});
    const poLineId = submitted.lines[0]!.id;

    // Receive 5 @ 300 into LOT-A → avg seeds to 300.
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: po.id,
      lines: [
        { purchaseOrderLineId: poLineId, quantity: 5, unitCostCents: 300, lotNumber: 'LOT-A' },
      ],
    });
    const lotA1 = await withTenant(ctx(), (tx) =>
      tx.lotBatch.findFirst({ where: { variantId: f.variantId, lotNumber: 'LOT-A' } })
    );
    expect(lotA1?.quantity).toBe(5);
    expect((await levelOf(f.variantId, f.warehouseId))?.avgCostCents).toBe(300);

    // Receive 3 @ 500 into the SAME lot → lot accumulates to 8; avg blends to
    // (5*300 + 3*500) / 8 = 375.
    await createGoodsReceipt(ctx(), {
      purchaseOrderId: po.id,
      lines: [
        { purchaseOrderLineId: poLineId, quantity: 3, unitCostCents: 500, lotNumber: 'LOT-A' },
      ],
    });
    const lotA2 = await withTenant(ctx(), (tx) =>
      tx.lotBatch.findFirst({ where: { variantId: f.variantId, lotNumber: 'LOT-A' } })
    );
    expect(lotA2?.quantity).toBe(8);
    const lvl = await levelOf(f.variantId, f.warehouseId);
    expect(lvl?.onHand).toBe(8);
    expect(lvl?.avgCostCents).toBe(375);
  });

  it('rejects receiving against a draft PO and an unknown line', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), { name: 'Gates', code: 'GATES' });
    const draft = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [{ variantId: f.variantId, quantity: 5 }],
    });
    const poLineId = draft.lines[0]!.id;

    // A draft PO is not orderable yet → cannot receive.
    await expect(
      createGoodsReceipt(ctx(), {
        purchaseOrderId: draft.id,
        lines: [{ purchaseOrderLineId: poLineId, quantity: 1 }],
      })
    ).rejects.toBeInstanceOf(InventoryConflictError);

    // After submit, a line id that isn't on the PO is rejected.
    await submitPurchaseOrder(ctx(), draft.id, {});
    await expect(
      createGoodsReceipt(ctx(), {
        purchaseOrderId: draft.id,
        lines: [{ purchaseOrderLineId: f.warehouseId, quantity: 1 }],
      })
    ).rejects.toBeInstanceOf(InventoryValidationError);
  });
});
