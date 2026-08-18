// Barcodes — the scan registry service (docs/146 Phase 3.1 + 3.2).
//
// CRUD over the codes on a variant, the internal-code minter, and `resolveScan`
// — the lookup every scan-first workflow in this phase goes through.
//
// The symbology maths (check digits, UPC-E expansion, scan equivalence) is NOT
// here: it lives in `@wizeworks/commerce-schemas/barcodes` because the label printer
// in the browser needs exactly the same answers, and two implementations of a
// check digit is a bug that surfaces on paper after four hundred are printed.
//
// ── One value, one variant ───────────────────────────────────────────────────
//
// `UNIQUE (tenant_id, value)` is the constraint the whole phase rests on, and
// `createBarcode` does not merely surface the violation — it looks the winner up
// and names it. "That barcode is already on WIDGET-BLUE-L" is a sentence someone
// can act on; "duplicate key value violates unique constraint" is not.

import { Prisma, withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';
import type {
  CreateVariantBarcodeInput,
  GenerateVariantBarcodesInput,
  ListVariantBarcodesQuery,
  UpdateVariantBarcodeInput,
} from '@wizeworks/commerce-schemas';
import {
  detectSymbology,
  internalBarcode,
  isGtin,
  normalizeBarcode,
  scanEquivalents,
  symbologyLabel,
  validateBarcode,
  type BarcodeSymbology,
} from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

// ─── Row shapes ────────────────────────────────────────────────────────────────

export interface BarcodeRow {
  id: string;
  variantId: string;
  sku: string | null;
  productId: string | null;
  productTitle: string | null;
  variantTitle: string | null;
  value: string;
  symbology: BarcodeSymbology;
  symbologyLabel: string;
  packSize: number;
  isPrimary: boolean;
  supplierId: string | null;
  supplierName: string | null;
  label: string | null;
  source: string;
  lastScannedAt: string | null;
  scanCount: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

/** What a scan of a product code resolved to, and how much of it. */
export interface BarcodeMatch {
  barcodeId: string;
  /** The value AS STORED, which may differ from what the gun sent — a UPC-E
   *  resolving through its expansion is the common case. */
  value: string;
  /** Exactly what came off the scanner, so the UI can say "read as …". */
  scanned: string;
  symbology: BarcodeSymbology;
  packSize: number;
  isPrimary: boolean;
  supplierId: string | null;
  label: string | null;
  variantId: string;
  sku: string;
  productId: string;
  productTitle: string;
  variantTitle: string | null;
}

/**
 * A variant carrying a `barcode` column value that has no registry row.
 *
 * Almost always a duplicate the old nullable column allowed and the new unique
 * index refuses. Surfaced rather than silently dropped at backfill time: the
 * tenant has two items claiming one code and only they can say which is right.
 */
export interface BarcodeConflictRow {
  variantId: string;
  /** So the surface can open the item rather than only naming it. */
  productId: string;
  sku: string;
  productTitle: string;
  value: string;
  /** The variant that currently holds the registry row for this value. */
  heldByVariantId: string | null;
  heldBySku: string | null;
  heldByProductTitle: string | null;
}

// ─── Reads ─────────────────────────────────────────────────────────────────────

interface BarcodeQueryRow {
  id: string;
  variantId: string;
  sku: string | null;
  productId: string | null;
  productTitle: string | null;
  variantTitle: string | null;
  value: string;
  symbology: string;
  packSize: number;
  isPrimary: boolean;
  supplierId: string | null;
  supplierName: string | null;
  label: string | null;
  source: string;
  lastScannedAt: Date | null;
  scanCount: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

function toRow(r: BarcodeQueryRow): BarcodeRow {
  const symbology = r.symbology as BarcodeSymbology;
  return {
    id: r.id,
    variantId: r.variantId,
    sku: r.sku,
    productId: r.productId,
    productTitle: r.productTitle,
    variantTitle: r.variantTitle,
    value: r.value,
    symbology,
    symbologyLabel: symbologyLabel(symbology),
    packSize: r.packSize,
    isPrimary: r.isPrimary,
    supplierId: r.supplierId,
    supplierName: r.supplierName,
    label: r.label,
    source: r.source,
    lastScannedAt: r.lastScannedAt?.toISOString() ?? null,
    scanCount: r.scanCount,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

const BARCODE_SELECT = Prisma.sql`
  bc.id                AS "id",
  bc.variant_id        AS "variantId",
  v.sku                AS "sku",
  v.product_id         AS "productId",
  p.title              AS "productTitle",
  v.title              AS "variantTitle",
  bc.value             AS "value",
  bc.symbology         AS "symbology",
  bc.pack_size         AS "packSize",
  bc.is_primary        AS "isPrimary",
  bc.supplier_id       AS "supplierId",
  s.name               AS "supplierName",
  bc.label             AS "label",
  bc.source            AS "source",
  bc.last_scanned_at   AS "lastScannedAt",
  bc.scan_count        AS "scanCount",
  bc.is_active         AS "isActive",
  bc.created_at        AS "createdAt",
  bc.updated_at        AS "updatedAt"
`;

const BARCODE_FROM = Prisma.sql`
  FROM commerce_variant_barcodes bc
  JOIN commerce_product_variants v ON v.id = bc.variant_id
  JOIN commerce_products p         ON p.id = v.product_id
  LEFT JOIN inventory_suppliers s  ON s.id = bc.supplier_id
`;

export async function listBarcodes(
  ctx: ServiceContext,
  query: ListVariantBarcodesQuery
): Promise<{ items: BarcodeRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const clauses: Prisma.Sql[] = [Prisma.sql`bc.tenant_id = ${ctx.tenantId}::uuid`];
    if (query.variantId) clauses.push(Prisma.sql`bc.variant_id = ${query.variantId}::uuid`);
    if (query.supplierId) clauses.push(Prisma.sql`bc.supplier_id = ${query.supplierId}::uuid`);
    if (query.symbology) clauses.push(Prisma.sql`bc.symbology = ${query.symbology}`);
    if (query.source) clauses.push(Prisma.sql`bc.source = ${query.source}`);
    if (!query.includeInactive) clauses.push(Prisma.sql`bc.is_active = true`);
    if (query.search) {
      // The barcode itself, the SKU, or the product name — because "find the
      // barcode for the thing called X" is as common as looking up the code.
      const like = `%${query.search}%`;
      clauses.push(
        Prisma.sql`(bc.value ILIKE ${like} OR v.sku ILIKE ${like} OR p.title ILIKE ${like})`
      );
    }
    const where = Prisma.join(clauses, ' AND ');

    const rows = await tx.$queryRaw<BarcodeQueryRow[]>`
      SELECT ${BARCODE_SELECT}
      ${BARCODE_FROM}
      WHERE ${where}
      ORDER BY p.title ASC, v.sku ASC, bc.is_primary DESC, bc.value ASC
      LIMIT ${query.limit} OFFSET ${query.offset}
    `;
    const totals = await tx.$queryRaw<{ total: number }[]>`
      SELECT COUNT(*)::int AS total ${BARCODE_FROM} WHERE ${where}
    `;

    return { items: rows.map(toRow), total: totals[0]?.total ?? 0 };
  });
}

/** Every code on one item, primary first. The variant detail pane's read. */
export async function barcodesForVariant(
  ctx: ServiceContext,
  variantId: string
): Promise<BarcodeRow[]> {
  const { items } = await listBarcodes(ctx, {
    variantId,
    includeInactive: true,
    limit: 200,
    offset: 0,
  });
  return items;
}

/**
 * Resolve a raw scan to an item.
 *
 * Tries every encoding the same physical code can arrive as (`scanEquivalents`),
 * because which one the gun sends is a property of how the gun is configured,
 * not of the item. Without that, a tenant who registered a UPC-A and owns a
 * scanner in EAN-13 mode gets "unknown barcode" for their whole catalogue and
 * has no way at all to work out why.
 *
 * Inactive codes still resolve. A retired label is still stuck to a box, and the
 * useful answer is "that's the old code for WIDGET-01", not "unknown".
 */
export async function resolveBarcode(
  ctx: ServiceContext,
  scanned: string
): Promise<BarcodeMatch | null> {
  const candidates = scanEquivalents(scanned);
  const literal = candidates[0];
  if (!literal) return null;

  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<
      (BarcodeQueryRow & { sku: string; productId: string; productTitle: string })[]
    >`
      SELECT ${BARCODE_SELECT}
      ${BARCODE_FROM}
      WHERE bc.tenant_id = ${ctx.tenantId}::uuid
        AND bc.value = ANY(${candidates}::text[])
        AND v.deleted_at IS NULL
      -- The value as literally scanned wins over an equivalent form, and an
      -- active code wins over a retired one. Both matter: a case code and the
      -- unit code it wraps can both be registered.
      ORDER BY (bc.value = ${literal}) DESC, bc.is_active DESC, bc.is_primary DESC
      LIMIT 1
    `;
    const hit = rows[0];
    if (!hit) return null;

    // Scan telemetry. In the same transaction because it is one indexed UPDATE
    // on a row already located, and it answers the only question that decides
    // whether an old code can be retired: is anyone still scanning it?
    await tx.$executeRaw`
      UPDATE commerce_variant_barcodes
         SET scan_count = scan_count + 1, last_scanned_at = now()
       WHERE id = ${hit.id}::uuid
    `;

    return {
      barcodeId: hit.id,
      value: hit.value,
      scanned: normalizeBarcode(scanned),
      symbology: hit.symbology as BarcodeSymbology,
      packSize: hit.packSize,
      isPrimary: hit.isPrimary,
      supplierId: hit.supplierId,
      label: hit.label,
      variantId: hit.variantId,
      sku: hit.sku,
      productId: hit.productId,
      productTitle: hit.productTitle,
      variantTitle: hit.variantTitle,
    };
  });
}

/**
 * Variants whose `barcode` column holds a value the registry does not.
 *
 * The backfill kept the oldest claimant of each duplicated code and left the
 * losers' columns untouched rather than deleting data it had no business
 * deleting. This is how the tenant finds them — and the conflicting item is
 * named, because "these two things claim the same code" is the actual problem
 * and it is unresolvable without knowing both.
 */
export async function listBarcodeConflicts(
  ctx: ServiceContext,
  limit = 200
): Promise<BarcodeConflictRow[]> {
  return withTenant(ctx, async (tx) => {
    return tx.$queryRaw<BarcodeConflictRow[]>`
      SELECT v.id            AS "variantId",
             v.product_id    AS "productId",
             v.sku           AS "sku",
             p.title         AS "productTitle",
             btrim(v.barcode) AS "value",
             w.variant_id    AS "heldByVariantId",
             wv.sku          AS "heldBySku",
             wp.title        AS "heldByProductTitle"
        FROM commerce_product_variants v
        JOIN commerce_products p ON p.id = v.product_id
        LEFT JOIN commerce_variant_barcodes w
               ON w.tenant_id = v.tenant_id AND w.value = btrim(v.barcode)
        LEFT JOIN commerce_product_variants wv ON wv.id = w.variant_id
        LEFT JOIN commerce_products wp         ON wp.id = wv.product_id
       WHERE v.tenant_id = ${ctx.tenantId}::uuid
         AND v.deleted_at IS NULL
         AND v.barcode IS NOT NULL
         AND btrim(v.barcode) <> ''
         AND NOT EXISTS (
           SELECT 1 FROM commerce_variant_barcodes mine
            WHERE mine.tenant_id = v.tenant_id
              AND mine.variant_id = v.id
              AND mine.value = btrim(v.barcode)
         )
       ORDER BY p.title ASC, v.sku ASC
       LIMIT ${limit}
    `;
  });
}

// ─── Writes ────────────────────────────────────────────────────────────────────

/**
 * The GTIN mirror.
 *
 * `ProductVariant.barcode` is read in two dozen places — channel projections,
 * product feeds, the CSV importer — and all of them mean "the GTIN this product
 * is known by outside". So it keeps meaning that: only a primary row in the
 * GTIN family lands there, and an internal Code 128 (which means nothing to
 * Google) never does. When a variant's primary is not a GTIN the column is
 * cleared, because a stale GTIN in a feed is worse than none.
 */
async function syncVariantBarcodeColumn(
  tx: TxClient,
  tenantId: string,
  variantId: string
): Promise<void> {
  const rows = await tx.$queryRaw<{ value: string; symbology: string }[]>`
    SELECT value, symbology
      FROM commerce_variant_barcodes
     WHERE tenant_id = ${tenantId}::uuid
       AND variant_id = ${variantId}::uuid
       AND is_primary = true
       AND is_active = true
     LIMIT 1
  `;
  const primary = rows[0];
  const mirror =
    primary && isGtin(primary.symbology as BarcodeSymbology) && primary.value.length <= 14
      ? primary.value
      : null;

  await tx.$executeRaw`
    UPDATE commerce_product_variants
       SET barcode = ${mirror}
     WHERE id = ${variantId}::uuid AND tenant_id = ${tenantId}::uuid
  `;
}

/** Turn a unique-constraint hit into a sentence naming the item that already has it. */
async function conflictFor(
  tx: TxClient,
  tenantId: string,
  value: string
): Promise<InventoryConflictError> {
  const rows = await tx.$queryRaw<{ sku: string; title: string }[]>`
    SELECT v.sku AS "sku", p.title AS "title"
      FROM commerce_variant_barcodes bc
      JOIN commerce_product_variants v ON v.id = bc.variant_id
      JOIN commerce_products p         ON p.id = v.product_id
     WHERE bc.tenant_id = ${tenantId}::uuid AND bc.value = ${value}
     LIMIT 1
  `;
  const holder = rows[0];
  return new InventoryConflictError(
    holder
      ? `Barcode ${value} is already on ${holder.title} (${holder.sku}). A barcode can only belong to one item — remove it there first, or scan a different code.`
      : `Barcode ${value} is already in use.`
  );
}

async function demoteOtherPrimaries(
  tx: TxClient,
  tenantId: string,
  variantId: string,
  keepId: string | null
): Promise<void> {
  await tx.$executeRaw`
    UPDATE commerce_variant_barcodes
       SET is_primary = false, updated_at = now()
     WHERE tenant_id = ${tenantId}::uuid
       AND variant_id = ${variantId}::uuid
       AND is_primary = true
       AND id <> COALESCE(${keepId}::uuid, '00000000-0000-0000-0000-000000000000'::uuid)
  `;
}

export async function createBarcode(
  ctx: ServiceContext,
  input: CreateVariantBarcodeInput
): Promise<BarcodeRow> {
  const check = validateBarcode(input.value, input.symbology);
  if (!check.ok && !input.allowInvalidCheckDigit) {
    throw new InventoryValidationError(check.error ?? 'That barcode is not valid.');
  }
  // A length or character-set failure is not overridable — a 10-digit "UPC-A"
  // cannot be printed as one, so accepting it would store something no label can
  // ever carry. Only the CHECK DIGIT is waivable, because legacy data genuinely
  // contains bad GTINs that are nonetheless stuck to real shelves.
  if (!check.ok && !/check digit/i.test(check.error ?? '')) {
    throw new InventoryValidationError(check.error ?? 'That barcode is not valid.');
  }
  const value = check.value;
  const symbology = check.symbology;

  return withTenant(ctx, async (tx) => {
    const variant = await tx.productVariant.findFirst({
      where: { id: input.variantId, tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true },
    });
    if (!variant) throw new InventoryNotFoundError('ProductVariant', input.variantId);

    if (input.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: input.supplierId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new InventoryNotFoundError('Supplier', input.supplierId);
    }

    const existing = await tx.$queryRaw<{ id: string; variantId: string }[]>`
      SELECT id, variant_id AS "variantId"
        FROM commerce_variant_barcodes
       WHERE tenant_id = ${ctx.tenantId}::uuid AND value = ${value}
       LIMIT 1
    `;
    if (existing[0]) throw await conflictFor(tx, ctx.tenantId, value);

    // The first code on an item is its primary whether or not the caller said
    // so. Anything else leaves a variant with barcodes and no designated one,
    // which the label printer and the GTIN mirror both have to guess about.
    const hasPrimary = await tx.$queryRaw<{ n: number }[]>`
      SELECT COUNT(*)::int AS n
        FROM commerce_variant_barcodes
       WHERE tenant_id = ${ctx.tenantId}::uuid
         AND variant_id = ${input.variantId}::uuid
         AND is_primary = true
    `;
    const isPrimary = input.isPrimary || (hasPrimary[0]?.n ?? 0) === 0;
    if (isPrimary) await demoteOtherPrimaries(tx, ctx.tenantId, input.variantId, null);

    const inserted = await tx.$queryRaw<{ id: string }[]>`
      INSERT INTO commerce_variant_barcodes
        (tenant_id, variant_id, value, symbology, pack_size, is_primary,
         supplier_id, label, source, created_by)
      VALUES (${ctx.tenantId}::uuid, ${input.variantId}::uuid, ${value}, ${symbology},
              ${input.packSize}, ${isPrimary}, ${input.supplierId ?? null}::uuid,
              ${input.label ?? null}, ${input.source}, ${ctx.userId ?? null})
      RETURNING id
    `;
    const id = inserted[0]?.id;
    if (!id) throw await conflictFor(tx, ctx.tenantId, value);

    await syncVariantBarcodeColumn(tx, ctx.tenantId, input.variantId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.barcode.created',
      entityType: 'VariantBarcode',
      entityId: id,
      diff: { after: { value, symbology, packSize: input.packSize, isPrimary } },
    });

    return loadOne(tx, ctx.tenantId, id);
  });
}

