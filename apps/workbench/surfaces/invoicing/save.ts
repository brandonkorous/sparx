// Saving an invoice — the part the API shape makes non-obvious.
//
// A billing document and its lines are SEPARATE writes. POST/PATCH
// /v1/invoicing/documents ignores a `lines` array entirely (see
// CreateBillingDocumentInput in packages/crm-schemas/src/invoicing.ts — there is
// no `lines` key); lines only move through
// POST/PATCH/DELETE /v1/invoicing/documents/:id/lines[/:lineId].
//
// So a save is: write the header, then reconcile the lines against what the
// server last told us it had. That reconciliation is why the editor keeps the
// loaded lines around as `original` — without them there is no way to know a
// line was DELETED, only that it is no longer on screen.
//
// Two API constraints shape the "new invoice" path specifically, and neither is
// discoverable from the UI:
//   • `workflowId` is REQUIRED — a document exists inside a workflow, and its
//     first stage is what mints the INV- number.
//   • a customer OR a B2B account is REQUIRED (a schema-level refine) — an
//     invoice with a typed-in name but no customer record is rejected.

import { api } from '../../lib/api/client';
import { isBlank, type DraftLine } from './totals';
import { normalizeDocument, type BillingDocument } from './types';

export interface DocumentWorkflow {
  id: string;
  name: string;
  archivedAt: string | null;
}

export interface InvoiceHeader {
  customerId: string | null;
  billTo: { name: string; email: string; address: string };
  taxRate: number;
  notes: string;
  currency: string;
}

export interface SaveInput {
  /** 'new', or the id of an existing document. */
  id: string;
  workflowId: string | null;
  header: InvoiceHeader;
  lines: DraftLine[];
  /** Lines exactly as the server last returned them — the delete baseline. */
  original: DraftLine[];
}

/** A problem the operator can fix, phrased for them rather than for a log. */
export class InvoiceValidationError extends Error {}

// A markup / pass-through line is priced by the server from cost + directive, so
// its body sends those and NEVER a unitPrice (the server would ignore it, and
// sending it invites the two to disagree). A manual line sends its typed price
// and an optional cost basis. Both may carry a line type, a product link, a
// discount, and a tax choice.
function lineBody(line: DraftLine): Record<string, unknown> {
  const common = {
    ...(line.lineTypeId ? { lineTypeId: line.lineTypeId } : {}),
    description: line.description.trim(),
    quantity: line.quantity,
    discountAmount: line.discountAmount,
    taxable: line.taxable,
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
  };

  if (line.markup) {
    return {
      ...common,
      ...(line.explicitCostCents != null ? { explicitCostCents: line.explicitCostCents } : {}),
      markup: line.markup,
    };
  }

  return {
    ...common,
    unitPrice: line.unitPrice,
    ...(line.explicitCostCents != null ? { explicitCostCents: line.explicitCostCents } : {}),
  };
}

function changed(line: DraftLine, previous: DraftLine): boolean {
  return (
    line.description !== previous.description ||
    line.quantity !== previous.quantity ||
    line.unitPrice !== previous.unitPrice ||
    line.discountAmount !== previous.discountAmount ||
    line.taxable !== previous.taxable ||
    (line.lineTypeId ?? null) !== (previous.lineTypeId ?? null) ||
    (line.productId ?? null) !== (previous.productId ?? null) ||
    (line.variantId ?? null) !== (previous.variantId ?? null) ||
    (line.explicitCostCents ?? null) !== (previous.explicitCostCents ?? null) ||
    // A markup directive is a fresh object each edit; re-send whenever one is
    // present (the server re-prices) rather than deep-comparing the union.
    line.markup != null
  );
}

