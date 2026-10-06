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
import { withPriceNote, withProductLabel } from './line-price-note';
import { lineCostCents } from './line-margin';
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
  /**
   * The one date on the form, `YYYY-MM-DD` as typed, or '' for none. Sent as an
   * instant, or null.
   *
   * Named for the common case. It is stored in `dueAt` on a bill and in
   * `validUntil` on a price offer, because those are two different promises: a
   * bill falls due and then counts days late, while an offer simply runs out.
   * `SaveInput.workflowSlug` is what decides. Sending the wrong one is not a
   * cosmetic mistake — the Quotes list reads `validUntil` for its "Valid until"
   * column and its Expired badge, so a quote saved into `dueAt` shows no expiry
   * at all and can never expire (issue 762).
   */
  dueAt: string;
  currency: string;
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

// A markup / pass-through line is priced by the server from cost + directive, so
// its body sends those and NEVER a unitPrice (the server would ignore it, and
// sending it invites the two to disagree). A manual line sends its typed price
// and its cost (null when it has none). Both may carry a line type, a product link, a
// discount, and a tax choice.
/** The line's stored bag after this save, or nothing to send. The product
 *  name goes with the product: a line no longer linked to one keeps no name
 *  (sparx persona issue 085). */
export function lineMetadata(line: DraftLine): { metadata?: Record<string, unknown> } {
  if (line.priceNote === undefined && line.productLabel === undefined) return {};
  let metadata: Record<string, unknown> = { ...(line.metadata ?? {}) };
  if (line.priceNote !== undefined) metadata = withPriceNote(metadata, line.priceNote);
  if (line.productLabel !== undefined) {
    metadata = withProductLabel(metadata, line.productId ? line.productLabel : null);
  }
  return { metadata };
}

export function lineBody(line: DraftLine): Record<string, unknown> {
  const common = {
    ...(line.lineTypeId ? { lineTypeId: line.lineTypeId } : {}),
    description: line.description.trim(),
    quantity: line.quantity,
    discountAmount: line.discountAmount,
    taxable: line.taxable,
    productId: line.productId ?? null,
    variantId: line.variantId ?? null,
    // Sent only when said: left out, the server takes the part's own deposit.
    ...(line.coreCharge !== undefined ? { coreCharge: line.coreCharge } : {}),
    // Where the price came from, and which product the line draws from, merged
    // into the line's stored bag. Left out when neither was said, so a save
    // never wipes what it did not read.
    ...lineMetadata(line),
  };

  if (line.markup) {
    return {
      ...common,
      ...(line.explicitCostCents != null ? { explicitCostCents: line.explicitCostCents } : {}),
      markup: line.markup,
    };
  }

  // A line priced by hand sends its cost every time, and null when it was
  // cleared: the cost is what its margin is worked out from, and the server
  // keeps what it was last told (sparx persona issue 086).
  return {
    ...common,
    unitPrice: line.unitPrice,
    explicitCostCents: lineCostCents(line),
  };
}

export function lineChanged(line: DraftLine, previous: DraftLine): boolean {
  return (
    line.description !== previous.description ||
    line.quantity !== previous.quantity ||
    line.unitPrice !== previous.unitPrice ||
    line.discountAmount !== previous.discountAmount ||
    line.taxable !== previous.taxable ||
    (line.lineTypeId ?? null) !== (previous.lineTypeId ?? null) ||
    (line.productId ?? null) !== (previous.productId ?? null) ||
    (line.variantId ?? null) !== (previous.variantId ?? null) ||
    // The cost in effect, typed or stored: comparing only the typed one missed
    // a cost cleared on a reopened line (sparx persona issue 086).
    lineCostCents(line) !== lineCostCents(previous) ||
    (line.coreCharge ?? null) !== (previous.coreCharge ?? null) ||
    (line.priceNote ?? null) !== (previous.priceNote ?? null) ||
    (line.productLabel ?? null) !== (previous.productLabel ?? null) ||
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
    if (previous && !lineChanged(line, previous)) continue;
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
