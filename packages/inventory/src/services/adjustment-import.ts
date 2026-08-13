// Stock import (docs/146 Phase 10.5 + 10.6, extended by Phase 11.2–11.3 and
// 11.8, closing docs/68 §11).
//
// A spreadsheet of counts, turned into stock movements — the thing every
// business asks for on day one, and the thing worth being careful about.
//
// ── Why this is two steps and not one ────────────────────────────────────────
//
// A bad adjustment import is indistinguishable from theft in the ledger
// afterwards: four hundred `manual` movements, all stamped the same second, all
// attributed to whoever pressed the button, and nothing recording which file
// they came from or what it said. The person who uploaded the wrong column
// cannot explain it and the person auditing it cannot unpick it.
//
// So: PLAN, then APPLY.
//
//   plan     parses, resolves every SKU and location, works out what each row
//            WOULD do, and stores the whole thing. Writes no stock.
//   resolve  a person decides what to do about the rows that did not land —
//            skip them, point them at an item that already exists, or create
//            the item (Phase 11.3).
//   apply    posts what was planned, stamping every movement with the batch id.
//
// The plan is stored rather than held in the browser because the errors are the
// point. "Row 148: no item with code BRK-9920" is what lets a file be fixed, and
// it has to survive somebody closing the tab and coming back after lunch.
//
// ── Reading somebody else's headings (11.2) ──────────────────────────────────
//
// A row's fields are read through a MAPPING when one is supplied — from a saved
// profile or from the mapping screen — and through the built-in alias list when
// one is not. The alias list is the floor, not the mechanism: it makes the
// common file work with no setup, and the mapping makes every other file work at
// all.
//
// ── Round-trip (10.6) ────────────────────────────────────────────────────────
//
// `adjustmentTemplate` exports current stock in the SAME columns the parser
// reads. So the workflow a business actually wants — export what the system
// thinks, count the shelves, type the differences, upload — works with no
// editing of headers, and the reader and the writer cannot drift apart because
// the column list below is the only one either of them has.