/** Drops rows the operator started and abandoned; rejects half-filled ones. */
function usableLines(lines: DraftLine[]): DraftLine[] {
  const kept = lines.filter((line) => !isBlank(line));
  const nameless = kept.find((line) => !line.description.trim());
  if (nameless) {
    throw new InvoiceValidationError(
      'Every line needs a description — one has a price but nothing saying what it is for.'
    );
  }
  // The API requires a POSITIVE quantity (AddBillingLineInput), so a line whose
  // qty was cleared to 0 is rejected server-side. Caught here instead, because
  // the raw rejection surfaces as a schema path the operator can't act on —
  // and "0" in a quantity box is a half-finished edit, not a real intent.
  const unquantified = kept.find((line) => !(line.quantity > 0));
  if (unquantified) {
    throw new InvoiceValidationError(
      `"${unquantified.description.trim()}" needs a quantity of at least 1.`
    );
  }
  return kept;
}

function headerBody(header: InvoiceHeader) {
  return {
    customerId: header.customerId,
    currency: header.currency,
    taxRate: header.taxRate,
    billTo: header.billTo,
    notes: header.notes || null,
  };
}

export async function saveInvoice(input: SaveInput): Promise<BillingDocument> {
  const lines = usableLines(input.lines);
  const isNew = input.id === 'new';

  if (isNew && !input.header.customerId) {
    throw new InvoiceValidationError('Choose the customer this invoice is for before saving.');
  }
  if (isNew && !input.workflowId) {
    throw new InvoiceValidationError(
      'No invoice workflow is set up yet, so there is nothing to create this invoice in.'
    );
  }

  const documentId = isNew
    ? (
        await api.post<BillingDocument>('/v1/invoicing/documents', {
          workflowId: input.workflowId,
          ...headerBody(input.header),
        })
      ).id
    : (
        await api.patch<BillingDocument>(
          `/v1/invoicing/documents/${input.id}`,
          headerBody(input.header)
        )
      ).id;

  await reconcileLines(documentId, lines, isNew ? [] : input.original);

  // Re-read rather than trusting the last line write's response: the server
  // recomputes subtotal/tax/total/balance/status on every line change, and this
  // is the one call guaranteed to return all of them settled.
  return api.get<BillingDocument>(`/v1/invoicing/documents/${documentId}`).then(normalizeDocument);
}

/**
 * Line writes are sequential, not parallel. Each one makes the server recompute
 * the document's totals, and firing them concurrently means several
 * recomputations racing over the same row — the last writer wins and the totals
 * can settle on a stale set of lines.
 */
async function reconcileLines(
  documentId: string,
  lines: DraftLine[],
  original: DraftLine[]
): Promise<void> {
  const keptIds = new Set(lines.map((line) => line.id).filter(Boolean));

  for (const previous of original) {
    if (previous.id && !keptIds.has(previous.id)) {
      await api.delete(`/v1/invoicing/documents/${documentId}/lines/${previous.id}`);
    }
  }

  for (const line of lines) {
    if (!line.id) {
      await api.post(`/v1/invoicing/documents/${documentId}/lines`, lineBody(line));
      continue;
    }
    const previous = original.find((candidate) => candidate.id === line.id);
    // An untouched line is skipped entirely — resending it would burn a write
    // and a totals recomputation to arrive back where it started.
    if (previous && !changed(line, previous)) continue;
    await api.patch(`/v1/invoicing/documents/${documentId}/lines/${line.id}`, lineBody(line));
  }
}

/**
 * The workflows a new document can be created in.
 *
 * A tenant typically has several — Invoice, Service / Repair, Retail quote →
 * invoice, B2B Quotes — and they are NOT interchangeable: the workflow decides
 * the stages the document moves through and whether its first stage mints an
 * INV- number. Picking one silently (say, whichever the API lists first) means a
 * tenant whose list happens to start with "B2B Quotes" gets a quote every time
 * they click New invoice, with nothing on screen explaining why.
 *
 * So this returns all of them and the editor asks. The default is the first,
 * which is only ever a starting point, never the whole answer.
 */
export async function listDocumentWorkflows(): Promise<DocumentWorkflow[]> {
  const workflows = await api.get<DocumentWorkflow[]>('/v1/invoicing/workflows', { take: 50 });
  return workflows.filter((workflow) => !workflow.archivedAt);
}
