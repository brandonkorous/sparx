// Reading somebody else's spreadsheet (docs/146 Phase 11.2 + 11.7).
//
// Two things happen before a single row is planned, and both of them are about
// not being wrong confidently.
//
//   PREVIEW   read the headings, guess what each one is, say how sure the guess
//             is, and show three real rows so a person can see the guess landing
//             on their own data rather than on an abstraction.
//   PROFILE   remember the answer, so the second import of the same monthly
//             export is one click instead of the same eleven decisions.
//
// The matching arithmetic is pure and lives in @wizeworks/commerce-schemas. What is
// here is the part that touches a database: recording what the tenant confirmed,
// and counting how often it gets used so a list of six profiles can be ordered
// by what they actually reach for.
//
// ── Recipes are code, not rows ───────────────────────────────────────────────
//
// `MIGRATION_RECIPES` ships in the source. A preset that needed a seed stage to
// reach production would be a deployment problem for what is really a list of
// column spellings — and the day one of those spellings turns out to be wrong,
// the fix should be a patch release rather than a data migration.

import {
  CreateImportProfileInput,
  ImportProfileOptions,
  MIGRATION_RECIPES,
  UpdateImportProfileInput,
  detectNumberFormat,
  matchColumns,
  migrationRecipe,
  summarizeMapping,
  targetsForRecipe,
  type ColumnMapping,
  type ColumnMatch,
  type MappingVerdict,
  type MigrationRecipe,
  type NumberFormat,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { parseCsv } from '../csv';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

export interface ImportProfileRow {
  id: string;
  name: string;
  kind: string;
  mapping: ColumnMapping;
  options: ImportProfileOptions;
  recipeKey: string | null;
  /** Null means never used, which is not the same as used long ago — the list
   *  says "not used yet" rather than showing a blank date column. */
  lastUsedAt: string | null;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

interface ProfileRecord {
  id: string;
  name: string;
  kind: string;
  mapping: unknown;
  options: unknown;
  recipeKey: string | null;
  lastUsedAt: Date | null;
  useCount: number;
  createdAt: Date;
  updatedAt: Date;
}

function serialize(row: ProfileRecord): ImportProfileRow {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind,
    mapping: (row.mapping ?? {}) as ColumnMapping,
    // Parsed rather than cast: a profile written before an option existed must
    // come back with that option's default, not with `undefined` reaching the
    // importer as a silent "no".
    options: ImportProfileOptions.parse(row.options ?? {}),
    recipeKey: row.recipeKey,
    lastUsedAt: row.lastUsedAt?.toISOString() ?? null,
    useCount: row.useCount,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ─── Profiles ────────────────────────────────────────────────────────────────

export async function listImportProfiles(
  ctx: ServiceContext,
  kind = 'stock'
): Promise<ImportProfileRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.inventoryImportProfile.findMany({
      where: { tenantId: ctx.tenantId, kind },
      // Most-used first, then most-recent. A tenant with six profiles reaches
      // for the same one most months.
      orderBy: [{ useCount: 'desc' }, { updatedAt: 'desc' }],
      take: 50,
    });
    return rows.map(serialize);
  });
}

export async function getImportProfile(ctx: ServiceContext, id: string): Promise<ImportProfileRow> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.inventoryImportProfile.findFirst({ where: { id } });
    if (!row) throw new InventoryNotFoundError('InventoryImportProfile', id);
    return serialize(row);
  });
}

export async function createImportProfile(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<ImportProfileRow> {
  const input = CreateImportProfileInput.parse(rawInput);
  if (Object.keys(input.mapping).length === 0) {
    throw new InventoryValidationError('A saved mapping has to map at least one column', [
      { field: 'mapping', message: 'empty' },
    ]);
  }

  return withTenant(ctx, async (tx) => {
    const clash = await tx.inventoryImportProfile.findFirst({
      where: { tenantId: ctx.tenantId, name: input.name },
      select: { id: true },
    });
    if (clash) {
      throw new InventoryValidationError(`You already have a saved mapping called ${input.name}`, [
        { field: 'name', message: 'duplicate' },
      ]);
    }

    const row = await tx.inventoryImportProfile.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        kind: input.kind,
        mapping: input.mapping,
        options: input.options,
        recipeKey: input.recipeKey,
        createdBy: ctx.userId ?? null,
      },
    });
    await audit(tx, ctx, row.id, 'created', { name: input.name, recipe: input.recipeKey });
    return serialize(row);
  });
}

export async function updateImportProfile(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<ImportProfileRow> {
  const input = UpdateImportProfileInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryImportProfile.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('InventoryImportProfile', id);

    if (input.mapping !== undefined && Object.keys(input.mapping).length === 0) {
      throw new InventoryValidationError('A saved mapping has to map at least one column', [
        { field: 'mapping', message: 'empty' },
      ]);
    }

    // Options merge over what is stored. A patch naming the decimal character
    // must not reset the movement reason to its default — the trap
    // `patch-semantics.test.ts` exists to catch, one layer down from the schema.
    const options =
      input.options === undefined
        ? undefined
        : ImportProfileOptions.parse({
            ...ImportProfileOptions.parse(existing.options ?? {}),
            ...input.options,
          });

    const row = await tx.inventoryImportProfile.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.mapping !== undefined ? { mapping: input.mapping } : {}),
        ...(options !== undefined ? { options } : {}),
      },
    });
    await audit(tx, ctx, id, 'updated', { ...input });
    return serialize(row);
  });
}