import {
  ResolveImportRowsInput,
  customFieldColumn,
  parseSpreadsheetNumber,
  summarizeImportPlan,
  type ColumnMapping,
  type CustomFieldDefinition,
  type ImportPlan,
  type ImportRowPlan,
  type ImportRowResolution,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { csvField, csvSafeText, parseCsv, type CsvTable } from '../csv';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { applyCustomFields, loadCustomFieldDefinitions } from './custom-fields';
import { markProfileUsed } from './import-profiles';
import { applyMovement, emitStockEvents, resolveActorType } from './ledger';
import { noteSetupStep } from './setup-progress';

/** The import's built-in column vocabulary. First spelling is what the export
 *  writes; the rest are what a tenant's old system might have called it. One
 *  list, read by the parser and written by the template — 10.6 holds because
 *  there is nowhere for a second list to disagree from.
 *
 *  A saved mapping overrides this per field. It does not replace it: a file that
 *  maps two columns by hand still gets the aliases for the other five. */
const COLUMNS = {
  sku: ['sku', 'code', 'item_code', 'product_code'],
  variantId: ['variant_id', 'variant'],
  name: ['name', 'title', 'item', 'description'],
  warehouseCode: ['warehouse', 'warehouse_code', 'location', 'location_code'],
  warehouseId: ['warehouse_id', 'location_id'],
  onHand: ['on_hand', 'counted', 'count', 'quantity', 'qty'],
  delta: ['delta', 'change', 'adjustment'],
  unitCost: ['unit_cost', 'cost', 'purchase_cost'],
  note: ['note', 'notes', 'comment'],
} as const;

/** `opening` is here as well as in the routine list because the setup wizard
 *  loads a tenant's first file through this path, and its movements must not
 *  read as a stock correction (docs/146 Phase 11.4). */
const REASONS = new Set(['manual', 'recount', 'loss', 'damage', 'receive', 'return', 'opening']);

export interface PlanImportInput {
  /** The uploaded file, as text. */
  csv: string;
  filename?: string | null;
  /** Where rows that name no location go. Required unless every row names one —
   *  guessing "the first warehouse" is how a count lands in the wrong building. */
  warehouseId?: string | null;
  /** Stamped on every movement. `recount` puts the differences in the shrinkage
   *  report, which is where a stock-take belongs; `manual` does not. */
  reason?: string;
  /** Field key → the heading in THIS file (docs/146 Phase 11.2). Absent fields
   *  fall back to the alias list above. */
  mapping?: ColumnMapping | null;
  /** A saved mapping to use and to count a use against. Its mapping and its
   *  options apply unless the call overrides them. */
  profileId?: string | null;
  /** How this file writes its numbers. Only the decimal character matters — a
   *  grouping separator is stripped either way. */
  decimal?: '.' | ',';
  /** Create a catalogue item for a code the file has and sparx does not, rather
   *  than reporting it as an error. Off by default: inventing SKUs from a typo
   *  is how a catalogue fills with rubbish. */
  createMissingItems?: boolean;
}

export interface ImportBatchRow {
  id: string;
  kind: string;
  status: string;
  filename: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  reason: string;
  rowsTotal: number;
  rowsToApply: number;
  rowsNoChange: number;
  rowsInvalid: number;
  unitsChanged: number;
  rowsApplied: number;
  reversedAt: string | null;
  error: string | null;
  createdBy: string | null;
  createdAt: string;
  appliedAt: string | null;
}

export interface ImportBatchDetail extends ImportBatchRow {
  plan: ImportRowPlan[];
  /** The dry-run headline, recomputed from the stored plan so it always agrees
   *  with the rows on screen: "412 matched, 18 new items, 6 to sort out". */
  summary: ImportPlan;
}

// ─── Plan ────────────────────────────────────────────────────────────────────

/**
 * Read the file and work out what it would do. Writes no stock.
 */
export async function planAdjustmentImport(
  ctx: ServiceContext,
  input: PlanImportInput
): Promise<ImportBatchDetail> {
  const parsed = parseCsv(input.csv);
  if (parsed.headers.length === 0) {
    throw new InventoryValidationError('That file has no column headings to read', [
      { field: 'csv', message: 'empty file' },
    ]);
  }

  const id = await withTenant(ctx, async (tx) => {
    const profile = input.profileId
      ? await tx.inventoryImportProfile.findFirst({ where: { id: input.profileId } })
      : null;
    if (input.profileId && !profile) {
      throw new InventoryNotFoundError('InventoryImportProfile', input.profileId);
    }
    const profileOptions = (profile?.options ?? {}) as {
      reason?: string;
      warehouseId?: string | null;
      decimal?: '.' | ',';
      createMissingItems?: boolean;
    };

    const reason = input.reason ?? profileOptions.reason ?? 'manual';
    if (!REASONS.has(reason)) {
      throw new InventoryValidationError('That is not a reason stock can move for', [
        { field: 'reason', message: `unknown reason ${reason}` },
      ]);
    }

    const mapping = normalizeMapping(
      input.mapping ?? ((profile?.mapping ?? null) as ColumnMapping | null)
    );
    const decimal = input.decimal ?? profileOptions.decimal ?? '.';
    const fallbackWarehouseId = await resolveFallbackWarehouse(
      tx,
      input.warehouseId ?? profileOptions.warehouseId ?? null
    );

    // Resolve every code the file mentions in ONE query each, rather than a
    // lookup per row: a 5,000-row stock-take is a normal upload and 10,000
    // round-trips is not.
    const read = fieldReader(mapping);
    const skus = new Set<string>();
    for (const record of parsed.records) {
      const sku = read(record, 'sku', COLUMNS.sku);
      if (sku) skus.add(sku);
    }

    const variants =
      skus.size === 0
        ? []
        : await tx.productVariant.findMany({
            // Explicit tenant scope: the local superuser bypasses RLS and a SKU
            // collides across tenants.
            where: { tenantId: ctx.tenantId, sku: { in: [...skus] }, deletedAt: null },
            select: { id: true, sku: true },
          });
    const bySku = new Map(variants.map((v) => [v.sku, v.id]));

    const warehouses = await tx.warehouse.findMany({
      where: { tenantId: ctx.tenantId, deletedAt: null },
      select: { id: true, code: true, isActive: true },
    });
    const byCode = new Map(warehouses.map((w) => [w.code.toLowerCase(), w]));
    const byId = new Map(warehouses.map((w) => [w.id, w]));

    // Current stock for every (variant, warehouse) the file touches, so the plan
    // can show what the number is now beside what it would become.
    const variantIds = [...new Set([...bySku.values()])];
    const levels =
      variantIds.length === 0
        ? []
        : await tx.inventoryLevel.findMany({
            where: { tenantId: ctx.tenantId, variantId: { in: variantIds } },
            select: { variantId: true, warehouseId: true, onHand: true },
          });
    const onHandByKey = new Map(levels.map((l) => [`${l.variantId}:${l.warehouseId}`, l.onHand]));

    const customFields = await loadCustomFieldDefinitions(tx, ctx.tenantId, 'level');

    const rows: ImportRowPlan[] = parsed.records.map((record, index) =>
      planRow({
        record,
        read,
        decimal,
        customFields,
        line: parsed.lines[index] ?? index + 2,
        bySku,
        byCode,
        byId,
        onHandByKey,
        fallbackWarehouseId,
      })
    );

    const plan = summarizeImportPlan(rows);

    const batch = await tx.inventoryImportBatch.create({
      data: {
        tenantId: ctx.tenantId,
        kind: 'adjustment',
        status: 'planned',
        filename: input.filename ?? null,
        warehouseId: fallbackWarehouseId,
        reason,
        rowsTotal: plan.totalRows,
        rowsToApply: plan.applyCount,
        rowsNoChange: plan.noChangeCount,
        rowsInvalid: plan.errorCount,
        unitsChanged: plan.unitsChanged,
        // Cast through Prisma's JSON input type: an interface is not assignable
        // to `InputJsonValue` because TypeScript cannot prove it has no methods.
        plan: plan.rows as unknown as Prisma.InputJsonValue,
        createdBy: ctx.userId ?? null,
      },
      select: { id: true },
    });

    if (profile) await markProfileUsed(tx, profile.id);

    await audit(tx, ctx, batch.id, 'planned', {
      filename: input.filename ?? null,
      rows: plan.totalRows,
      toApply: plan.applyCount,
      invalid: plan.errorCount,
      newItems: plan.newItemCount,
      profile: profile?.name ?? null,
    });

    return batch.id;
  });

  const planned = await getImportBatch(ctx, id);

  // Creating items is a separate, LOUD step even when the caller asked for it up
  // front: the rows are planned first so the count is on the record, then the
  // creation runs as a resolution, which is what makes it reversible and
  // explicable afterwards.
  if (input.createMissingItems) {
    const newRows = planned.plan.filter(
      (row) => row.outcome === 'error' && row.sku && !row.variantId
    );
    if (newRows.length > 0) {
      return resolveImportRows(ctx, id, {
        resolutions: newRows.map((row) => ({
          line: row.line,
          action: 'create' as const,
          sku: row.sku!,
          title: nameOrCode(row.name, row.sku!),
          unitCostCents: row.unitCostCents ?? null,
        })),
      });
    }
  }

  return planned;
}

/** Field key → lower-cased heading, which is how `parseCsv` keys its records. */
function normalizeMapping(mapping: ColumnMapping | null): Record<string, string> {
  if (!mapping) return {};
  const out: Record<string, string> = {};
  for (const [key, header] of Object.entries(mapping)) {
    if (typeof header === 'string' && header.trim() !== '') {
      out[key] = header.trim().toLowerCase();
    }
  }
  return out;
}

type FieldReader = (
  record: Record<string, string>,
  key: string,
  aliases: readonly string[]
) => string | null;

/** Mapping first, aliases second. A mapped field that is EMPTY in this row reads
 *  as empty rather than falling through to an alias — a person who said "the
 *  quantity is column F" meant column F, and quietly reading column C instead is
 *  the failure the mapping screen exists to prevent. */
function fieldReader(mapping: Record<string, string>): FieldReader {
  return (record, key, aliases) => {
    const mapped = mapping[key];
    if (mapped !== undefined) {
      const value = record[mapped];
      return value !== undefined && value !== '' ? value : null;
    }
    return csvField(record, ...aliases);
  };
}

interface PlanRowArgs {
  record: Record<string, string>;
  read: FieldReader;
  decimal: '.' | ',';
  customFields: readonly CustomFieldDefinition[];
  line: number;
  bySku: Map<string, string>;
  byCode: Map<string, { id: string; code: string; isActive: boolean }>;
  byId: Map<string, { id: string; code: string; isActive: boolean }>;
  onHandByKey: Map<string, number>;
  fallbackWarehouseId: string | null;
}

/** Read a column as a whole number of units, distinguishing "absent" from
 *  "zero" — the distinction the whole import turns on, since a blank count must
 *  not adjust a level to nothing. `undefined` when absent, `null` when present
 *  and not a whole number, so the caller reports the row rather than skipping
 *  it. */
function readInteger(raw: string | null, decimal: '.' | ','): number | null | undefined {
  if (raw === null) return undefined;
  const parsed = parseSpreadsheetNumber(raw, { decimal, grouped: false, sampleCount: 0 });
  if (parsed.blank) return undefined;
  if (parsed.value === null || !Number.isInteger(parsed.value)) return null;
  return parsed.value;
}

/** One row's verdict. Every failure names the line and says what to fix in
 *  words the person who typed the file will recognise — "no item with code
 *  BRK-9920", not "variant lookup failed". */
function planRow(args: PlanRowArgs): ImportRowPlan {
  const { record, read, line } = args;
  const sku = read(record, 'sku', COLUMNS.sku);
  const explicitVariantId = read(record, 'variantId', COLUMNS.variantId);
  const variantId = explicitVariantId ?? (sku ? (args.bySku.get(sku) ?? null) : null);
  const name = read(record, 'name', COLUMNS.name);
  const unitCost = parseSpreadsheetNumber(read(record, 'unitCost', COLUMNS.unitCost), {
    decimal: args.decimal,
    grouped: false,
    sampleCount: 0,
  });
  const unitCostCents = unitCost.value === null ? null : Math.round(unitCost.value * 100);

  // Custom-field columns, read from `cf_<key>` and left as strings — coercion is
  // the one place that decides what a value means, and it runs on apply.
  const customFields: Record<string, unknown> = {};
  for (const definition of args.customFields) {
    const value = record[customFieldColumn(definition.key)];
    if (value !== undefined && value !== '') customFields[definition.key] = value;
  }
  const carriedFields = Object.keys(customFields).length > 0 ? customFields : undefined;

  // Read the quantity BEFORE anything can fail, so a row that could not be
  // matched still records what the file ASKED FOR. Without it, resolving a row
  // — pointing it at an item, or creating one — would have no quantity to apply
  // and would silently land as "already correct" (docs/146 Phase 11.3).
  const statedOnHand = readInteger(read(record, 'onHand', COLUMNS.onHand), args.decimal);
  const statedDelta = readInteger(read(record, 'delta', COLUMNS.delta), args.decimal);

  const fail = (error: string): ImportRowPlan => ({
    line,
    sku,
    variantId,
    warehouseId: null,
    outcome: 'error',
    // Null, because nothing was looked up — not zero, which would read as "we
    // checked and there are none".
    currentOnHand: null,
    newOnHand: typeof statedOnHand === 'number' ? statedOnHand : null,
    delta: typeof statedDelta === 'number' ? statedDelta : 0,
    error,
    name,
    unitCostCents,
    customFields: carriedFields,
  });

  if (!sku && !explicitVariantId) return fail('This row does not say which item it is about');
  if (!variantId) return fail(`Nothing in your catalogue has the code ${sku ?? ''}`.trim());

  const warehouseCode = read(record, 'warehouse', COLUMNS.warehouseCode);
  const explicitWarehouseId = read(record, 'warehouseId', COLUMNS.warehouseId);
  const warehouse = warehouseCode
    ? args.byCode.get(warehouseCode.toLowerCase())
    : explicitWarehouseId
      ? args.byId.get(explicitWarehouseId)
      : args.fallbackWarehouseId
        ? args.byId.get(args.fallbackWarehouseId)
        : undefined;

  if (!warehouse) {
    return fail(
      warehouseCode
        ? `You have no location called ${warehouseCode}`
        : 'This row does not say which location, and no default was chosen'
    );
  }
  if (!warehouse.isActive) {
    return fail(`${warehouse.code} is closed, so stock cannot be adjusted there`);
  }

  const onHand = statedOnHand;
  const delta = statedDelta;

  if (onHand === null) return fail('The counted quantity is not a whole number');
  if (delta === null) return fail('The change is not a whole number');
  if (onHand === undefined && delta === undefined) {
    // A row carrying only custom-field values is a real edit, not an empty row:
    // a file that corrects four hundred aisle numbers and no quantities is one
    // of the reasons custom fields are in the importer at all.
    if (carriedFields) {
      const current = args.onHandByKey.get(`${variantId}:${warehouse.id}`) ?? 0;
      return {
        line,
        sku,
        variantId,
        warehouseId: warehouse.id,
        outcome: 'no_change',
        currentOnHand: current,
        newOnHand: current,
        delta: 0,
        error: null,
        name,
        unitCostCents,
        customFields: carriedFields,
      };
    }
    return fail('This row has neither a counted quantity nor a change');
  }
  if (onHand !== undefined && delta !== undefined) {
    return fail('This row has both a counted quantity and a change — it can only have one');
  }
  if (onHand !== undefined && onHand < 0) {
    return fail('A counted quantity cannot be negative');
  }

  const current = args.onHandByKey.get(`${variantId}:${warehouse.id}`) ?? 0;
  const newOnHand = onHand ?? current + (delta ?? 0);
  const change = newOnHand - current;

  return {
    line,
    sku,
    variantId,
    warehouseId: warehouse.id,
    // A row that changes nothing is reported as `no_change`, not silently
    // dropped: on a stock-take, "412 rows, 398 already correct" is the reassuring
    // half of the answer.
    outcome: change === 0 ? 'no_change' : 'apply',
    currentOnHand: current,
    newOnHand,
    delta: change,
    error: null,
    name,
    unitCostCents,
    customFields: carriedFields,
  };
}

/** The name the file gave, or the code when it gave none. An EMPTY name is a
 *  missing one — `??` would keep the empty string and produce an item titled
 *  nothing, which the schema refuses and nobody could find afterwards. */
function nameOrCode(name: string | null | undefined, sku: string): string {
  const trimmed = name?.trim() ?? '';
  return trimmed === '' ? sku : trimmed;
}

async function resolveFallbackWarehouse(
  tx: TxClient,
  requested: string | null
): Promise<string | null> {
  if (!requested) return null;
  const warehouse = await tx.warehouse.findFirst({
    where: { id: requested, deletedAt: null },
    select: { id: true },
  });
  if (!warehouse) throw new InventoryNotFoundError('Warehouse', requested);
  return warehouse.id;
}

// ─── Resolve the rows that did not land (11.3) ───────────────────────────────

/**
 * Decide what to do about problem rows, and re-plan them.
 *
 * Runs against the STORED plan rather than the file, which is what lets a person
 * fix six rows over an afternoon without re-uploading — and what makes the
 * decisions part of the batch's permanent record rather than a browser state
 * that vanishes.
 *
 * `create` genuinely creates a catalogue item, as a DRAFT with no price. An item
 * that arrived in a stock file has no price, and defaulting one to zero would
 * put it on sale for nothing the moment the catalogue is published.
 */
export async function resolveImportRows(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<ImportBatchDetail> {
  const input = ResolveImportRowsInput.parse(rawInput);

  await withTenant(ctx, async (tx) => {
    const batch = await tx.inventoryImportBatch.findFirst({ where: { id } });
    if (!batch) throw new InventoryNotFoundError('InventoryImportBatch', id);
    if (batch.status !== 'planned') {
      throw new InventoryValidationError(
        'Only an import that has not been applied can be changed',
        [{ field: 'status', message: batch.status }]
      );
    }

    const rows = ((batch.plan as unknown as ImportRowPlan[] | null) ?? []).slice();
    const byLine = new Map(rows.map((row, index) => [row.line, index]));
    const stored = (batch.resolutions ?? {}) as Record<string, unknown>;
    const currency = await tenantCurrency(tx);

    for (const resolution of input.resolutions) {
      const index = byLine.get(resolution.line);
      if (index === undefined) {
        throw new InventoryValidationError(`This import has no row ${resolution.line}`, [
          { field: 'line', message: String(resolution.line) },
        ]);
      }
      const row = rows[index]!;
      rows[index] = await applyResolution(tx, ctx, row, resolution, batch.warehouseId, currency);
      stored[String(resolution.line)] = resolution;
    }

    const plan = summarizeImportPlan(rows);
    await tx.inventoryImportBatch.update({
      where: { id },
      data: {
        plan: plan.rows as unknown as Prisma.InputJsonValue,
        resolutions: stored as unknown as Prisma.InputJsonValue,
        rowsTotal: plan.totalRows,
        rowsToApply: plan.applyCount,
        rowsNoChange: plan.noChangeCount,
        rowsInvalid: plan.errorCount,
        unitsChanged: plan.unitsChanged,
      },
    });

    await audit(tx, ctx, id, 'resolved', {
      rows: input.resolutions.length,
      created: input.resolutions.filter((r) => r.action === 'create').length,
      skipped: input.resolutions.filter((r) => r.action === 'skip').length,
      matched: input.resolutions.filter((r) => r.action === 'match').length,
    });
  });

  return getImportBatch(ctx, id);
}

async function applyResolution(
  tx: TxClient,
  ctx: ServiceContext,
  row: ImportRowPlan,
  resolution: ImportRowResolution,
  fallbackWarehouseId: string | null,
  currency: string
): Promise<ImportRowPlan> {
  if (resolution.action === 'skip') {
    return { ...row, outcome: 'skipped', delta: 0, error: null, resolution: 'skip' };
  }

  const variantId =
    resolution.action === 'match'
      ? resolution.variantId
      : await createVariantForImport(tx, ctx, resolution, currency);

  const warehouseId = row.warehouseId ?? fallbackWarehouseId;
  if (!warehouseId) {
    return {
      ...row,
      variantId,
      outcome: 'error',
      error: 'This row still does not say which location, and no default was chosen',
      resolution: resolution.action,
    };
  }

  // Re-read what is there NOW: the row's original `currentOnHand` was computed
  // against a variant that either did not exist or was the wrong one.
  const level = await tx.inventoryLevel.findFirst({
    where: { variantId, warehouseId },
    select: { onHand: true },
  });
  const current = level?.onHand ?? 0;
  // The file's intent is preserved: a row that named an absolute count still
  // means that count; a row that named a change still means that change.
  const target = row.newOnHand ?? current + row.delta;
  const change = target - current;

  return {
    ...row,
    variantId,
    warehouseId,
    outcome: change === 0 ? 'no_change' : 'apply',
    currentOnHand: current,
    newOnHand: target,
    delta: change,
    error: null,
    resolution: resolution.action,
  };
}

/** Create the catalogue item a row wanted. One product per item, because a stock
 *  system's items ARE products here; drafted and unpriced, because a stock file
 *  says nothing about what to sell it for. */
async function createVariantForImport(
  tx: TxClient,
  ctx: ServiceContext,
  resolution: Extract<ImportRowResolution, { action: 'create' }>,
  currency: string
): Promise<string> {
  const existing = await tx.productVariant.findFirst({
    where: { tenantId: ctx.tenantId, sku: resolution.sku, deletedAt: null },
    select: { id: true },
  });
  if (existing) return existing.id;

  const handle = await uniqueHandle(tx, ctx.tenantId, resolution.title, resolution.sku);
  const product = await tx.product.create({
    data: {
      tenantId: ctx.tenantId,
      title: resolution.title,
      handle,
      // Draft, always. An item created by an import has not been reviewed by
      // anyone and must not appear on a storefront because somebody uploaded a
      // stock file.
      status: 'draft',
      metadata: { createdBy: 'inventory-import' },
    },
    select: { id: true },
  });

  const variant = await tx.productVariant.create({
    data: {
      tenantId: ctx.tenantId,
      productId: product.id,
      sku: resolution.sku,
      title: resolution.title,
      // Zero is not a price here, it is the absence of one — which is why the
      // product is a draft. Publishing it is a deliberate act that goes through
      // the catalogue screens, where the price is a required field.
      priceCents: 0,
      currency,
      costCents: resolution.unitCostCents,
      isDefault: true,
    },
    select: { id: true },
  });

  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: 'inventory.import.item_created',
    entityType: 'ProductVariant',
    entityId: variant.id,
    diff: { after: { sku: resolution.sku, title: resolution.title } },
  });

  return variant.id;
}

