// Validation — the check that runs BEFORE anything is uploaded.
//
// The workbench parses the tenant's file in the browser, so it can also check it in
// the browser: a file with a missing SKU column is rejected in the time it takes to
// drop it, without a byte crossing the network and without a job existing anywhere.
// The tenant fixes the file and drops it again. That loop is the difference between
// an importer someone tries once and an importer someone trusts.
//
// The same functions run in the worker, which is the point. If the preview said "412
// rows are fine" using different logic than the import, the preview was a guess and
// the first time a tenant catches us guessing is the last time they use it.
//
// Severity has a precise meaning here, and it is not "how bad does it look":
//
//   error   — this row CANNOT be written. It is excluded from the import, and if a
//             required column is missing entirely the whole file is blocked.
//   warning — this row WILL be written, and something about it was changed or
//             dropped to make that possible. The tenant needs to know, not decide.
//
// Anything that would silently alter data is a warning by construction; anything that
// would silently lose a row is an error. There is no third level, because a level a
// person can ignore is a level that should not have been shown.

import type { CanonicalEntity, CanonicalRow, FieldSpec } from './canonical';
import { ENTITY_FIELDS, ENTITY_LABEL, naturalKeyFields } from './canonical';
import {
  clean,
  isAmbiguousDate,
  isBlank,
  isEmail,
  isUrl,
  toBoolean,
  toCents,
  toDecimal,
  toInteger,
  toIsoDate,
} from './coerce';

export type IssueSeverity = 'error' | 'warning';

export interface ValidationIssue {
  severity: IssueSeverity;
  /** 0-based index into the mapped rows. `-1` for an issue about the file itself. */
  rowIndex: number;
  /** Canonical field key, when the issue is about one column. */
  column?: string;
  /** The offending value, truncated for display. */
  value?: string;
  /** Stable machine code, so a surface can group and count without parsing prose. */
  code: string;
  /** Written for a business owner, not an engineer. */
  message: string;
  /** What to do about it. Present whenever there is something to do. */
  hint?: string;
}

export interface DuplicateGroup {
  key: string;
  rows: number[];
}

export interface ValidationReport {
  entity: CanonicalEntity;
  rowCount: number;
  /** Rows with no error-severity issue — the number that would actually import. */
  okCount: number;
  errorCount: number;
  warningCount: number;
  /** True when the file cannot be imported at all (a required column is absent). */
  blocked: boolean;
  issues: ValidationIssue[];
  /** True when `issues` was capped. Counts above are always the true totals. */
  truncated: boolean;
  /**
   * Every row index carrying at least one error, uncapped.
   *
   * Separate from `issues` precisely BECAUSE `issues` is capped: the import path has
   * to skip all of these, and reading them off a truncated list would import broken
   * rows 501-onward. Numbers are cheap; issue objects are not.
   */
  errorRows: number[];
  /** Columns present in the mapped rows that no field spec claims. Ignored on import. */
  unmappedColumns: string[];
  /** Rows that share a natural key inside this one file. */
  duplicates: DuplicateGroup[];
}

/** Hard cap on issues carried back to the UI. The counts are always complete; only
 *  the list is capped, because 40,000 issue objects freeze a browser tab. */
const MAX_ISSUES = 500;

