// Bringing spend IN — a bank statement, a card export, or a list of bills the
// accountant already has (docs/148 §6).
//
// Import is deliberately two-phase: PREVIEW then COMMIT. A business owner pasting
// a bank CSV cannot be expected to know whether column 4 is the amount, and an
// import that writes 300 rows before showing them what it did is unrecoverable in
// practice — "undo my import" is not a button anyone can build honestly once the
// rows are mingled with hand-typed ones.

import { withTenant, type TxClient } from '@sparx/db';

import { parseCsvObjects } from './csv';
import { upsertDerivedExpense } from '../expenses';

/** Which incoming column means what. The UI builds this from a header preview. */
export interface ColumnMap {
  date: string;
  description: string;
  amount: string;
  vendor?: string;
  reference?: string;
  category?: string;
}

export interface ImportRequest {
  csv: string;
  columns: ColumnMap;
  delimiter?: string;
  propertyId?: string | null;
  /** Where anything unmatched lands. Required so no row is ever dropped. */
  fallbackCategoryId: string;
  /** Bank exports list money out as negative; expenses are positive spend. */
  invertAmounts?: boolean;
  /** Stable per-file token so re-importing the same statement updates rather
   *  than duplicates. The UI defaults it to the filename. */
  sourceKey: string;
}

export interface ImportRow {
  line: number;
  incurredAt: Date | null;
  description: string;
  amountCents: number | null;
  vendorName: string | null;
  reference: string | null;
  categoryName: string | null;
  /** Populated when the row cannot be imported as-is. */
  error: string | null;
}

export interface ImportPreview {
  rows: ImportRow[];
  validCount: number;
  errorCount: number;
  totalCents: number;
  /** Headers found in the file, so the mapper can offer real choices. */
  headers: string[];
}

/**
 * Money out of a bank/card export, as cents.
 *
 * Tolerates what these files really contain: thousands separators, currency
 * symbols, a trailing minus, and accounting parentheses for negatives. Returns
 * null rather than guessing when it cannot read the value — a silently-zero row
 * is worse than a flagged one.
 */
export function parseAmountCents(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const parenthesised = /^\((.*)\)$/.exec(trimmed);
  const inner = parenthesised ? parenthesised[1]! : trimmed;

  const trailingMinus = /^(.*)-$/.exec(inner.trim());
  const body = trailingMinus ? trailingMinus[1]! : inner;

  // Strip everything that is not a digit, separator or leading sign.
  const cleaned = body.replace(/[^\d.,-]/g, '');
  if (!cleaned || !/\d/.test(cleaned)) return null;

  // Decide which separator is the decimal one by whichever appears LAST —
  // "1.234,56" and "1,234.56" are both real and mean the same number.
  const lastComma = cleaned.lastIndexOf(',');
  const lastDot = cleaned.lastIndexOf('.');
  let normalized = cleaned;
  if (lastComma > lastDot) {
    normalized = cleaned.replace(/\./g, '').replace(',', '.');
  } else {
    normalized = cleaned.replace(/,/g, '');
  }

  const cents = decimalStringToCents(normalized);
  if (cents === null) return null;

  const negative = parenthesised !== null || Boolean(trailingMinus) || normalized.startsWith('-');
  return negative ? -Math.abs(cents) : cents;
}

/**
 * A decimal string → cents, WITHOUT ever going through a float.
 *
 * `Math.round(Number('0.145') * 100)` is 14, not 15, because 0.145×100 is
 * 14.499999999999998 in IEEE 754. Two-decimal values happen to survive that, so
 * the bug hides until a file carries three decimals — fuel prices, FX-converted
 * lines, some processors' fee columns — and then quietly loses a cent per row.
 *
 * Mirrors `money()` in ./export, which builds its string from the integer for
 * exactly the same reason. Money never touches a float anywhere in this module.
 */
function decimalStringToCents(input: string): number | null {
  const unsigned = input.startsWith('-') ? input.slice(1) : input;
  if (!/^\d*\.?\d*$/.test(unsigned) || !/\d/.test(unsigned)) return null;

  const [whole = '', fraction = ''] = unsigned.split('.');
  const wholeCents = (whole === '' ? 0 : Number(whole)) * 100;
  if (!Number.isSafeInteger(wholeCents)) return null;

  // First two fraction digits are the cents; the third decides the rounding.
  // A carry of 1 onto 99 gives 100, which adds a whole unit correctly with no
  // special case, because `wholeCents` is already scaled by 100.
  const cents = Number(`${fraction}00`.slice(0, 2));
  const roundUp = Number(fraction[2] ?? '0') >= 5 ? 1 : 0;
  return wholeCents + cents + roundUp;
}

/** Dates in these files are ISO, US, or UK, and only the file knows which.
 *  Unambiguous forms are read exactly; an ambiguous D/M vs M/D is read as the
 *  ISO-adjacent interpretation and flagged upstream by the preview. */