async function uniqueHandle(
  tx: TxClient,
  tenantId: string,
  title: string,
  sku: string
): Promise<string> {
  const base =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || sku.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (let attempt = 0; attempt < 20; attempt++) {
    const candidate = attempt === 0 ? base : `${base}-${attempt + 1}`;
    const clash = await tx.product.findFirst({
      where: { tenantId, handle: candidate },
      select: { id: true },
    });
    if (!clash) return candidate;
  }
  // Deterministic tail from the SKU rather than a random one: two runs of the
  // same import must not litter the catalogue with near-duplicate handles.
  return `${base}-${sku.toLowerCase().replace(/[^a-z0-9]+/g, '')}`.slice(0, 120);
}

async function tenantCurrency(tx: TxClient): Promise<string> {
  const policy = await tx.costingPolicy.findFirst({ select: { baseCurrency: true } });
  return policy?.baseCurrency ?? 'USD';
}

// ─── Apply ───────────────────────────────────────────────────────────────────

export interface ApplyImportResult extends ImportBatchDetail {
  /** Rows whose current stock had moved since the plan was made, so the change
   *  posted differs from the change approved. Surfaced rather than swallowed:
   *  the operator approved a number, and this says where reality disagreed. */
  driftedRows: number;
  /** Rows whose custom-field values were written. */
  fieldsUpdated: number;
}

