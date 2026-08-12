// Building the file the accountant actually imports (docs/148 §6).
//
// This is the deliverable, not a nicety: sparx does not keep the books, so the
// handoff IS the product. "We integrate with QuickBooks" usually turns out to
// mean a CSV with the wrong column order, and an export nobody can import is the
// same as no export.
//
// Each provider gets its own column layout because they genuinely differ —
// QuickBooks wants an account NAME, Xero wants a code, Sage 50 wants both — and a
// single "generic" layout would be wrong for all three in different ways.

import { withTenant } from '@sparx/db';

import { toCsv } from './csv';
import type { AccountingProvider } from '../schemas';
import { utcMidnight } from '../rollup';

export interface ExportRequest {
  from: Date;
  to: Date;
  propertyId?: string | null;
  /** Never emit anything dated before the tenant's books-closed date. */
  syncFromDate?: Date | null;
  /** sparx category id → the account name/code on the other side. */
  mappings?: Map<string, { externalName?: string | null; externalCode?: string | null }>;
}

export interface ExportResult {
  filename: string;
  contentType: string;
  body: string;
  rowCount: number;
  /** Expenses deliberately left out, and why — surfaced rather than silently
   *  dropped, because a missing row in an accounting export is a real problem. */
  skipped: { id: string; reason: string }[];
}

/** `YYYY-MM-DD`. Deliberately ISO everywhere: every one of these systems accepts
 *  it, and locale-formatted dates are the classic way a US export lands in a UK
 *  ledger three months off. */
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Cents → the decimal string an accounting package expects. Built by hand from
 *  the integer rather than dividing into a float, so 1_234_567 cannot round. */
function money(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

interface ExportRow {
  id: string;
  incurredAt: Date;
  paidAt: Date | null;
  dueAt: Date | null;
  description: string;
  amountCents: number;
  taxCents: number;
  currency: string;
  reference: string | null;
  categoryId: string;
  categoryName: string;
  exportCode: string | null;
  vendorName: string | null;
  paymentMethod: string | null;
}

/** Column layouts, one per destination. */
const LAYOUTS: Record<
  AccountingProvider,
  { headers: readonly string[]; row: (r: ExportRow, account: string) => (string | number)[] }
> = {
  // QuickBooks Online's bill/expense import keys on the vendor and an account NAME.
  quickbooks_online: {
    headers: ['Date', 'Vendor', 'Account', 'Description', 'Amount', 'Tax', 'Currency', 'Ref No'],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.vendorName ?? '',
      account,
      r.description,
      money(r.amountCents),
      money(r.taxCents),
      r.currency,
      r.reference ?? '',
    ],
  },
  // Desktop's IIF-adjacent CSV. Same fields, its own header spelling.
  quickbooks_desktop: {
    headers: ['DATE', 'NAME', 'ACCNT', 'MEMO', 'AMOUNT', 'DOCNUM'],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.vendorName ?? '',
      account,
      r.description,
      money(r.amountCents),
      r.reference ?? '',
    ],
  },
  // Xero's bill import wants an account CODE and splits due date out.
  xero: {
    headers: [
      '*ContactName',
      '*InvoiceNumber',
      '*InvoiceDate',
      '*DueDate',
      'Description',
      '*Quantity',
      '*UnitAmount',
      '*AccountCode',
      'Currency',
    ],
    row: (r, account) => [
      r.vendorName ?? 'Unknown vendor',
      r.reference ?? r.id.slice(0, 8),
      isoDate(r.incurredAt),
      isoDate(r.dueAt ?? r.incurredAt),
      r.description,
      1,
      money(r.amountCents),
      account,
      r.currency,
    ],
  },
  // Sage 50 wants both the code and a human account name.
  sage50: {
    headers: [
      'Date',
      'Reference',
      'Vendor',
      'Account Code',
      'Account Name',
      'Description',
      'Net',
      'Tax',
    ],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.reference ?? '',
      r.vendorName ?? '',
      account,
      r.categoryName,
      r.description,
      money(r.amountCents),
      money(r.taxCents),
    ],
  },
  freshbooks: {
    headers: ['Date', 'Vendor', 'Category', 'Description', 'Amount', 'Currency', 'Notes'],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.vendorName ?? '',
      account,
      r.description,
      money(r.amountCents),
      r.currency,
      r.reference ?? '',
    ],
  },
  wave: {
    headers: ['Date', 'Description', 'Amount', 'Account', 'Vendor', 'Notes'],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.description,
      money(r.amountCents),
      account,
      r.vendorName ?? '',
      r.reference ?? '',
    ],
  },
  // The honest generic: everything we know, named in the platform's own words.
  // Also what a spreadsheet-keeping owner actually wants.
  csv: {
    headers: [
      'Date',
      'Paid on',
      'Due',
      'Vendor',
      'Category',
      'Account',
      'Description',
      'Amount',
      'Tax',
      'Currency',
      'Payment method',
      'Reference',
    ],
    row: (r, account) => [
      isoDate(r.incurredAt),
      r.paidAt ? isoDate(r.paidAt) : '',
      r.dueAt ? isoDate(r.dueAt) : '',
      r.vendorName ?? '',
      r.categoryName,
      account,
      r.description,
      money(r.amountCents),
      money(r.taxCents),
      r.currency,
      r.paymentMethod ?? '',
      r.reference ?? '',
    ],
  },
};

