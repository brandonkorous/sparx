// Per-variant purchasing detail for a supplier (docs/100 P3a) — the supplier's
// SKU, purchase cost, MOQ, lead time, and whether it's the preferred source. One
// row per (supplier, variant); a variant can be sourced from several suppliers,
// at most ONE of which is preferred. Upsert keeps that invariant by clearing the
// preferred flag on the variant's other links. These links feed PO line defaults
// and the reorder engine's supplier pick (P3b/P3d).

import { UpsertSupplierVariantInput } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

import { ensureVariantExists } from './internal';

export interface SupplierVariantRow {
  id: string;
  supplierId: string;
  variantId: string;
  supplierSku: string | null;
  unitCostCents: number | null;
  minOrderQty: number | null;
  leadTimeDays: number | null;
  isPreferred: boolean;
  variantSku: string | null;
  productTitle: string | null;
  createdAt: string;
  updatedAt: string;
}

interface SupplierVariantWithVariant {
  id: string;
  supplierId: string;
  variantId: string;
  supplierSku: string | null;
  unitCostCents: number | null;
  minOrderQty: number | null;
  leadTimeDays: number | null;
  isPreferred: boolean;
  createdAt: Date;
  updatedAt: Date;
  variant?: { sku: string | null; product: { title: string | null } | null } | null;
}

/** All purchasing links for a supplier, richest detail first. */
export async function listSupplierVariants(
  ctx: ServiceContext,
  supplierId: string
): Promise<SupplierVariantRow[]> {
  return withTenant(ctx, async (tx) => {
    await ensureSupplierExists(tx, supplierId);
    const rows = await tx.supplierVariant.findMany({
      where: { supplierId },
      orderBy: [{ isPreferred: 'desc' }, { createdAt: 'asc' }],
      include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
    });
    return rows.map(serializeSupplierVariant);
  });
}

/** The suppliers that offer a variant (reverse lookup) — preferred first. Feeds
 *  the reorder engine's supplier pick + the PO drafting flow (P3b/P3d). */
export async function suppliersForVariant(
  ctx: ServiceContext,
  variantId: string
): Promise<SupplierVariantRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.supplierVariant.findMany({
      where: { variantId, supplier: { deletedAt: null, isActive: true } },
      orderBy: [{ isPreferred: 'desc' }, { unitCostCents: 'asc' }],
      include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
    });
    return rows.map(serializeSupplierVariant);
  });
}

/** Upsert a (supplier, variant) link. Setting `isPreferred` clears the flag on
 *  the variant's OTHER supplier links so at most one supplier is preferred. */
export async function upsertSupplierVariant(
  ctx: ServiceContext,
  supplierId: string,
  rawInput: unknown
): Promise<SupplierVariantRow> {
  const input = UpsertSupplierVariantInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    await ensureSupplierExists(tx, supplierId);
    await ensureVariantExists(tx, input.variantId);

    if (input.isPreferred === true) {
      await tx.supplierVariant.updateMany({
        where: { variantId: input.variantId, isPreferred: true, NOT: { supplierId } },
        data: { isPreferred: false },
      });
    }

    const row = await tx.supplierVariant.upsert({
      where: { supplierId_variantId: { supplierId, variantId: input.variantId } },
      create: {
        tenantId: ctx.tenantId,
        supplierId,
        variantId: input.variantId,
        supplierSku: input.supplierSku ?? null,
        unitCostCents: input.unitCostCents ?? null,
        minOrderQty: input.minOrderQty ?? null,
        leadTimeDays: input.leadTimeDays ?? null,
        isPreferred: input.isPreferred ?? false,
      },
      update: {
        ...(input.supplierSku !== undefined ? { supplierSku: input.supplierSku } : {}),
        ...(input.unitCostCents !== undefined ? { unitCostCents: input.unitCostCents } : {}),
        ...(input.minOrderQty !== undefined ? { minOrderQty: input.minOrderQty } : {}),
        ...(input.leadTimeDays !== undefined ? { leadTimeDays: input.leadTimeDays } : {}),
        ...(input.isPreferred !== undefined ? { isPreferred: input.isPreferred } : {}),
      },
      include: { variant: { select: { sku: true, product: { select: { title: true } } } } },
    });
    return serializeSupplierVariant(row);
  });
}

/** Remove a (supplier, variant) link. Idempotent — an unknown pair no-ops. */
export async function removeSupplierVariant(
  ctx: ServiceContext,
  supplierId: string,
  variantId: string
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.supplierVariant.deleteMany({ where: { supplierId, variantId } });
  });
}

export interface VariantLookupRow {
  variantId: string;
  sku: string;
  productTitle: string | null;
}

/** Resolve a variant by its SKU (the natural key buyers know). Powers the
 *  supplier-detail "add purchasing link" form, which collects a SKU not a UUID. */
export async function lookupVariantBySku(
  ctx: ServiceContext,
  sku: string
): Promise<VariantLookupRow> {
  const variant = await withTenant(ctx, (tx) =>
    tx.productVariant.findFirst({
      where: { sku, deletedAt: null },
      select: { id: true, sku: true, product: { select: { title: true } } },
    })
  );
  if (!variant) throw new InventoryNotFoundError('ProductVariant', sku);
  return { variantId: variant.id, sku: variant.sku, productTitle: variant.product?.title ?? null };
}

async function ensureSupplierExists(tx: TxClient, supplierId: string): Promise<void> {
  const supplier = await tx.supplier.findFirst({
    where: { id: supplierId, deletedAt: null },
    select: { id: true },
  });
  if (!supplier) throw new InventoryNotFoundError('Supplier', supplierId);
}

function serializeSupplierVariant(row: SupplierVariantWithVariant): SupplierVariantRow {
  return {
    id: row.id,
    supplierId: row.supplierId,
    variantId: row.variantId,
    supplierSku: row.supplierSku,
    unitCostCents: row.unitCostCents,
    minOrderQty: row.minOrderQty,
    leadTimeDays: row.leadTimeDays,
    isPreferred: row.isPreferred,
    variantSku: row.variant?.sku ?? null,
    productTitle: row.variant?.product?.title ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