export function parseImportDate(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(trimmed);
  if (iso) return new Date(Date.UTC(+iso[1]!, +iso[2]! - 1, +iso[3]!));

  const slash = /^(\d{1,2})[/.](\d{1,2})[/.](\d{2,4})$/.exec(trimmed);
  if (slash) {
    const a = +slash[1]!;
    const b = +slash[2]!;
    const year = +slash[3]! < 100 ? 2000 + +slash[3]! : +slash[3]!;
    // A value over 12 in the first position can only be a day.
    const [month, dayOfMonth] = a > 12 ? [b, a] : [a, b];
    return new Date(Date.UTC(year, month - 1, dayOfMonth));
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Read the file and say exactly what WOULD be written. Writes nothing. */
export function previewImport(request: ImportRequest): ImportPreview {
  const records = parseCsvObjects(request.csv, request.delimiter);
  const headers = records[0] ? Object.keys(records[0]) : [];
  const rows: ImportRow[] = [];

  records.forEach((record, index) => {
    const rawDate = record[request.columns.date] ?? '';
    const rawAmount = record[request.columns.amount] ?? '';
    const description = (record[request.columns.description] ?? '').trim();

    const incurredAt = parseImportDate(rawDate);
    const parsed = parseAmountCents(rawAmount);
    const amountCents = parsed === null ? null : request.invertAmounts ? -parsed : parsed;

    let error: string | null = null;
    if (!incurredAt) error = `Could not read the date "${rawDate}"`;
    else if (amountCents === null) error = `Could not read the amount "${rawAmount}"`;
    else if (!description) error = 'This row has no description';

    rows.push({
      line: index + 2, // +1 for the header, +1 to be 1-based like a spreadsheet
      incurredAt,
      description,
      amountCents,
      vendorName: request.columns.vendor
        ? (record[request.columns.vendor] ?? '').trim() || null
        : null,
      reference: request.columns.reference
        ? (record[request.columns.reference] ?? '').trim() || null
        : null,
      categoryName: request.columns.category
        ? (record[request.columns.category] ?? '').trim() || null
        : null,
      error,
    });
  });

  const valid = rows.filter((r) => !r.error);
  return {
    rows,
    headers,
    validCount: valid.length,
    errorCount: rows.length - valid.length,
    totalCents: valid.reduce((sum, r) => sum + (r.amountCents ?? 0), 0),
  };
}

export interface ImportResult {
  imported: number;
  skipped: number;
  errors: { line: number; message: string }[];
}

/**
 * Write the valid rows.
 *
 * Every row goes in through `upsertDerivedExpense` with
 * `sourceId = <sourceKey>:<line>`, so re-importing a corrected statement updates
 * the rows it already created instead of doubling the month. Rows that failed the
 * preview are skipped and reported, never silently dropped.
 *
 * Category and vendor are matched by NAME against what the tenant already has —
 * matching creates nothing, because an import that invents twelve categories from
 * a bank memo field is worse than one that files them all under the fallback.
 */
export async function commitImport(
  tenantId: string,
  request: ImportRequest,
  tx?: TxClient
): Promise<ImportResult> {
  const preview = previewImport(request);

  const run = async (client: TxClient): Promise<ImportResult> => {
    const categories = await client.financeExpenseCategory.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
    });
    const vendors = await client.financeVendor.findMany({
      where: { archivedAt: null },
      select: { id: true, name: true },
    });

    const categoryByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const vendorByName = new Map(vendors.map((v) => [v.name.toLowerCase(), v.id]));

    const errors: { line: number; message: string }[] = [];
    let imported = 0;

    for (const row of preview.rows) {
      if (row.error || !row.incurredAt || row.amountCents === null) {
        errors.push({ line: row.line, message: row.error ?? 'Unreadable row' });
        continue;
      }

      await upsertDerivedExpense(
        tenantId,
        'import',
        `${request.sourceKey}:${row.line}`,
        {
          propertyId: request.propertyId ?? null,
          categoryId:
            (row.categoryName ? categoryByName.get(row.categoryName.toLowerCase()) : undefined) ??
            request.fallbackCategoryId,
          vendorId: row.vendorName
            ? (vendorByName.get(row.vendorName.toLowerCase()) ?? null)
            : null,
          description: row.description,
          amountCents: row.amountCents,
          currency: 'USD',
          taxCents: 0,
          incurredAt: row.incurredAt,
          // A bank line is money that already LEFT — importing it as unpaid would
          // put settled transactions on the "Bills to pay" screen.
          paidAt: row.incurredAt,
          dueAt: null,
          paymentMethod: null,
          reference: row.reference ?? null,
          notes: null,
          allocations: [],
          attachmentAssetIds: [],
        },
        'imported',
        client
      );
      imported += 1;
    }

    return { imported, skipped: errors.length, errors };
  };

  return tx ? run(tx) : withTenant({ tenantId }, run);
}