export async function updateBarcode(
  ctx: ServiceContext,
  id: string,
  input: UpdateVariantBarcodeInput
): Promise<BarcodeRow> {
  return withTenant(ctx, async (tx) => {
    const before = await loadOne(tx, ctx.tenantId, id);

    if (input.supplierId) {
      const supplier = await tx.supplier.findFirst({
        where: { id: input.supplierId, tenantId: ctx.tenantId, deletedAt: null },
        select: { id: true },
      });
      if (!supplier) throw new InventoryNotFoundError('Supplier', input.supplierId);
    }

    // Retiring the primary would leave the item with none, so the demotion has
    // to happen through `setPrimaryBarcode` on a different row. Refusing here is
    // better than silently promoting whichever code sorts first.
    if (input.isActive === false && before.isPrimary) {
      const others = await tx.$queryRaw<{ n: number }[]>`
        SELECT COUNT(*)::int AS n
          FROM commerce_variant_barcodes
         WHERE tenant_id = ${ctx.tenantId}::uuid
           AND variant_id = ${before.variantId}::uuid
           AND id <> ${id}::uuid
           AND is_active = true
      `;
      if ((others[0]?.n ?? 0) > 0) {
        throw new InventoryValidationError(
          'This is the main barcode for the item. Make another one the main barcode before retiring it.'
        );
      }
    }

    if (input.isPrimary === true)
      await demoteOtherPrimaries(tx, ctx.tenantId, before.variantId, id);
    if (input.isPrimary === false && before.isPrimary) {
      throw new InventoryValidationError(
        'Every item needs one main barcode. Make another one the main barcode instead of clearing this.'
      );
    }

    await tx.$executeRaw`
      UPDATE commerce_variant_barcodes
         SET pack_size   = COALESCE(${input.packSize ?? null}::int, pack_size),
             is_primary  = COALESCE(${input.isPrimary ?? null}::boolean, is_primary),
             supplier_id = CASE WHEN ${input.supplierId === undefined}::boolean
                                THEN supplier_id ELSE ${input.supplierId ?? null}::uuid END,
             label       = CASE WHEN ${input.label === undefined}::boolean
                                THEN label ELSE ${input.label ?? null} END,
             is_active   = COALESCE(${input.isActive ?? null}::boolean, is_active),
             updated_at  = now()
       WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${id}::uuid
    `;

    await syncVariantBarcodeColumn(tx, ctx.tenantId, before.variantId);
    const after = await loadOne(tx, ctx.tenantId, id);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.barcode.updated',
      entityType: 'VariantBarcode',
      entityId: id,
      diff: { before: { ...before }, after: { ...after } },
    });
    return after;
  });
}

