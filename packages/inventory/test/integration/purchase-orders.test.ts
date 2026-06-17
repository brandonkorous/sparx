// DB-backed coverage for the purchase-order domain (docs/100 P3b): create with
// defaulted line costs + computed totals + per-tenant numbering, draft line
// mutations, the submit/cancel/close lifecycle (status guards, dates, empty
// guard), the supplier archive guard, and the print document. Requires
// `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import crypto from 'node:crypto';

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../../src/errors.js';
import { archiveSupplier, createSupplier } from '../../src/services/suppliers.js';
import { upsertSupplierVariant } from '../../src/services/supplier-variants.js';
import {
  createPurchaseOrder,
  deletePurchaseOrder,
  getPurchaseOrder,
  listPurchaseOrders,
  updatePurchaseOrder,
} from '../../src/services/purchase-orders.js';
import {
  addPurchaseOrderLine,
  removePurchaseOrderLine,
  updatePurchaseOrderLine,
} from '../../src/services/purchase-order-lines.js';
import {
  cancelPurchaseOrder,
  closePurchaseOrder,
  submitPurchaseOrder,
} from '../../src/services/purchase-order-lifecycle.js';
import { buildPurchaseOrderDocumentHtml } from '../../src/services/purchase-order-document.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

const DAY_MS = 24 * 60 * 60 * 1000;

describe('purchase-order service — create, lines, lifecycle', () => {
  let tenantId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  /** Add a second variant (cost 500) to the fixture's product so a PO can carry
   *  two lines — one supplier-linked, one falling back to the variant cost. */
  async function secondVariant(productId: string): Promise<string> {
    const v = await withTenant(ctx(), (tx) =>
      tx.productVariant.create({
        data: {
          tenantId,
          productId,
          sku: `SKU2-${crypto.randomBytes(3).toString('hex')}`,
          priceCents: 1500,
          costCents: 500,
          currency: 'USD',
        },
      })
    );
    return v.id;
  }

  it('creates a draft, defaults line costs, computes totals, numbers per tenant', async () => {
    const f = await createInventoryFixture(tenantId);
    const v2 = await secondVariant(f.productId);
    const supplier = await createSupplier(ctx(), { name: 'Bosch', code: 'BOSCH', leadTimeDays: 5 });
    // A supplier link sets the cost for the first variant (480); the second has
    // no link and must fall back to the variant cost (500).
    await upsertSupplierVariant(ctx(), supplier.id, {
      variantId: f.variantId,
      unitCostCents: 480,
      supplierSku: 'BSH-1',
    });

    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      shippingCents: 200,
      lines: [
        { variantId: f.variantId, quantity: 10 }, // → 480 from the link
        { variantId: v2, quantity: 5 }, // → 500 from the variant cost
      ],
    });

    expect(po.number).toBe('PO-000001');
    expect(po.status).toBe('draft');
    expect(po.lines).toHaveLength(2);
    const linked = po.lines.find((l) => l.variantId === f.variantId);
    expect(linked?.unitCostCents).toBe(480);
    expect(linked?.supplierSku).toBe('BSH-1'); // snapshot from the link
    expect(po.lines.find((l) => l.variantId === v2)?.unitCostCents).toBe(500);
    // subtotal 10*480 + 5*500 = 7300; + shipping 200 → 7500
    expect(po.subtotalCents).toBe(7300);
    expect(po.totalCents).toBe(7500);
    expect(po.quantityOrdered).toBe(15);
    expect(po.quantityReceived).toBe(0);

    // Per-tenant monotonic numbering.
    const po2 = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [],
    });
    expect(po2.number).toBe('PO-000002');

    // Filter by status.
    const drafts = await listPurchaseOrders(ctx(), { status: 'draft' });
    expect(drafts.items.every((p) => p.status === 'draft')).toBe(true);

    // A draft with no lines can be deleted outright.
    await deletePurchaseOrder(ctx(), po2.id);
    await expect(getPurchaseOrder(ctx(), po2.id)).rejects.toBeInstanceOf(InventoryNotFoundError);
  });

  it('mutates draft lines + shipping, then locks + dates on submit; empty PO cannot submit', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), { name: 'Acme', code: 'ACME', leadTimeDays: 7 });

    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      lines: [],
    });

    // Empty PO refuses to submit.
    await expect(submitPurchaseOrder(ctx(), po.id, {})).rejects.toBeInstanceOf(
      InventoryValidationError
    );

    // Add a line (variant cost 500), bump its quantity, add shipping.
    let detail = await addPurchaseOrderLine(ctx(), po.id, { variantId: f.variantId, quantity: 3 });
    expect(detail.subtotalCents).toBe(1500);
    const lineId = detail.lines[0]!.id;
    detail = await updatePurchaseOrderLine(ctx(), po.id, lineId, { quantity: 4 });
    expect(detail.subtotalCents).toBe(2000);
    detail = await updatePurchaseOrder(ctx(), po.id, { shippingCents: 350 });
    expect(detail.totalCents).toBe(2350);

    // Submit → ordered + expected arrival from the 7-day lead time.
    const submitted = await submitPurchaseOrder(ctx(), po.id, {});
    expect(submitted.status).toBe('submitted');
    expect(submitted.orderedAt).not.toBeNull();
    expect(submitted.expectedArrivalAt).not.toBeNull();
    const lead =
      new Date(submitted.expectedArrivalAt!).getTime() - new Date(submitted.orderedAt!).getTime();
    expect(Math.abs(lead - 7 * DAY_MS)).toBeLessThan(60_000);

    // Submitted PO is locked: no header edit, no line add, no delete.
    await expect(updatePurchaseOrder(ctx(), po.id, { shippingCents: 0 })).rejects.toBeInstanceOf(
      InventoryConflictError
    );
    await expect(
      addPurchaseOrderLine(ctx(), po.id, { variantId: f.variantId, quantity: 1 })
    ).rejects.toBeInstanceOf(InventoryConflictError);
    await expect(removePurchaseOrderLine(ctx(), po.id, lineId)).rejects.toBeInstanceOf(
      InventoryConflictError
    );
    await expect(deletePurchaseOrder(ctx(), po.id)).rejects.toBeInstanceOf(InventoryConflictError);

    // Cancel a submitted (nothing-received) order.
    const cancelled = await cancelPurchaseOrder(ctx(), po.id);
    expect(cancelled.status).toBe('cancelled');
  });

  it('guards supplier archive while a PO is open, renders the document, and closes', async () => {
    const f = await createInventoryFixture(tenantId);
    const supplier = await createSupplier(ctx(), { name: 'Gates', code: 'GATES', leadTimeDays: 3 });

    const po = await createPurchaseOrder(ctx(), {
      supplierId: supplier.id,
      warehouseId: f.warehouseId,
      reference: 'WO-42',
      lines: [{ variantId: f.variantId, quantity: 6, unitCostCents: 250 }],
    });
    await submitPurchaseOrder(ctx(), po.id, {});

    // Archiving a supplier with an open PO is blocked.
    await expect(archiveSupplier(ctx(), supplier.id)).rejects.toBeInstanceOf(
      InventoryConflictError
    );

    // The print document renders the PO substance.
    const html = await buildPurchaseOrderDocumentHtml(ctx(), po.id);
    expect(html).toContain('Purchase Order');
    expect(html).toContain(po.number);
    expect(html).toContain('Gates');

    // Close (stop receiving) → terminal; the supplier can now be archived.
    const closed = await closePurchaseOrder(ctx(), po.id);
    expect(closed.status).toBe('closed');
    await archiveSupplier(ctx(), supplier.id); // no longer "open" → allowed
  });
});
