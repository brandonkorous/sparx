// Saving an invoice — the part the API shape makes non-obvious.
//
// A billing document and its lines are SEPARATE writes. POST/PATCH
// /v1/invoicing/documents ignores a `lines` array entirely (see
// CreateBillingDocumentInput in wizeworks/packages/crm-schemas/src/invoicing.ts — there is
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
import { documentNoun, isPriceOffer } from './document-words';
import { isBlank, type DraftLine } from './totals';
import { lineBody, lineChanged } from './line-body';
import { normalizeDocument, type BillingDocument } from './types';
import { dayMiddayUtc } from '../../lib/today';

export interface DocumentWorkflow {
  id: string;
  name: string;
  /** The stable key a caller names a workflow by when it opens the editor to
   *  make one PARTICULAR kind of document — `b2b-quotes` from the Quotes
   *  screen, say. The tenant renames the workflow freely; the slug does not
   *  move, so the door keeps working. */
  slug: string;
  archivedAt: string | null;
}

export interface InvoiceHeader {
  customerId: string | null;
  /**
   * The wholesale account billed, set when a customer is picked here: their
   * account, or null for a retail customer (issue 077). Undefined means
   * nobody picked one in this editor, and it is then left out of the save so
   * the server's own rule (a person's account follows them onto the document)
   * still applies.
   */
  companyId?: string | null;
  /** The buyer's purchase order number as typed, or '' for none (issue 077). */
  poNumber: string;
  billTo: { name: string; email: string; address: string };
  taxRate: number;
  notes: string;
  currency: string;
  /**
   * The one date on the form, `YYYY-MM-DD` as typed, or '' for none. Sent as an
   * instant, or null.
   *
   * Named for the common case. It is stored in `dueAt` on a bill and in
   * `validUntil` on a price offer, because those are two different promises: a
   * bill falls due and then counts days late, while an offer simply runs out.
   * `SaveInput.workflowSlug` is what decides. Sending the wrong one is not a cosmetic
   * mistake — the Quotes list reads `validUntil` for its "Valid until" column
   * and its Expired badge, so a quote saved into `dueAt` shows no expiry at all
   * and can never expire (issue 762).
   */
  dueAt: string;
}

export interface SaveInput {
  /** 'new', or the id of an existing document. */
  id: string;
  workflowId: string | null;
  /**
   * The slug of the workflow the document belongs to, which decides what the
   * document IS: a bill, a quote, or an estimate. It picks the date column and
   * the word every message here uses. Null on a tenant's own workflow, which
   * gets the plain invoice treatment.
   */
  workflowSlug: string | null;
  header: InvoiceHeader;
  lines: DraftLine[];
  /** Lines exactly as the server last returned them — the delete baseline. */
  original: DraftLine[];
}

/** A problem the operator can fix, phrased for them rather than for a log. */
export class InvoiceValidationError extends Error {}

export { lineMetadata } from './line-body';

/** Drops rows the operator started and abandoned; rejects half-filled ones. */
function usableLines(lines: DraftLine[]): DraftLine[] {
  const kept = lines.filter((line) => !isBlank(line));
  const nameless = kept.find((line) => !line.description.trim());
  if (nameless) {
    throw new InvoiceValidationError(
      'Every line needs a description. One has a price but nothing saying what it is for.'
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

function headerBody(header: InvoiceHeader, priceOffer: boolean) {
  // Midday UTC, not midnight: this is a DAY, and midnight lands on the day
  // before for anyone west of UTC, so the document would read as due a day
  // early for them and go late a day early with it.
  const instant = header.dueAt === '' ? null : dayMiddayUtc(header.dueAt);
  return {
    customerId: header.customerId,
    ...(header.companyId !== undefined ? { companyId: header.companyId } : {}),
    // Blank clears it; the server merges it into the document's metadata.
    poNumber: header.poNumber.trim() === '' ? null : header.poNumber.trim(),
    currency: header.currency,
    taxRate: header.taxRate,
    billTo: header.billTo,
    notes: header.notes || null,
    // BOTH keys go every time, and only one of them carries the date. The other
    // is explicitly null, so switching a document's kind cannot leave a stale
    // date behind in the column its new kind does not read.
    dueAt: priceOffer ? null : instant,
    validUntil: priceOffer ? instant : null,
  };
}

export async function saveInvoice(input: SaveInput): Promise<BillingDocument> {
  const lines = usableLines(input.lines);
  const isNew = input.id === 'new';
  const priceOffer = isPriceOffer(input.workflowSlug);
  // What to call it in a message she reads. Telling someone pricing a quote to
  // "choose the customer this invoice is for" names a screen she is not on.
  const noun = documentNoun(input.workflowSlug);

  if (isNew && !input.header.customerId) {
    throw new InvoiceValidationError(`Choose the customer this ${noun} is for before saving.`);
  }
  if (isNew && !input.workflowId) {
    throw new InvoiceValidationError(
      `No ${noun} workflow is set up yet, so there is nothing to create this ${noun} in.`
    );
  }

  const documentId = isNew
    ? (
        await api.post<BillingDocument>('/v1/invoicing/documents', {
          workflowId: input.workflowId,
          ...headerBody(input.header, priceOffer),
        })
      ).id
    : (
        await api.patch<BillingDocument>(
          `/v1/invoicing/documents/${input.id}`,
          headerBody(input.header, priceOffer)
        )
      ).id;

  await reconcileLines(documentId, lines, isNew ? [] : input.original);

  // Re-read rather than trusting the last line write's response: the server
  // recomputes subtotal/tax/total/balance/status on every line change, and this
  // is the one call guaranteed to return all of them settled.
  return api.get<BillingDocument>(`/v1/invoicing/documents/${documentId}`).then(normalizeDocument);
}

/** Line writes are sequential: each makes the server recompute the document's
 *  totals, and concurrent ones race, leaving totals from a stale set of lines. */
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
    if (previous && !lineChanged(line, previous)) continue;
    await api.patch(`/v1/invoicing/documents/${documentId}/lines/${line.id}`, lineBody(line));
  }
}

/** Every workflow a new document can be made in. They are not interchangeable
 *  (each decides the stages and whether an INV- number is minted), so the editor
 *  asks rather than silently taking the first. */
export async function listDocumentWorkflows(): Promise<DocumentWorkflow[]> {
  const workflows = await api.get<DocumentWorkflow[]>('/v1/invoicing/workflows', { take: 50 });
  return workflows.filter((workflow) => !workflow.archivedAt);
}