/**
 * The account this expense posts to on the other side: the per-connection mapping
 * first, then the category's own `exportCode`, then its name.
 *
 * The name fallback is deliberate — an unmapped category still exports something
 * a human can recognise and re-file, which beats a blank column or a hard failure
 * on the one row nobody had mapped yet.
 */
export function accountFor(row: ExportRow, mappings?: ExportRequest['mappings']): string {
  const mapped = mappings?.get(row.categoryId);
  // Deliberately falls through on EMPTY, not just null: a mapping row saved with a
  // blank code is the same as no mapping, and `??` would happily export "".
  return firstNonBlank(
    mapped?.externalCode,
    mapped?.externalName,
    row.exportCode,
    row.categoryName
  );
}

function firstNonBlank(...values: (string | null | undefined)[]): string {
  for (const value of values) {
    if (value !== null && value !== undefined && value.trim() !== '') return value;
  }
  return '';
}

export async function buildExport(
  tenantId: string,
  provider: AccountingProvider,
  request: ExportRequest
): Promise<ExportResult> {
  const layout = LAYOUTS[provider];

  const expenses = await withTenant({ tenantId }, (tx) =>
    tx.financeExpense.findMany({
      where: {
        deletedAt: null,
        incurredAt: { gte: utcMidnight(request.from), lte: utcMidnight(request.to) },
        ...(request.propertyId !== undefined && request.propertyId !== null
          ? { propertyId: request.propertyId }
          : {}),
      },
      include: { category: true, vendor: true },
      orderBy: [{ incurredAt: 'asc' }, { id: 'asc' }],
    })
  );

  const skipped: { id: string; reason: string }[] = [];
  const rows: (string | number)[][] = [];

  for (const expense of expenses) {
    // Never write into a closed period. Pushing entries into a month the
    // accountant has signed off is the fastest way to lose their trust for good.
    if (request.syncFromDate && expense.incurredAt < request.syncFromDate) {
      skipped.push({
        id: expense.id,
        reason: `Dated before your books-closed date (${isoDate(request.syncFromDate)})`,
      });
      continue;
    }

    const row: ExportRow = {
      id: expense.id,
      incurredAt: expense.incurredAt,
      paidAt: expense.paidAt,
      dueAt: expense.dueAt,
      description: expense.description,
      amountCents: expense.amountCents,
      taxCents: expense.taxCents,
      currency: expense.currency,
      reference: expense.reference,
      categoryId: expense.categoryId,
      categoryName: expense.category.name,
      exportCode: expense.category.exportCode,
      vendorName: expense.vendor?.name ?? null,
      paymentMethod: expense.paymentMethod,
    };

    rows.push(layout.row(row, accountFor(row, request.mappings)));
  }

  return {
    filename: `sparx-expenses-${provider}-${isoDate(request.from)}-to-${isoDate(request.to)}.csv`,
    contentType: 'text/csv; charset=utf-8',
    body: toCsv(layout.headers, rows),
    rowCount: rows.length,
    skipped,
  };
}

/** The columns a given provider's file will have — so the UI can show the shape
 *  BEFORE someone downloads it and discovers it is wrong in their accountant's
 *  inbox. */
export function exportColumns(provider: AccountingProvider): readonly string[] {
  return LAYOUTS[provider].headers;
}