/**
 * Post what was planned.
 *
 * Every movement carries `referenceType: 'InventoryImportBatch'` and the batch
 * id, which is what makes the import listable, explainable and reversible as a
 * unit afterwards.
 *
 * Rows are posted with an idempotency key derived from the batch and the line,
 * so a retry after a network failure part-way through resumes rather than
 * doubling every row it already wrote.
 */
export async function applyImportBatch(
  ctx: ServiceContext,
  id: string
): Promise<ApplyImportResult> {
  const batch = await getImportBatch(ctx, id);
  if (batch.status !== 'planned') {
    throw new InventoryValidationError(
      batch.status === 'applied'
        ? 'This import has already been applied'
        : `This import is ${batch.status} and cannot be applied`,
      [{ field: 'status', message: batch.status }]
    );
  }

  const toApply = batch.plan.filter((row) => row.outcome === 'apply');
  // A row that changes no quantity can still carry custom-field values, and a
  // skipped row carries nothing at all — being explicit about which rows are
  // touched here is what keeps "skipped" meaning skipped.
  const fieldRows = batch.plan.filter(
    (row) =>
      (row.outcome === 'apply' || row.outcome === 'no_change') &&
      row.customFields &&
      Object.keys(row.customFields).length > 0
  );
  let applied = 0;
  let driftedRows = 0;
  let fieldsUpdated = 0;
  // Events are collected and published AFTER the transaction commits. Publishing
  // inside it would announce stock levels that a rollback then un-did.
  const events: PendingEvent[] = [];

  await withTenant(ctx, async (tx) => {
    for (const row of toApply) {
      if (!row.variantId || !row.warehouseId) continue;
      const result = await applyMovement(tx, {
        tenantId: ctx.tenantId,
        variantId: row.variantId,
        warehouseId: row.warehouseId,
        delta: row.delta,
        reason: batch.reason,
        referenceType: 'InventoryImportBatch',
        referenceId: id,
        note: `Imported from ${batch.filename ?? 'a spreadsheet'}, row ${row.line}`,
        actorType: resolveActorType(ctx),
        actorId: ctx.userId ?? null,
        source: null,
        unitCostCents: null,
        // Batch + line. A resumed apply finds the rows it already wrote and
        // dedupes them instead of posting the change twice.
        idempotencyKey: `import:${id}:${row.line}`,
      });
      if (!result.deduped) {
        applied += 1;
        // The plan said the level was at `currentOnHand`; the ledger says what
        // it was really at. A difference means somebody sold one while the file
        // was being checked.
        if (row.currentOnHand !== null && result.onHand - row.delta !== row.currentOnHand) {
          driftedRows += 1;
        }
        events.push({
          variantId: row.variantId,
          warehouseId: row.warehouseId,
          result,
          delta: row.delta,
        });
      }
    }

    for (const row of fieldRows) {
      if (!row.variantId || !row.warehouseId || !row.customFields) continue;
      const written = await applyCustomFields(
        tx,
        ctx,
        'level',
        { variantId: row.variantId, warehouseId: row.warehouseId },
        row.customFields
      );
      if (written.changed.length > 0) fieldsUpdated += 1;
    }

    await tx.inventoryImportBatch.update({
      where: { id },
      data: { status: 'applied', rowsApplied: applied, appliedAt: new Date() },
    });

    await audit(tx, ctx, id, 'applied', {
      rowsApplied: applied,
      driftedRows,
      fieldsUpdated,
      reason: batch.reason,
    });

    // The wizard's import step, ticked by the thing it was asking for. Only
    // when a setup is actually under way — see `noteSetupStep`.
    await noteSetupStep(tx, ctx.tenantId, 'import', {
      batchId: id,
      rowsApplied: applied,
      filename: batch.filename,
    });
  });

  await publishAll(ctx, events, batch.reason);

  return { ...(await getImportBatch(ctx, id)), driftedRows, fieldsUpdated };
}