/** Promote one code to the item's main barcode, demoting whichever held it. */
export async function setPrimaryBarcode(ctx: ServiceContext, id: string): Promise<BarcodeRow> {
  return updateBarcode(ctx, id, { isPrimary: true });
}

/**
 * Delete a code outright.
 *
 * Deliberately available alongside retirement, because a barcode entered against
 * the wrong item is a mistake rather than history and leaving it in place means
 * the correct item can never be given that code. `isActive = false` is for a
 * code that was genuinely once right; delete is for one that never was.
 */
export async function deleteBarcode(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await loadOne(tx, ctx.tenantId, id);
    await tx.$executeRaw`
      DELETE FROM commerce_variant_barcodes
       WHERE tenant_id = ${ctx.tenantId}::uuid AND id = ${id}::uuid
    `;
    // If the deleted row was primary the variant now has none; promote the
    // oldest survivor so the item is never left without a main barcode.
    if (before.isPrimary) await promoteOldestSurvivor(tx, ctx.tenantId, before.variantId);
    await syncVariantBarcodeColumn(tx, ctx.tenantId, before.variantId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.barcode.deleted',
      entityType: 'VariantBarcode',
      entityId: id,
      diff: { before: { ...before } },
    });
  });
}

/**
 * Settle a code that two items both claim.
 *
 * Only two answers are possible and both are the tenant's to give, so the API
 * offers exactly those rather than a general editor:
 *
 *   `take`  — this item is the right owner. The registry row moves here, and the
 *             loser's legacy column is cleared so it cannot re-appear.
 *   `clear` — this item is NOT the owner; the code was wrong on it all along.
 *             Its column is cleared and the existing registry row stands.
 *
 * Deliberately not "merge" or "keep both": the constraint exists because a scan
 * must land on one item, and an option that leaves two claimants would be an
 * option to leave the problem in place.
 */
