// Spreadsheet columns → tenant-declared properties (docs/144 §3.5).
//
// A business that has declared "Warranty expires" on their customers will have a
// column called `Warranty expires` in the spreadsheet they are importing — that
// is where the field came from in the first place. If the importer ignores it,
// the person is told the import succeeded and then has to re-key three hundred
// dates by hand, which is worse than being told it failed.
//
// MATCHING IS BY WHAT A PERSON WOULD WRITE, not by an exact key:
//
//   Warranty expires  ·  warranty expires  ·  Warranty Expires
//   warrantyExpires   ·  warranty_expires  ·  custom.warrantyExpires
//
// all reach the same field. The `custom.` prefix is the escape hatch for the one
// real collision — a declared property whose label happens to match a built-in
// column ("Company", "Phone") — because a header the built-in mapper already
// claimed is never offered here.
//
// A cell that cannot be read is a ROW ERROR, not a silent skip. An import that
// says "300 imported" while having dropped a column is the failure mode this
// whole file exists to prevent.

import { coerceFromText, type FieldDef, type FieldSchema } from '@sparx/field-schema';

/** One column that could not be read, in the words shown back to the person. */
export interface ColumnProblem {
  column: string;
  message: string;
}

export interface PropertyColumnResult {
  /** The typed values, ready for `resolvePropertyBag`. Empty when none matched. */
  values: Record<string, unknown>;
  /** Cells that had something in them we could not read. */
  problems: ColumnProblem[];
  /** Columns that matched a declared property, so the caller can skip them. */
  matchedColumns: string[];
}

/**
 * Reduce a header to what it has in common with every other spelling of itself:
 * lowercase, letters and digits only. "Warranty expires", "warranty_expires" and
 * "warrantyExpires" all become `warrantyexpires`.
 */
function normalizeHeader(header: string): string {
  return header
    .trim()
    .toLowerCase()
    .replace(/^custom\./, '')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Build the lookup from every header spelling to the field it means.
 *
 * Both the key and the label are registered. When two fields would claim the
 * same normalized header the FIRST one declared wins and the second is simply
 * not reachable by that spelling — deterministic, and the property editor's
 * duplicate check already warns about the case that causes it.
 */
function buildIndex(schema: FieldSchema): Map<string, FieldDef> {
  const index = new Map<string, FieldDef>();
  for (const field of schema.fields) {
    // A calculated field is worked out on write; a column for one is ignored.
    if (field.type === 'calculated') continue;
    for (const spelling of [field.key, field.label]) {
      const normalized = normalizeHeader(spelling);
      if (normalized !== '' && !index.has(normalized)) index.set(normalized, field);
    }
  }
  return index;
}

/**
 * Read every column of one row that names a declared property.
 *
 * `reservedColumns` are the headers the built-in mapper has already consumed
 * (email, first_name, …). They are skipped even if a property shares the name,
 * because the built-in meaning is the one the rest of the importer relies on —
 * a business that really does track their own "Company" property reaches it by
 * writing `custom.company` in the header instead.
 */
export function propertiesFromRow(
  schema: FieldSchema,
  row: Record<string, string | undefined>,
  reservedColumns: readonly string[] = []
): PropertyColumnResult {
  const result: PropertyColumnResult = { values: {}, problems: [], matchedColumns: [] };
  if (schema.fields.length === 0) return result;

  const index = buildIndex(schema);
  const reserved = new Set(reservedColumns.map((column) => normalizeHeader(column)));

  for (const [header, raw] of Object.entries(row)) {
    if (raw === undefined) continue;

    const explicit = header.trim().toLowerCase().startsWith('custom.');
    const normalized = normalizeHeader(header);
    // An explicit `custom.` header outranks the built-in mapper — that is what
    // the prefix is FOR.
    if (!explicit && reserved.has(normalized)) continue;

    const field = index.get(normalized);
    if (!field) continue;

    result.matchedColumns.push(header);
    const { value, problem } = coerceFromText(field, raw);
    if (problem) {
      result.problems.push({ column: header, message: problem.message });
      continue;
    }
    // `undefined` means the cell was blank — leave the stored value alone
    // rather than writing an empty over it.
    if (value !== undefined) result.values[field.key] = value;
  }

  return result;
}

/** One sentence naming every column that could not be read, for a row error. */
export function describeColumnProblems(problems: readonly ColumnProblem[]): string {
  return problems.map((problem) => `${problem.column}: ${problem.message}`).join(' ');
}