/** Throw away a plan that was never applied. Nothing to undo — no stock moved. */
export async function discardImportBatch(
  ctx: ServiceContext,
  id: string
): Promise<ImportBatchDetail> {
  await withTenant(ctx, async (tx) => {
    const batch = await tx.inventoryImportBatch.findFirst({
      where: { id },
      select: { status: true },
    });
    if (!batch) throw new InventoryNotFoundError('InventoryImportBatch', id);
    if (batch.status !== 'planned') {
      throw new InventoryValidationError(
        'Only an import that has not been applied can be thrown away',
        [{ field: 'status', message: batch.status }]
      );
    }
    await tx.inventoryImportBatch.update({ where: { id }, data: { status: 'discarded' } });
    await audit(tx, ctx, id, 'discarded', {});
  });
  return getImportBatch(ctx, id);
}

/**
 * Undo an applied import.
 *
 * Writes COMPENSATING movements — a `-5` against every `+5` — rather than
 * deleting the originals. The ledger is append-only and an import that could be
 * erased is one nobody can audit; the reversal is itself a fact worth having on
 * the record.
 *
 * Items the import CREATED are not deleted. They may already have been priced,
 * photographed and sold from; undoing a quantity is not a mandate to remove a
 * catalogue entry, and the audit log says which import made them.
 */
