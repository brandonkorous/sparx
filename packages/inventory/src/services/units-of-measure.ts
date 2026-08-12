// Units of measure — buy a case, stock each, sell a pair (docs/146 Phase 6.1–6.3).
//
// ── The one rule ─────────────────────────────────────────────────────────────
//
// Every quantity the ledger stores is in BASE units. A unit of measure is a way
// of ENTERING and DISPLAYING a quantity, never a second way of storing one. So
// this module does exactly two jobs: it keeps the list of units a business
// measures in and what each means for a given item, and it converts at the edge
// of every document write. Nothing downstream of `resolveLineUom` ever sees a
// case again.
//
// ── Why the factor is per variant ────────────────────────────────────────────
//
// A case of spark plugs is twelve and a case of oil filters is six, and both are
// "CS". A global factor would be wrong for one of them the moment a second
// product existed. The unit row carries the NAME; the conversion row carries the
// arithmetic.
//
// ── Why a document line keeps text and not a foreign key ─────────────────────
//
// `uomCode` + `unitsPerUom` are snapshot onto the line. A foreign key would mean
// SET NULL, and that erases what "4" meant from a historical purchase order the
// day somebody tidies their unit list. The factor is snapshot for the same
// reason: a case becoming 24 next year must not silently double what last year's
// orders were for.

