// What the preview pane is shown while the editor is open.
//
// The preview renders from THIS PAYLOAD ALONE. It is not a patch over the saved
// document and the renderer never re-reads the database, so any field left out
// here is not "unchanged" — it is ABSENT, and the renderer fills it with its own
// default. The default is silence: no ship-to block, no delivery row, no
// deposit, and today's date where the issue date belongs.
//
// That has now happened twice, which is why this is a function with a test
// rather than an object literal inside a `useEffect`:
//
//   764  the payload carried only the TYPED fields, so every preview fell
//        through to a numberless "Invoice" marked Unpaid with a balance due,
//        over a paid invoice and over a quote nobody had agreed to.
//   775  the four identity fields 764 added were the only ones added. Opening
//        INV-000009 showed a preview reading Total $42.00 against a document of
//        $51.00 — short by exactly the delivery charge — with the ship-to block
//        gone and Sep 22 printed on an invoice raised Sep 8.
//
// The split is the rule: a field the person is TYPING comes from `draft`, and a
// field the DOCUMENT already holds comes from `doc`. Nothing comes from neither.
// [[feedback_fetched_but_never_rendered]]

import type { DraftLine } from './totals';
import type { BillingDocument } from './types';

/** The header fields this editor actually edits. */
export interface DraftShape {
  customerId: string | null;
  billTo: { name: string; email: string; address: string };
  taxRate: number;
  notes: string;
  /** The one date on the form, `YYYY-MM-DD`, or '' for none. Stored as the due
   *  date on a bill and as the expiry on a quote or estimate — see `./save`. */
  dueAt: string;
  lines: DraftLine[];
}

export const EMPTY_DRAFT: DraftShape = {
  customerId: null,
  billTo: { name: '', email: '', address: '' },
  taxRate: 0,
  notes: '',
  dueAt: '',
  // No starter row: lines are added through the modal, so a fresh invoice shows
  // the empty state + Add button rather than a stray blank line.
  lines: [],
};

export interface PreviewDraftInput {
  /** What is being typed right now. */
  draft: DraftShape;
  /** What is on file, or undefined while it loads and on a brand new document. */
  doc: BillingDocument | undefined;
  currency: string;
  workflowSlug: string | null;
  /** True for a quote or an estimate: it offers a price rather than demanding
   *  money, so its one date means "this runs out" and lives in `validUntil`. */
  priceOffer: boolean;
}

/**
 * Everything the print renderer needs, drawn from the two places it can come
 * from.
 *
 * `issuedAt` is deliberately null on a document that has no date of its own, so
 * the renderer's own "preview a new draft as issued today" fallback still
 * fires rather than the date block collapsing to an empty row mid-edit.
 */
export function previewDraft({
  draft,
  doc,
  currency,
  workflowSlug,
  priceOffer,
}: PreviewDraftInput): Record<string, unknown> {
  const dated = draft.dueAt === '' ? null : draft.dueAt;
  return {
    // Being typed.
    ...draft,
    dueAt: priceOffer ? null : dated,
    validUntil: priceOffer ? dated : null,
    currency,
    workflowSlug,
    // On file.
    stageId: doc?.stageId ?? null,
    number: doc?.number ?? null,
    status: doc?.status ?? null,
    amountPaid: doc?.amountPaid ?? 0,
    shipTo: doc?.shipTo ?? null,
    shippingTotal: doc?.shippingTotal ?? 0,
    surchargeTotal: doc?.surchargeTotal ?? 0,
    depositTotal: doc?.depositTotal ?? 0,
    issuedAt: doc?.finalizedAt ?? doc?.createdAt ?? null,
  };
}