export async function reverseImportBatch(
  ctx: ServiceContext,
  id: string
): Promise<ImportBatchDetail> {
  const batch = await getImportBatch(ctx, id);
  if (batch.status !== 'applied') {
    throw new InventoryValidationError('Only an applied import can be undone', [
      { field: 'status', message: batch.status },
    ]);
  }
  if (batch.reversedAt) {
    throw new InventoryValidationError('This import has already been undone', [
      { field: 'reversedAt', message: batch.reversedAt },
    ]);
  }

  const events: PendingEvent[] = [];

  await withTenant(ctx, async (tx) => {
    for (const row of batch.plan) {
      if (row.outcome !== 'apply' || !row.variantId || !row.warehouseId) continue;
      const result = await applyMovement(tx, {
        tenantId: ctx.tenantId,
        variantId: row.variantId,
        warehouseId: row.warehouseId,
        delta: -row.delta,
        reason: batch.reason,
        referenceType: 'InventoryImportBatch',
        referenceId: id,
        note: `Undo of import row ${row.line}`,
        actorType: resolveActorType(ctx),
        actorId: ctx.userId ?? null,
        source: null,
        unitCostCents: null,
        idempotencyKey: `import-reverse:${id}:${row.line}`,
        // An undo must be allowed to take a level negative. Refusing would leave
        // the reversal half-done, which is worse than the negative: a level that
        // is wrong AND partly corrected cannot be reasoned about at all.
        allowNegative: true,
      });
      if (!result.deduped) {
        events.push({
          variantId: row.variantId,
          warehouseId: row.warehouseId,
          result,
          delta: -row.delta,
        });
      }
    }

    await tx.inventoryImportBatch.update({
      where: { id },
      data: { reversedAt: new Date(), reversedBy: ctx.userId ?? null },
    });
    await audit(tx, ctx, id, 'reversed', { rows: batch.rowsApplied });
  });

  await publishAll(ctx, events, batch.reason);
  return getImportBatch(ctx, id);
}