import {
  CreateUnitOfMeasureInput,
  SetVariantUomsInput,
  UpdateUnitOfMeasureInput,
  STARTER_UNITS,
  toBaseUnits,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface UnitOfMeasureRow {
  id: string;
  code: string;
  name: string;
  pluralName: string;
  dimension: string;
  isSystem: boolean;
  isActive: boolean;
  /** How many items currently use it — the number that decides whether
   *  deleting is safe, and the one a list has to show before offering to. */
  usageCount: number;
  createdAt: string;
}

export interface VariantUomRow {
  id: string;
  uomId: string;
  code: string;
  name: string;
  pluralName: string;
  unitsPerUom: number;
  isPurchaseDefault: boolean;
  isSalesDefault: boolean;
}

export interface VariantUomSetup {
  variantId: string;
  /** The unit the ledger counts this in. Null = each. */
  stockingUomId: string | null;
  stockingUomCode: string | null;
  stockingUomName: string | null;
  stockingUomPluralName: string | null;
  conversions: VariantUomRow[];
}

// ─── The list of units ─────────────────────────────────────────────────────────

/**
 * Every unit this business measures in.
 *
 * Bootstraps the starter set on first read rather than at tenant creation. A
 * business that never opens this screen never gets fourteen rows it did not ask
 * for; one that does gets a usable list instead of an empty state that makes
 * them invent "EA" themselves. (Same shape as `bootstrapDefaultWarehouse`.)
 */
export async function listUnitsOfMeasure(
  ctx: ServiceContext,
  filter: { includeInactive?: boolean } = {}
): Promise<UnitOfMeasureRow[]> {
  return withTenant(ctx, async (tx) => {
    await bootstrapUnitsOnTx(tx, ctx.tenantId);
    const rows = await tx.unitOfMeasure.findMany({
      where: { ...(filter.includeInactive ? {} : { isActive: true }) },
      orderBy: [{ dimension: 'asc' }, { code: 'asc' }],
      include: { _count: { select: { conversions: true, stockingFor: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      code: r.code,
      name: r.name,
      pluralName: r.pluralName,
      dimension: r.dimension,
      isSystem: r.isSystem,
      isActive: r.isActive,
      usageCount: r._count.conversions + r._count.stockingFor,
      createdAt: r.createdAt.toISOString(),
    }));
  });
}

/** Seed the starter set for a tenant that has none. Idempotent: a tenant with
 *  even one unit is left alone, so deleting them all and re-opening the screen
 *  does not quietly resurrect the list they cleared on purpose. */
export async function bootstrapUnitsOfMeasure(ctx: ServiceContext): Promise<number> {
  return withTenant(ctx, (tx) => bootstrapUnitsOnTx(tx, ctx.tenantId));
}

async function bootstrapUnitsOnTx(tx: TxClient, tenantId: string): Promise<number> {
  const existing = await tx.unitOfMeasure.count({ where: { tenantId } });
  if (existing > 0) return 0;
  const created = await tx.unitOfMeasure.createMany({
    data: STARTER_UNITS.map((u) => ({
      tenantId,
      code: u.code,
      name: u.name,
      pluralName: u.pluralName,
      dimension: u.dimension,
      isSystem: true,
    })),
    skipDuplicates: true,
  });
  return created.count;
}

export async function createUnitOfMeasure(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<UnitOfMeasureRow> {
  const input = CreateUnitOfMeasureInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const clash = await tx.unitOfMeasure.findFirst({ where: { code: input.code } });
    if (clash) {
      throw new InventoryConflictError(
        `You already have a unit called ${input.code} — ${clash.name}. Edit that one rather than adding a second.`,
        'code'
      );
    }
    const row = await tx.unitOfMeasure.create({
      data: {
        tenantId: ctx.tenantId,
        code: input.code,
        name: input.name,
        // "boxs" is wrong and "inchs" is worse, so the plural is a real field
        // with a sensible default rather than a suffix rule.
        pluralName: input.pluralName ?? `${input.name}s`,
        dimension: input.dimension ?? 'count',
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.unit_of_measure.created',
      entityType: 'UnitOfMeasure',
      entityId: row.id,
      diff: { after: { code: row.code, name: row.name } },
    });
    return serializeUnit(row, 0);
  });
}

export async function updateUnitOfMeasure(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<UnitOfMeasureRow> {
  const input = UpdateUnitOfMeasureInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.unitOfMeasure.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('UnitOfMeasure', id);

    if (input.code && input.code !== existing.code) {
      const clash = await tx.unitOfMeasure.findFirst({ where: { code: input.code } });
      if (clash) {
        throw new InventoryConflictError(`You already have a unit called ${input.code}.`, 'code');
      }
    }

    const row = await tx.unitOfMeasure.update({
      where: { id },
      data: {
        ...(input.code ? { code: input.code } : {}),
        ...(input.name ? { name: input.name } : {}),
        ...(input.pluralName ? { pluralName: input.pluralName } : {}),
        ...(input.dimension ? { dimension: input.dimension } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: { _count: { select: { conversions: true, stockingFor: true } } },
    });
    return serializeUnit(row, row._count.conversions + row._count.stockingFor);
  });
}

/**
 * Remove a unit.
 *
 * Refused while anything still uses it, and the error NAMES the count — a
 * disabled button with no explanation is how someone concludes the software is
 * broken. Documents already written are unaffected either way: they hold the
 * code as text, which is the whole reason they hold it as text.
 */
export async function deleteUnitOfMeasure(
  ctx: ServiceContext,
  id: string
): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.unitOfMeasure.findFirst({
      where: { id },
      include: { _count: { select: { conversions: true, stockingFor: true } } },
    });
    if (!existing) throw new InventoryNotFoundError('UnitOfMeasure', id);

    const inUse = existing._count.conversions + existing._count.stockingFor;
    if (inUse > 0) {
      throw new InventoryConflictError(
        `${existing.code} is still set up on ${String(inUse)} item${inUse === 1 ? '' : 's'}. Remove it from those first, or switch it off instead of deleting it.`,
        'id'
      );
    }
    await tx.unitOfMeasure.delete({ where: { id } });
    return { id };
  });
}

// ─── What a unit means for one item ────────────────────────────────────────────

export async function getVariantUoms(
  ctx: ServiceContext,
  variantId: string
): Promise<VariantUomSetup> {
  return withTenant(ctx, (tx) => loadVariantUoms(tx, variantId));
}

async function loadVariantUoms(tx: TxClient, variantId: string): Promise<VariantUomSetup> {
  const variant = await tx.productVariant.findFirst({
    where: { id: variantId },
    select: { id: true, stockingUomId: true, stockingUom: true },
  });
  if (!variant) throw new InventoryNotFoundError('ProductVariant', variantId);

  const conversions = await tx.variantUomConversion.findMany({
    where: { variantId },
    orderBy: [{ unitsPerUom: 'asc' }],
    include: { uom: true },
  });

  return {
    variantId,
    stockingUomId: variant.stockingUomId,
    stockingUomCode: variant.stockingUom?.code ?? null,
    stockingUomName: variant.stockingUom?.name ?? null,
    stockingUomPluralName: variant.stockingUom?.pluralName ?? null,
    conversions: conversions.map((c) => ({
      id: c.id,
      uomId: c.uomId,
      code: c.uom.code,
      name: c.uom.name,
      pluralName: c.uom.pluralName,
      unitsPerUom: c.unitsPerUom,
      isPurchaseDefault: c.isPurchaseDefault,
      isSalesDefault: c.isSalesDefault,
    })),
  };
}

/**
 * Replace an item's whole unit setup.
 *
 * Replace rather than patch because the defaults are a property of the SET:
 * "usually bought by the case" is one fact across every conversion, and setting
 * it row by row means a moment where two rows claim it and the database refuses
 * — or worse, where none does and a purchase order silently falls back to base
 * units.
 */
export async function setVariantUoms(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<VariantUomSetup> {
  const input = SetVariantUomsInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId },
      select: { id: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', input.variantId);

    assertOneDefaultOfEach(input.conversions);

    const uomIds = input.conversions.map((c) => c.uomId);
    if (new Set(uomIds).size !== uomIds.length) {
      throw new InventoryValidationError(
        'The same unit appears twice. One item can have only one meaning for a given unit.',
        [{ field: 'conversions', message: 'duplicate unit' }]
      );
    }
    const known = await tx.unitOfMeasure.findMany({
      where: { id: { in: uomIds } },
      select: { id: true },
    });
    if (known.length !== uomIds.length) {
      throw new InventoryValidationError('One of those units does not exist.', [
        { field: 'conversions', message: 'unknown unit' },
      ]);
    }

    if (input.stockingUomId !== undefined) {
      await tx.productVariant.update({
        where: { id: variant.id },
        data: { stockingUomId: input.stockingUomId },
      });
    }

    // Delete-then-write inside one transaction. The partial unique indexes on
    // "one purchase default" and "one sales default" make an incremental update
    // trip over itself mid-flight; clearing first is the only ordering that
    // cannot momentarily hold two.
    await tx.variantUomConversion.deleteMany({ where: { variantId: variant.id } });
    for (const c of input.conversions) {
      await tx.variantUomConversion.create({
        data: {
          tenantId: ctx.tenantId,
          variantId: variant.id,
          uomId: c.uomId,
          unitsPerUom: c.unitsPerUom,
          isPurchaseDefault: c.isPurchaseDefault ?? false,
          isSalesDefault: c.isSalesDefault ?? false,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.variant_uoms.set',
      entityType: 'ProductVariant',
      entityId: variant.id,
      diff: { after: { conversions: input.conversions.length } },
    });

    return loadVariantUoms(tx, variant.id);
  });
}

function assertOneDefaultOfEach(
  conversions: { isPurchaseDefault?: boolean; isSalesDefault?: boolean }[]
): void {
  const purchase = conversions.filter((c) => c.isPurchaseDefault).length;
  const sales = conversions.filter((c) => c.isSalesDefault).length;
  if (purchase > 1) {
    throw new InventoryValidationError('Only one unit can be the one you usually buy in.', [
      { field: 'conversions', message: 'more than one purchase default' },
    ]);
  }
  if (sales > 1) {
    throw new InventoryValidationError('Only one unit can be the one you usually sell in.', [
      { field: 'conversions', message: 'more than one sales default' },
    ]);
  }
}

// ─── The conversion seam every document write goes through ─────────────────────

export interface ResolvedLineUom {
  /** The code to snapshot on the line. Null when the line is in base units. */
  uomCode: string | null;
  /** Base units in one of them. 1 when the line is in base units. */
  unitsPerUom: number;
  /** What the base unit is called, for display. */
  baseUomName: string | null;
  baseUomPluralName: string | null;
}

export const BASE_LINE_UOM: ResolvedLineUom = {
  uomCode: null,
  unitsPerUom: 1,
  baseUomName: null,
  baseUomPluralName: null,
};

/**
 * Work out what a document line's unit means, or refuse.
 *
 * Refusing matters more than converting. A code the item has no conversion for
 * is not a display problem — it is a quantity nobody can interpret, and
 * defaulting it to 1 would book "4 cases" as four units and be discovered at a
 * stock take. So an unknown code throws, and the message says which item and
 * what to do about it.
 *
 * `purpose` picks the default when the caller names no code at all: a purchase
 * order reaches for the unit you usually buy in, a sales document for the one
 * you usually sell in. Neither set → base units, which is most items.
 */
export async function resolveLineUom(
  tx: TxClient,
  params: {
    variantId: string;
    /** What the caller asked for. Absent means "use the default for `purpose`". */
    uomCode?: string | null;
    purpose?: 'purchase' | 'sales' | 'none';
  }
): Promise<ResolvedLineUom> {
  const variant = await tx.productVariant.findFirst({
    where: { id: params.variantId },
    select: { sku: true, stockingUom: { select: { name: true, pluralName: true } } },
  });
  const baseUomName = variant?.stockingUom?.name ?? null;
  const baseUomPluralName = variant?.stockingUom?.pluralName ?? null;
  const base: ResolvedLineUom = { uomCode: null, unitsPerUom: 1, baseUomName, baseUomPluralName };

  const requested = params.uomCode?.trim().toUpperCase();

  if (!requested) {
    const purpose = params.purpose ?? 'none';
    if (purpose === 'none') return base;
    const preferred = await tx.variantUomConversion.findFirst({
      where: {
        variantId: params.variantId,
        ...(purpose === 'purchase' ? { isPurchaseDefault: true } : { isSalesDefault: true }),
      },
      include: { uom: { select: { code: true } } },
    });
    if (!preferred) return base;
    return {
      uomCode: preferred.uom.code,
      unitsPerUom: preferred.unitsPerUom,
      baseUomName,
      baseUomPluralName,
    };
  }

  const match = await tx.variantUomConversion.findFirst({
    where: { variantId: params.variantId, uom: { code: requested } },
    include: { uom: { select: { code: true } } },
  });
  if (match) {
    return {
      uomCode: match.uom.code,
      unitsPerUom: match.unitsPerUom,
      baseUomName,
      baseUomPluralName,
    };
  }

  // The item's OWN stocking unit needs no conversion row — it is the base, and
  // asking for it is asking for base units.
  const stocking = await tx.productVariant.findFirst({
    where: { id: params.variantId },
    select: { stockingUom: { select: { code: true } } },
  });
  if (stocking?.stockingUom?.code === requested) return base;

  throw new InventoryValidationError(
    `${variant?.sku ?? 'That item'} has no "${requested}" set up, so we cannot tell how many that is. Add it on the item's units first, or enter the quantity in single units.`,
    [{ field: 'uomCode', message: `no conversion for ${requested}` }]
  );
}

/** Convert a quantity typed in a unit into base units. The one multiplication,
 *  imported from the pure schema module so a receipt and a count cannot disagree. */
export { toBaseUnits };

/**
 * Convert a per-unit price into a per-BASE-unit price.
 *
 * Rounds to the nearest penny, and that is a real (small) loss: a case of seven
 * at £1.00 is 14.29p a unit, and seven of those is £1.0003. The alternative is
 * fractional pennies in the cost basis, which every report downstream would then
 * have to carry. Rounding here, once, at the edge, is the cheaper wrong.
 */
export function toBaseUnitCost(costPerUom: number, unitsPerUom: number): number {
  const factor = Number.isFinite(unitsPerUom) && unitsPerUom >= 1 ? Math.floor(unitsPerUom) : 1;
  return Math.round(costPerUom / factor);
}

function serializeUnit(
  r: {
    id: string;
    code: string;
    name: string;
    pluralName: string;
    dimension: string;
    isSystem: boolean;
    isActive: boolean;
    createdAt: Date;
  },
  usageCount: number
): UnitOfMeasureRow {
  return {
    id: r.id,
    code: r.code,
    name: r.name,
    pluralName: r.pluralName,
    dimension: r.dimension,
    isSystem: r.isSystem,
    isActive: r.isActive,
    usageCount,
    createdAt: r.createdAt.toISOString(),
  };
}