export async function deleteImportProfile(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.inventoryImportProfile.findFirst({
      where: { id },
      select: { id: true, name: true },
    });
    if (!existing) throw new InventoryNotFoundError('InventoryImportProfile', id);
    await tx.inventoryImportProfile.delete({ where: { id } });
    await audit(tx, ctx, id, 'deleted', { name: existing.name });
  });
}

/** Count a use, from inside the transaction that used it. Both columns move
 *  together — the CHECK on the table refuses a count with no date. */
export async function markProfileUsed(tx: TxClient, id: string): Promise<void> {
  await tx.inventoryImportProfile.update({
    where: { id },
    data: { useCount: { increment: 1 }, lastUsedAt: new Date() },
  });
}

// ─── Preview ─────────────────────────────────────────────────────────────────

export interface ImportPreviewInput {
  csv: string;
  filename?: string | null;
  /** Start from a recipe's extra column spellings. */
  recipeKey?: string | null;
  /** Start from a saved mapping. Its answers WIN over any guess — that is the
   *  entire value of having saved it. */
  profileId?: string | null;
}

export interface ImportPreview {
  filename: string | null;
  headers: string[];
  /** The first few rows, exactly as read, so a person sees the mapping land on
   *  their own data. Three: enough to spot a header row read as data, few enough
   *  to fit above the fold. */
  sampleRows: Record<string, string>[];
  rowCount: number;
  mapping: MappingVerdict;
  /** How this file writes its numbers. Null when the file gave no evidence
   *  either way, in which case the default stands and the screen says so rather
   *  than claiming a detection that did not happen. */
  numberFormat: NumberFormat | null;
  profile: ImportProfileRow | null;
  recipe: MigrationRecipe | null;
}

/**
 * Read a file and say what it looks like — without touching stock.
 *
 * Everything here is a read. The upload is not stored, no batch is created, and
 * nothing is written: a person must be able to drag a file in, see that they
 * grabbed last year's export, and close the tab having changed nothing.
 */
export async function previewImport(
  ctx: ServiceContext,
  input: ImportPreviewInput
): Promise<ImportPreview> {
  const parsed = parseCsv(input.csv);
  if (parsed.headers.length === 0) {
    throw new InventoryValidationError('That file has no column headings to read', [
      { field: 'csv', message: 'empty file' },
    ]);
  }

  const profile = input.profileId ? await getImportProfile(ctx, input.profileId) : null;
  const recipeKey = input.recipeKey ?? profile?.recipeKey ?? null;
  const recipe = recipeKey ? migrationRecipe(recipeKey) : null;

  const guessed = matchColumns(parsed.rawHeaders, targetsForRecipe(recipeKey));
  const matches = profile
    ? applySavedMapping(guessed, profile.mapping, parsed.rawHeaders)
    : guessed;

  // Sample the quantity column's own values rather than the whole file: "12,000"
  // in a cost column and "12,000" in a quantity column are the same string and
  // only one of them is likely to be twelve thousand.
  const quantityHeader =
    matches.find((match) => match.key === 'onHand')?.header ??
    matches.find((match) => match.key === 'delta')?.header ??
    matches.find((match) => match.key === 'unitCost')?.header ??
    null;
  const numberFormat = quantityHeader
    ? detectNumberFormat(
        parsed.records
          .map((record) => record[quantityHeader.trim().toLowerCase()] ?? '')
          .slice(0, 200)
      )
    : null;

  return {
    filename: input.filename ?? null,
    headers: parsed.rawHeaders,
    sampleRows: parsed.records.slice(0, 3),
    rowCount: parsed.records.length,
    mapping: summarizeMapping(parsed.rawHeaders, matches),
    numberFormat,
    profile,
    recipe,
  };
}

/**
 * Overlay a saved mapping on the guesses.
 *
 * A saved answer beats a guess, but only where the heading it names is actually
 * in THIS file. When it is not, the guess stands and the confidence reports it
 * as a guess — because a profile confidently pointing at a column that is no
 * longer in the export is exactly how last month's answer silently imports the
 * wrong column.
 */
function applySavedMapping(
  guessed: ColumnMatch[],
  mapping: ColumnMapping,
  headers: readonly string[]
): ColumnMatch[] {
  const present = new Map(headers.map((header) => [header.trim().toLowerCase(), header]));
  return guessed.map((match) => {
    const saved = mapping[match.key];
    if (saved === undefined) {
      // The profile deliberately left this unmapped. Honour that — a guess
      // reinstating a column the tenant unmapped is the profile failing to mean
      // anything.
      return Object.keys(mapping).length > 0
        ? { ...match, header: null, confidence: 0, reason: 'none' as const }
        : match;
    }
    const actual = present.get(saved.trim().toLowerCase());
    if (!actual) return match;
    return { ...match, header: actual, confidence: 1, reason: 'exact' as const };
  });
}

// ─── Recipes ─────────────────────────────────────────────────────────────────

export function listMigrationRecipes(): readonly MigrationRecipe[] {
  return MIGRATION_RECIPES;
}

export type { MigrationRecipe, ColumnMapping, ImportProfileOptions, MappingVerdict };

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
    action: `inventory.import_profile.${action}`,
    entityType: 'InventoryImportProfile',
    entityId,
    diff: { after: diff },
  });
}
