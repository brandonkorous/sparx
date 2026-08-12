// Quantity price breaks (docs/146 Phase 8.4) — "£4.10 each, or £3.60 if you
// take fifty."
//
// Every distributor prices this way and a platform that stores one cost per
// supplier-variant plans against the wrong number all year: the reorder
// suggestion tops up to 38, the buyer silently rounds to 50 because they know
// about the break, and the cost basis the platform recorded was never right in
// the first place.
//
// The resolution arithmetic is PURE and lives in
// `@sparx/commerce-schemas/procurement` (`resolvePurchasePrice`), because the
// price a buyer is SHOWN and the price the order RECORDS must be the same
// number. A ladder resolved two ways is a lie the software tells with a straight
// face.

import { SetPriceBreaksInput, resolvePurchasePrice } from '@sparx/commerce-schemas';
import type { ResolvedPurchasePrice } from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

export interface PriceBreakRow {
  id: string;
  supplierVariantId: string;
  minQuantity: number;
  unitCostCents: number;
}

/** The whole ladder for one purchasing link, plus the base price it sits above,
 *  so a surface never has to fetch two things to draw one table. */
export interface PriceLadder {
  supplierVariantId: string;
  supplierId: string;
  variantId: string;
  /** The price below the first break. Null when the link has no cost at all —
   *  which is a real state and must not render as free. */
  baseUnitCostCents: number | null;
  breaks: PriceBreakRow[];
}

export async function getPriceLadder(
  ctx: ServiceContext,
  supplierVariantId: string
): Promise<PriceLadder> {
  return withTenant(ctx, async (tx) => {
    const link = await loadLink(tx, supplierVariantId);
    const breaks = await tx.supplierPriceBreak.findMany({
      where: { supplierVariantId },
      orderBy: { minQuantity: 'asc' },
    });
    return {
      supplierVariantId: link.id,
      supplierId: link.supplierId,
      variantId: link.variantId,
      baseUnitCostCents: link.unitCostCents,
      breaks: breaks.map(serialize),
    };
  });
}

/**
 * Replace the whole ladder in one write.
 *
 * Wholesale replacement rather than per-row editing because a price list ARRIVES
 * as a list: patching three rows of five and leaving two behind is how a ladder
 * ends up describing last year's terms, and nobody notices because each
 * individual row looks plausible.
 */
export async function setPriceBreaks(
  ctx: ServiceContext,
  supplierVariantId: string,
  rawInput: unknown
): Promise<PriceLadder> {
  const input = SetPriceBreaksInput.parse(rawInput);

  // A duplicate rung is not a merge conflict to resolve silently — the author
  // has told the system two different prices for the same quantity and only they
  // know which is right.
  const seen = new Set<number>();
  for (const step of input.breaks) {
    if (seen.has(step.minQuantity)) {
      throw new InventoryValidationError('Two price breaks cannot start at the same quantity', [
        { field: 'breaks', message: `${step.minQuantity} appears twice` },
      ]);
    }
    seen.add(step.minQuantity);
  }

  await withTenant(ctx, async (tx) => {
    await loadLink(tx, supplierVariantId);
    await tx.supplierPriceBreak.deleteMany({ where: { supplierVariantId } });
    if (input.breaks.length > 0) {
      await tx.supplierPriceBreak.createMany({
        data: input.breaks.map((step) => ({
          tenantId: ctx.tenantId,
          supplierVariantId,
          minQuantity: step.minQuantity,
          unitCostCents: step.unitCostCents,
        })),
      });
    }
  });

  return getPriceLadder(ctx, supplierVariantId);
}

/**
 * What one unit costs from this supplier at this quantity, and what the next
 * rung would save.
 *
 * Used by the PO line default and by the reorder drafter. Returns null when
 * there is no purchasing link at all, so the caller can fall back to the
 * catalogue cost rather than being handed a zero that looks like a price.
 */
export async function resolveSupplierPriceOnTx(
  tx: TxClient,
  params: { supplierId: string; variantId: string; quantity: number }
): Promise<(ResolvedPurchasePrice & { supplierVariantId: string }) | null> {
  const link = await tx.supplierVariant.findUnique({
    where: {
      supplierId_variantId: { supplierId: params.supplierId, variantId: params.variantId },
    },
    select: { id: true, unitCostCents: true },
  });
  if (link?.unitCostCents == null) return null;

  const breaks = await tx.supplierPriceBreak.findMany({
    where: { supplierVariantId: link.id },
    orderBy: { minQuantity: 'asc' },
    select: { minQuantity: true, unitCostCents: true },
  });

  return {
    supplierVariantId: link.id,
    ...resolvePurchasePrice(params.quantity, link.unitCostCents, breaks),
  };
}

async function loadLink(
  tx: TxClient,
  supplierVariantId: string
): Promise<{ id: string; supplierId: string; variantId: string; unitCostCents: number | null }> {
  const link = await tx.supplierVariant.findFirst({
    where: { id: supplierVariantId },
    select: { id: true, supplierId: true, variantId: true, unitCostCents: true },
  });
  if (!link) throw new InventoryNotFoundError('SupplierVariant', supplierVariantId);
  return link;
}

function serialize(row: {
  id: string;
  supplierVariantId: string;
  minQuantity: number;
  unitCostCents: number;
}): PriceBreakRow {
  return {
    id: row.id,
    supplierVariantId: row.supplierVariantId,
    minQuantity: row.minQuantity,
    unitCostCents: row.unitCostCents,
  };
}