export async function resolveBarcodeConflict(
  ctx: ServiceContext,
  variantId: string,
  action: 'take' | 'clear'
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<{ barcode: string | null }[]>`
      SELECT btrim(barcode) AS barcode
        FROM commerce_product_variants
       WHERE id = ${variantId}::uuid AND tenant_id = ${ctx.tenantId}::uuid
    `;
    const value = rows[0]?.barcode;
    if (!value) throw new InventoryNotFoundError('ProductVariant', variantId);

    if (action === 'take') {
      // Delete the incumbent's row and re-issue against this item. Delete rather
      // than re-point, so the losing variant's primary is re-elected properly
      // and its GTIN mirror is recomputed.
      const holders = await tx.$queryRaw<{ id: string; variantId: string }[]>`
        SELECT id, variant_id AS "variantId"
          FROM commerce_variant_barcodes
         WHERE tenant_id = ${ctx.tenantId}::uuid AND value = ${value}
      `;
      for (const holder of holders) {
        await tx.$executeRaw`
          DELETE FROM commerce_variant_barcodes WHERE id = ${holder.id}::uuid
        `;
        await promoteOldestSurvivor(tx, ctx.tenantId, holder.variantId);
        await syncVariantBarcodeColumn(tx, ctx.tenantId, holder.variantId);
        // The loser keeps no claim on a code it no longer owns.
        await tx.$executeRaw`
          UPDATE commerce_product_variants
             SET barcode = NULL
           WHERE id = ${holder.variantId}::uuid AND btrim(barcode) = ${value}
        `;
      }
      const detected = detectSymbology(value);
      await tx.$executeRaw`
        INSERT INTO commerce_variant_barcodes
          (tenant_id, variant_id, value, symbology, is_primary, source, created_by)
        VALUES (${ctx.tenantId}::uuid, ${variantId}::uuid, ${value}, ${detected}, true,
                'manual', ${ctx.userId ?? null})
        ON CONFLICT (tenant_id, value) DO NOTHING
      `;
      await demoteOtherPrimaries(tx, ctx.tenantId, variantId, null);
      await tx.$executeRaw`
        UPDATE commerce_variant_barcodes
           SET is_primary = true
         WHERE tenant_id = ${ctx.tenantId}::uuid
           AND variant_id = ${variantId}::uuid
           AND value = ${value}
      `;
    } else {
      await tx.$executeRaw`
        UPDATE commerce_product_variants
           SET barcode = NULL
         WHERE id = ${variantId}::uuid AND tenant_id = ${ctx.tenantId}::uuid
      `;
    }

    await syncVariantBarcodeColumn(tx, ctx.tenantId, variantId);
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: `inventory.barcode.conflict_${action}`,
      entityType: 'ProductVariant',
      entityId: variantId,
      diff: { after: { value, action } },
    });
  });
}