function preview(value: string): string {
  const text = clean(value);
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

/** Does this value read as its declared kind? `undefined` means "not checkable". */
function readsAs(spec: FieldSpec, raw: string): boolean | undefined {
  switch (spec.kind) {
    case 'money':
      return toCents(raw) !== undefined;
    case 'integer':
      return toInteger(raw) !== undefined;
    case 'decimal':
      return toDecimal(raw) !== undefined;
    case 'boolean':
      return toBoolean(raw) !== undefined;
    case 'date':
      return toIsoDate(raw) !== undefined;
    case 'email':
      return isEmail(raw);
    case 'url':
      return isUrl(raw);
    case 'enum':
      return spec.values === undefined
        ? undefined
        : spec.values.some((value) => value.toLowerCase() === clean(raw).toLowerCase());
    default:
      return undefined;
  }
}

const KIND_NOUN: Record<string, string> = {
  money: 'an amount',
  integer: 'a whole number',
  decimal: 'a number',
  boolean: 'yes or no',
  date: 'a date',
  email: 'an email address',
  url: 'a web address',
};

/**
 * Check mapped canonical rows against the entity's field specs.
 *
 * `rows` are already through the vendor adapter — this validates OUR shape, not the
 * vendor's, which is what lets one validator serve twenty vendors. A vendor-specific
 * problem ("your Shopify export has no Variant SKU column") surfaces as the canonical
 * consequence ("no product in this file has a SKU"), which is the thing the tenant can
 * actually act on.
 */
export function validateRows(entity: CanonicalEntity, rows: CanonicalRow[]): ValidationReport {
  const specs = ENTITY_FIELDS[entity];
  const specByKey = new Map(specs.map((spec) => [spec.key, spec]));
  const label = ENTITY_LABEL[entity];
  const keyFields = naturalKeyFields(entity);
  const requiredSpecs = specs.filter((spec) => spec.required === true);

  const issues: ValidationIssue[] = [];
  let errorCount = 0;
  let warningCount = 0;
  const rowsWithError = new Set<number>();

  const add = (issue: ValidationIssue): void => {
    if (issue.severity === 'error') {
      errorCount++;
      if (issue.rowIndex >= 0) rowsWithError.add(issue.rowIndex);
    } else {
      warningCount++;
    }
    if (issues.length < MAX_ISSUES) issues.push(issue);
  };

  // ── File-level: which columns are actually present anywhere ───────────────────
  const present = new Set<string>();
  for (const row of rows) {
    for (const [key, value] of Object.entries(row)) {
      if (!isBlank(value)) present.add(key);
    }
  }
  const seenColumns = new Set<string>();
  for (const row of rows) for (const key of Object.keys(row)) seenColumns.add(key);
  const unmappedColumns = [...seenColumns].filter((key) => !specByKey.has(key)).sort();

  let blocked = false;
  for (const spec of specs) {
    if (spec.required === true && !present.has(spec.key)) {
      blocked = true;
      add({
        severity: 'error',
        rowIndex: -1,
        column: spec.key,
        code: 'missing_column',
        message: `This file has no ${spec.label.toLowerCase()} for any ${label.one.toLowerCase()}.`,
        hint: `Every ${label.one.toLowerCase()} needs a ${spec.label.toLowerCase()}. Re-export with that column included, or map an existing column to it.`,
      });
    }
  }
  if (keyFields.length > 0 && !keyFields.some((spec) => present.has(spec.key))) {
    blocked = true;
    add({
      severity: 'error',
      rowIndex: -1,
      code: 'missing_natural_key',
      message: `Nothing in this file identifies each ${label.one.toLowerCase()}.`,
      hint: `Add one of: ${keyFields.map((spec) => spec.label.toLowerCase()).join(', ')}. Without it we cannot tell two ${label.many.toLowerCase()} apart, or match one you already have.`,
    });
  }

  // Ambiguous dates are reported once per column, not once per row — 8,000 identical
  // warnings is not information, it is a wall.
  const ambiguousColumns = new Set<string>();

  // ── Row-level ─────────────────────────────────────────────────────────────────
  const keyIndex = new Map<string, number[]>();

  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;

    for (const [key, rawValue] of Object.entries(row)) {
      const spec = specByKey.get(key);
      if (spec === undefined) continue;
      const raw = clean(rawValue);

      if (raw === '') {
        if (spec.required === true) {
          add({
            severity: 'error',
            rowIndex: r,
            column: key,
            code: 'required_blank',
            message: `${spec.label} is empty.`,
            hint: `A ${label.one.toLowerCase()} cannot be created without it. Fill it in, or remove the row.`,
          });
        }
        continue;
      }

      const ok = readsAs(spec, raw);
      if (ok === false) {
        // A natural-key field that cannot be read costs the row. Anything else costs
        // one value, so the row still lands and the tenant fixes the field later.
        const severity: IssueSeverity =
          spec.naturalKey === true || spec.required === true ? 'error' : 'warning';
        if (spec.kind === 'enum') {
          add({
            severity: 'warning',
            rowIndex: r,
            column: key,
            value: preview(raw),
            code: 'unknown_value',
            message: `${spec.label} says “${preview(raw)}”, which is not one of ${spec.values?.join(', ')}.`,
            hint: 'It will be imported with the closest sensible default. Change it here first if that matters.',
          });
        } else {
          add({
            severity,
            rowIndex: r,
            column: key,
            value: preview(raw),
            code: 'unreadable_value',
            message: `${spec.label} says “${preview(raw)}”, which is not ${KIND_NOUN[spec.kind] ?? 'valid'}.`,
            hint:
              severity === 'error'
                ? 'This row will be skipped until it is fixed.'
                : 'It will be left empty on the imported record.',
          });
        }
      }

      if (
        spec.kind === 'date' &&
        ok !== false &&
        isAmbiguousDate(raw) &&
        !ambiguousColumns.has(key)
      ) {
        ambiguousColumns.add(key);
        add({
          severity: 'warning',
          rowIndex: r,
          column: key,
          value: preview(raw),
          code: 'ambiguous_date',
          message: `${spec.label} is written as “${preview(raw)}”, which could mean two different days.`,
          hint: 'It will be read US-style (month first). If your export is day-first, re-export with ISO dates (2026-03-04).',
        });
      }

      if (spec.max !== undefined && raw.length > spec.max) {
        add({
          severity: 'warning',
          rowIndex: r,
          column: key,
          code: 'too_long',
          message: `${spec.label} is ${raw.length} characters; the limit is ${spec.max}.`,
          hint: 'It will be shortened to fit.',
        });
      }
    }

    // A required field can be ABSENT from a row rather than blank in it.
    //
    // The loop above walks the row's own keys, so it only ever sees the blank case —
    // and canonical rows drop empty values by construction (`row()` in the adapters),
    // which means "no title" arrives as a missing key every single time and as an
    // empty string almost never. Without this, a product with no name passes the
    // check and fails at the processor, which is the worst possible place to find out.
    for (const spec of requiredSpecs) {
      if (row[spec.key] !== undefined) continue;
      add({
        severity: 'error',
        rowIndex: r,
        column: spec.key,
        code: 'required_missing',
        message: `This ${label.one.toLowerCase()} has no ${spec.label.toLowerCase()}.`,
        hint: `A ${label.one.toLowerCase()} cannot be created without one. Fill it in, or remove the row.`,
      });
    }

    // Natural key: at least one key field must carry something.
    if (keyFields.length > 0) {
      const keyParts = keyFields.map((spec) => clean(row[spec.key])).filter((part) => part !== '');
      if (keyParts.length === 0) {
        add({
          severity: 'error',
          rowIndex: r,
          code: 'no_key',
          message: `This row has no ${keyFields.map((spec) => spec.label.toLowerCase()).join(' or ')}.`,
          hint: 'Rows without one cannot be matched or updated, so this one will be skipped.',
        });
      } else {
        const key = keyParts.join('|').toLowerCase();
        const bucket = keyIndex.get(key);
        if (bucket === undefined) keyIndex.set(key, [r]);
        else bucket.push(r);
      }
    }
  }

  // ── Duplicates within the file ────────────────────────────────────────────────
  const duplicates: DuplicateGroup[] = [];
  for (const [key, rowIndexes] of keyIndex) {
    if (rowIndexes.length < 2) continue;
    duplicates.push({ key, rows: rowIndexes });
  }
  // Products are the exception: a multi-row product is how every commerce platform
  // writes a variant matrix, so repeated handles are the format working correctly.
  if (entity !== 'products' && entity !== 'orders' && entity !== 'purchase_orders') {
    for (const group of duplicates.slice(0, 50)) {
      add({
        severity: 'warning',
        rowIndex: group.rows[1]!,
        code: 'duplicate_key',
        message: `“${group.key}” appears on ${group.rows.length} rows (${group.rows
          .slice(0, 5)
          .map((n) => n + 1)
          .join(', ')}${group.rows.length > 5 ? ', …' : ''}).`,
        hint: 'They will be merged into one record, and the last row wins where they disagree.',
      });
    }
  }

  const okCount = rows.length - rowsWithError.size;

  return {
    entity,
    rowCount: rows.length,
    okCount: blocked ? 0 : okCount,
    errorCount,
    warningCount,
    blocked,
    issues,
    truncated: errorCount + warningCount > issues.length,
    errorRows: [...rowsWithError].sort((a, b) => a - b),
    unmappedColumns,
    duplicates: duplicates.slice(0, 200),
  };
}