// ─── Reads ───────────────────────────────────────────────────────────────────

export interface ListImportBatchesFilter {
  status?: string;
  take?: number;
  skip?: number;
}

export async function listImportBatches(
  ctx: ServiceContext,
  filter: ListImportBatchesFilter = {}
): Promise<{ items: ImportBatchRow[]; total: number }> {
  const take = Math.min(filter.take ?? 50, 200);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.status ? { status: filter.status } : {}),
    };
    const [rows, total] = await Promise.all([
      tx.inventoryImportBatch.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip: filter.skip ?? 0,
        include: { warehouse: { select: { name: true } } },
      }),
      tx.inventoryImportBatch.count({ where }),
    ]);
    return { items: rows.map(serializeBatch), total };
  });
}

export async function getImportBatch(ctx: ServiceContext, id: string): Promise<ImportBatchDetail> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventoryImportBatch.findFirst({
      where: { id },
      include: { warehouse: { select: { name: true } } },
    });
    if (!row) throw new InventoryNotFoundError('InventoryImportBatch', id);
    const plan = (row.plan as unknown as ImportRowPlan[] | null) ?? [];
    return {
      ...serializeBatch(row),
      plan,
      summary: summarizeImportPlan(plan),
    };
  });
}

// ─── The round-trip template (10.6) ──────────────────────────────────────────