/** After a primary disappears, the oldest surviving code takes its place. */
async function promoteOldestSurvivor(
  tx: TxClient,
  tenantId: string,
  variantId: string
): Promise<void> {
  await tx.$executeRaw`
    UPDATE commerce_variant_barcodes
       SET is_primary = true, updated_at = now()
     WHERE id = (
       SELECT id FROM commerce_variant_barcodes
        WHERE tenant_id = ${tenantId}::uuid
          AND variant_id = ${variantId}::uuid
          AND is_active = true
        ORDER BY is_primary DESC, created_at ASC, id ASC
        LIMIT 1
     )
  `;
}

// ─── Minting internal codes (3.2) ──────────────────────────────────────────────

export interface GeneratedBarcode {
  variantId: string;
  sku: string;
  value: string;
}

export interface GenerateBarcodesResult {
  generated: GeneratedBarcode[];
  /** Variants left alone because they already had a code and `force` was off. */
  skipped: { variantId: string; sku: string; existing: string }[];
}

/**
 * Reserve `count` consecutive numbers from the tenant's allocator.
 *
 * One statement, so two concurrent label runs cannot be handed the same block.
 * The counter only ever goes up: deleting a registry row does NOT lower it,
 * because the number may already be printed on four hundred shelf labels and
 * re-issuing it would point them all at a different item.
 */