/** Row indexes that carry at least one error — the ones an import must skip. */
export function failingRows(report: ValidationReport): Set<number> {
  return new Set(report.errorRows);
}

/** The rows that will actually be sent, with the failures removed. */
export function importableRows(rows: CanonicalRow[], report: ValidationReport): CanonicalRow[] {
  if (report.blocked) return [];
  if (report.errorRows.length === 0) return rows;
  const failing = new Set(report.errorRows);
  return rows.filter((_, index) => !failing.has(index));
}

/** `1 customer` / `4 customers` — never `1 customers`, which reads as a bug in the
 *  product to the person reading it. */
export function countLabel(entity: CanonicalEntity, count: number): string {
  const label = ENTITY_LABEL[entity];
  const noun = (count === 1 ? label.one : label.many).toLowerCase();
  return `${count.toLocaleString()} ${noun}`;
}

/** One-line summary for a surface header. Plain language, no jargon. */
export function summarize(report: ValidationReport): string {
  if (report.blocked) {
    const problems = report.issues.filter((issue) => issue.rowIndex === -1).length;
    return `This file cannot be imported yet — ${problems} problem${problems === 1 ? '' : 's'} to fix first.`;
  }
  if (report.errorCount === 0 && report.warningCount === 0)
    return `${countLabel(report.entity, report.rowCount)} ready to import.`;
  if (report.errorCount === 0)
    return `${countLabel(report.entity, report.okCount)} ready — ${report.warningCount} thing${report.warningCount === 1 ? '' : 's'} to know about.`;
  return `${countLabel(report.entity, report.okCount)} ready — ${report.errorRows.length} row${report.errorRows.length === 1 ? '' : 's'} of ${report.rowCount.toLocaleString()} will be skipped.`;
}