/**
 * Current stock, in the columns the importer reads.
 *
 * The `on_hand` column comes back filled with what the system currently thinks,
 * which is deliberate: a stock-take starts from the system's number and records
 * where it was wrong, and a blank column would make somebody type four thousand
 * figures that were already right.
 *
 * Custom fields ride along as `cf_<key>` columns, which the importer reads back
 * (11.8). A tenant who keeps an aisle number in sparx gets it in the sheet they
 * count from, which is the only way that column stays current.
 */
export async function adjustmentTemplate(
  ctx: ServiceContext,
  filter: { warehouseId?: string | null; take?: number } = {}
): Promise<CsvTable> {
  const take = Math.min(filter.take ?? 5000, 20_000);
  const warehouse = filter.warehouseId ?? null;

  return withTenant(ctx, async (tx) => {
    const definitions = await loadCustomFieldDefinitions(tx, ctx.tenantId, 'level');
    const rows = await tx.$queryRaw<
      {
        sku: string;
        title: string;
        warehouse_code: string;
        on_hand: number;
        custom_fields: Record<string, unknown> | null;
      }[]
    >`
      SELECT v.sku, COALESCE(v.title, p.title) AS title, w.code AS warehouse_code, l.on_hand,
             l.custom_fields
      FROM inventory_levels l
      JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
      JOIN commerce_products p ON p.id = v.product_id
      JOIN inventory_warehouses w ON w.id = l.warehouse_id AND w.deleted_at IS NULL
      WHERE l.tenant_id = ${ctx.tenantId}::uuid
        AND (${warehouse}::uuid IS NULL OR l.warehouse_id = ${warehouse}::uuid)
      ORDER BY w.code ASC, v.sku ASC
      LIMIT ${take}
    `;

    return {
      name: 'stock-count',
      // `item` is informational and ignored on the way back in — a person needs
      // to see what they are counting, and the parser needs to not care.
      headers: [
        'sku',
        'item',
        'warehouse',
        'on_hand',
        'note',
        ...definitions.map((definition) => customFieldColumn(definition.key)),
      ],
      rows: rows.map((row) => [
        row.sku,
        csvSafeText(row.title),
        row.warehouse_code,
        row.on_hand,
        null,
        ...definitions.map((definition) => {
          const value = row.custom_fields?.[definition.key];
          if (value === null || value === undefined) return null;
          if (Array.isArray(value)) return value.join('|');
          if (typeof value === 'string') return csvSafeText(value);
          if (typeof value === 'number' || typeof value === 'boolean') return value;
          // Anything else is a shape no coercion produces. JSON rather than
          // `String()`, which would write "[object Object]" into the export and
          // then read it back in as a value.
          return JSON.stringify(value);
        }),
      ]),
    };
  });
}

// ─── plumbing ────────────────────────────────────────────────────────────────

interface PendingEvent {
  variantId: string;
  warehouseId: string;
  result: Awaited<ReturnType<typeof applyMovement>>;
  delta: number;
}

/** Announce every level this batch moved, after the transaction has committed.
 *  A failure to publish must not undo an applied import — the stock IS adjusted,
 *  and the reconciliation sweep will catch a projection that missed the news. */
async function publishAll(
  ctx: ServiceContext,
  events: readonly PendingEvent[],
  reason: string
): Promise<void> {
  for (const event of events) {
    await emitStockEvents(
      ctx,
      event.variantId,
      event.warehouseId,
      event.result,
      event.delta,
      reason
    );
  }
}

function serializeBatch(row: {
  id: string;
  kind: string;
  status: string;
  filename: string | null;
  warehouseId: string | null;
  warehouse?: { name: string } | null;
  reason: string;
  rowsTotal: number;
  rowsToApply: number;
  rowsNoChange: number;
  rowsInvalid: number;
  unitsChanged: number;
  rowsApplied: number;
  reversedAt: Date | null;
  error: string | null;
  createdBy: string | null;
  createdAt: Date;
  appliedAt: Date | null;
}): ImportBatchRow {
  return {
    id: row.id,
    kind: row.kind,
    status: row.status,
    filename: row.filename,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse?.name ?? null,
    reason: row.reason,
    rowsTotal: row.rowsTotal,
    rowsToApply: row.rowsToApply,
    rowsNoChange: row.rowsNoChange,
    rowsInvalid: row.rowsInvalid,
    unitsChanged: row.unitsChanged,
    rowsApplied: row.rowsApplied,
    reversedAt: row.reversedAt?.toISOString() ?? null,
    error: row.error,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    appliedAt: row.appliedAt?.toISOString() ?? null,
  };
}

export type { ImportPlan, ImportRowPlan };

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  entityId: string,
  action: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.import.${action}`,
    entityType: 'InventoryImportBatch',
    entityId,
    diff: { after: diff },
  });
}