async function reserveSequence(tx: TxClient, tenantId: string, count: number): Promise<bigint> {
  const rows = await tx.$queryRaw<{ next_value: bigint }[]>`
    INSERT INTO inventory_barcode_sequences (tenant_id, next_value, updated_at)
    VALUES (${tenantId}::uuid, ${count + 1}::bigint, now())
    ON CONFLICT (tenant_id) DO UPDATE
      SET next_value = inventory_barcode_sequences.next_value + ${count}::bigint,
          updated_at = now()
    RETURNING next_value
  `;
  const next = rows[0]?.next_value;
  if (next === undefined) throw new Error('Barcode sequence returned no value');
  // The block just reserved is [next_value - count, next_value - 1].
  return BigInt(next) - BigInt(count);
}

/**
 * Mint an internal barcode for every named variant that lacks one.
 *
 * Codes are real number-system-2 UPC-A — the GS1 range reserved for restricted
 * circulation — not an invented format. That matters practically: any scanner
 * reads them with no configuration, any label printer prints them, and the range
 * can never collide with a manufacturer's code. "The items with barcodes and the
 * items without" is how a scan-first warehouse quietly reverts to typing, and
 * this is what closes it.
 */
export async function generateBarcodes(
  ctx: ServiceContext,
  input: GenerateVariantBarcodesInput
): Promise<GenerateBarcodesResult> {
  return withTenant(ctx, async (tx) => {
    const variants = await tx.$queryRaw<{ id: string; sku: string; existing: string | null }[]>`
      SELECT v.id AS "id",
             v.sku AS "sku",
             (SELECT bc.value FROM commerce_variant_barcodes bc
               WHERE bc.tenant_id = v.tenant_id AND bc.variant_id = v.id AND bc.is_active = true
               ORDER BY bc.is_primary DESC, bc.created_at ASC LIMIT 1) AS "existing"
        FROM commerce_product_variants v
       WHERE v.tenant_id = ${ctx.tenantId}::uuid
         AND v.deleted_at IS NULL
         AND v.id = ANY(${input.variantIds}::uuid[])
       ORDER BY v.sku ASC
    `;
    if (variants.length === 0) {
      throw new InventoryValidationError('None of those items could be found.');
    }

    const skipped = variants
      .filter((v) => v.existing && !input.force)
      .map((v) => ({ variantId: v.id, sku: v.sku, existing: v.existing! }));
    const targets = variants.filter((v) => !v.existing || input.force);
    if (targets.length === 0) return { generated: [], skipped };

    const generated: GeneratedBarcode[] = [];
    let remaining = targets;

    // A minted code can, very rarely, collide: a manufacturer code that happens
    // to sit in the restricted range, or one imported from the system this
    // replaced. `ON CONFLICT DO NOTHING` skips it and the next pass mints a
    // fresh number for whoever missed, rather than failing the whole batch over
    // one unlucky value. Three passes is far beyond what a real collision rate
    // needs and bounds the loop.
    for (let attempt = 0; attempt < 3 && remaining.length > 0; attempt += 1) {
      const start = await reserveSequence(tx, ctx.tenantId, remaining.length);
      const missed: typeof remaining = [];

      for (let i = 0; i < remaining.length; i += 1) {
        const target = remaining[i];
        if (!target) continue;
        const value = internalBarcode(start + BigInt(i));
        const isFirst = !target.existing;
        const inserted = await tx.$executeRaw`
          INSERT INTO commerce_variant_barcodes
            (tenant_id, variant_id, value, symbology, pack_size, is_primary, source, created_by)
          VALUES (${ctx.tenantId}::uuid, ${target.id}::uuid, ${value}, 'upc_a', 1,
                  ${isFirst}, 'generated', ${ctx.userId ?? null})
          ON CONFLICT (tenant_id, value) DO NOTHING
        `;
        if (inserted === 0) missed.push(target);
        else generated.push({ variantId: target.id, sku: target.sku, value });
      }
      remaining = missed;
    }

    if (remaining.length > 0) {
      throw new InventoryConflictError(
        `Could not mint a free barcode for ${remaining.length} item(s) after three attempts. This should not happen — check for imported codes in the 2xxxxxxxxxxx range.`
      );
    }

    for (const g of generated) await syncVariantBarcodeColumn(tx, ctx.tenantId, g.variantId);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.barcode.generated',
      entityType: 'ProductVariant',
      entityId: generated[0]?.variantId ?? targets[0]?.id ?? ctx.tenantId,
      diff: { after: { count: generated.length, values: generated.map((g) => g.value) } },
    });

    return { generated, skipped };
  });
}

// ─── Shared ────────────────────────────────────────────────────────────────────

async function loadOne(tx: TxClient, tenantId: string, id: string): Promise<BarcodeRow> {
  const rows = await tx.$queryRaw<BarcodeQueryRow[]>`
    SELECT ${BARCODE_SELECT}
    ${BARCODE_FROM}
    WHERE bc.tenant_id = ${tenantId}::uuid AND bc.id = ${id}::uuid
    LIMIT 1
  `;
  if (!rows[0]) throw new InventoryNotFoundError('VariantBarcode', id);
  return toRow(rows[0]);
}

/**
 * The symbology a value would be stored as, without writing anything.
 *
 * Exists so the workbench can label the field as you type ("that looks like a
 * UPC-A") using exactly the detection the server will apply, rather than a
 * second guess that disagrees at save time.
 */
export function previewSymbology(value: string): BarcodeSymbology {
  return detectSymbology(value);
}
