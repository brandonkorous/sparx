// DB-backed coverage for the supplier domain (docs/100 P3a): CRUD + code-collision
// + soft archive, and the per-variant purchasing links incl. the preferred-source
// exclusivity invariant (at most one preferred supplier per variant) and SKU
// lookup. Requires `pnpm db:up`; skipped in CI (no DB) per vitest.config.ts.

import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { withTenant } from '@sparx/db';

import { InventoryConflictError, InventoryNotFoundError } from '../../src/errors.js';
import {
  archiveSupplier,
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
} from '../../src/services/suppliers.js';
import {
  listSupplierVariants,
  lookupVariantBySku,
  removeSupplierVariant,
  suppliersForVariant,
  upsertSupplierVariant,
} from '../../src/services/supplier-variants.js';
import { createInventoryFixture, createTestTenant, dropTestTenant } from '../helpers.js';

describe('supplier service — CRUD + purchasing links', () => {
  let tenantId: string;
  const ctx = (): { tenantId: string } => ({ tenantId });

  beforeAll(async () => {
    tenantId = (await createTestTenant()).tenantId;
  });
  afterAll(async () => {
    await dropTestTenant(tenantId);
  });

  it('creates, reads, updates, blocks code collision, and soft-archives', async () => {
    const { id } = await createSupplier(ctx(), {
      name: 'Bosch',
      code: 'BOSCH',
      paymentTerms: 'net30',
      leadTimeDays: 7,
    });

    const got = await getSupplier(ctx(), id);
    expect(got.code).toBe('BOSCH');
    expect(got.currency).toBe('USD'); // schema default applied
    expect(got.leadTimeDays).toBe(7);

    await expect(createSupplier(ctx(), { name: 'Dup', code: 'BOSCH' })).rejects.toBeInstanceOf(
      InventoryConflictError
    );

    const updated = await updateSupplier(ctx(), id, { leadTimeDays: 14, contactName: 'Hans' });
    expect(updated.leadTimeDays).toBe(14);
    expect(updated.contactName).toBe('Hans');

    // Active list shows it.
    expect((await listSuppliers(ctx(), {})).items.some((s) => s.id === id)).toBe(true);

    // Deactivate (isActive:false, not archived): hidden from the default list,
    // still carried by the include-inactive list.
    await updateSupplier(ctx(), id, { isActive: false });
    expect((await listSuppliers(ctx(), {})).items.some((s) => s.id === id)).toBe(false);
    expect(
      (await listSuppliers(ctx(), { includeInactive: true })).items.some((s) => s.id === id)
    ).toBe(true);

    // Archive (soft delete): gone from every list; get() 404s.
    await archiveSupplier(ctx(), id);
    expect(
      (await listSuppliers(ctx(), { includeInactive: true })).items.some((s) => s.id === id)
    ).toBe(false);
    await expect(getSupplier(ctx(), id)).rejects.toBeInstanceOf(InventoryNotFoundError);
  });

  it('upserts purchasing links, enforces one preferred supplier per variant, looks up by SKU', async () => {
    const f = await createInventoryFixture(tenantId);
    const variant = await withTenant(ctx(), (tx) =>
      tx.productVariant.findUnique({ where: { id: f.variantId }, select: { sku: true } })
    );
    const sku = variant?.sku ?? '';

    const a = await createSupplier(ctx(), { name: 'Supplier A', code: 'SUP-A' });
    const b = await createSupplier(ctx(), { name: 'Supplier B', code: 'SUP-B' });

    // SKU → variant resolver (the add-link form's path).
    const lookup = await lookupVariantBySku(ctx(), sku);
    expect(lookup.variantId).toBe(f.variantId);
    await expect(lookupVariantBySku(ctx(), 'NO-SUCH-SKU')).rejects.toBeInstanceOf(
      InventoryNotFoundError
    );

    // A is preferred at cost 500; then B becomes preferred at 480 → A's flag clears.
    await upsertSupplierVariant(ctx(), a.id, {
      variantId: f.variantId,
      unitCostCents: 500,
      supplierSku: 'A-123',
      isPreferred: true,
    });
    await upsertSupplierVariant(ctx(), b.id, {
      variantId: f.variantId,
      unitCostCents: 480,
      isPreferred: true,
    });

    expect((await listSupplierVariants(ctx(), a.id))[0]?.isPreferred).toBe(false);
    expect((await listSupplierVariants(ctx(), b.id))[0]?.isPreferred).toBe(true);

    // Reverse lookup is preferred-first; B (preferred) leads.
    const offers = await suppliersForVariant(ctx(), f.variantId);
    expect(offers.length).toBe(2);
    expect(offers[0]?.supplierId).toBe(b.id);
    expect(offers[0]?.isPreferred).toBe(true);
    expect(offers[0]?.variantSku).toBe(sku);

    // Re-upsert updates detail without touching the preferred flag.
    const reUp = await upsertSupplierVariant(ctx(), b.id, {
      variantId: f.variantId,
      unitCostCents: 450,
    });
    expect(reUp.unitCostCents).toBe(450);
    expect(reUp.isPreferred).toBe(true);

    // Remove A's link.
    await removeSupplierVariant(ctx(), a.id, f.variantId);
    expect((await listSupplierVariants(ctx(), a.id)).length).toBe(0);
    expect((await suppliersForVariant(ctx(), f.variantId)).length).toBe(1);
  });
});
