// The preview must show the document, not a version of it.
//
// The pane renders from the published payload alone, so a field missing here is
// a field the renderer defaults — silently, and in the customer's favour or
// against it depending on which one. Issues 764 and 775 were both this, and the
// second happened because the first fixed four fields and stopped.
//
// The list in `CARRIED_FROM_THE_DOCUMENT` is the contract. Adding a field the
// print renderer reads means adding it there too.

import { describe, expect, it } from 'vitest';
import { EMPTY_DRAFT, previewDraft, type DraftShape } from './preview-draft';
import type { BillingDocument } from './types';

/** Every field the print renderer reads that the person is NOT typing. */
const CARRIED_FROM_THE_DOCUMENT = [
  'stageId',
  'number',
  'status',
  'amountPaid',
  'shipTo',
  'shippingTotal',
  'surchargeTotal',
  'depositTotal',
  'issuedAt',
] as const;

/** Every field the person IS typing, which must survive the merge. */
const TYPED = ['customerId', 'billTo', 'taxRate', 'notes', 'lines'] as const;

const typed: DraftShape = {
  ...EMPTY_DRAFT,
  customerId: 'cus_1',
  billTo: { name: 'Rowan Ellery', email: 'rowan@example.com', address: '18 Larkspur Lane' },
  taxRate: 0,
  notes: 'For order O-000006.',
  dueAt: '2026-09-08',
};

function onFile(overrides: Partial<BillingDocument> = {}): BillingDocument {
  return {
    id: 'doc_1',
    number: 'INV-000009',
    currency: 'USD',
    customerId: 'cus_1',
    billTo: null,
    shipTo: { name: 'Rowan Ellery', lines: ['18 Larkspur Lane'] },
    taxRate: 0,
    notes: null,
    subtotal: 42,
    taxTotal: 0,
    shippingTotal: 9,
    surchargeTotal: 0,
    depositTotal: 0,
    finalizedAt: null,
    total: 51,
    balance: 51,
    amountPaid: 0,
    status: 'unpaid',
    dueAt: '2026-09-08T12:00:00.000Z',
    validUntil: null,
    overdueDays: 0,
    workflowId: 'wf_1',
    stageId: 'stage_1',
    createdAt: '2026-09-08T03:02:06.744Z',
    ...overrides,
  } as BillingDocument;
}

const base = { currency: 'USD', workflowSlug: 'invoice', priceOffer: false };

describe('previewDraft', () => {
  it('carries every fact the renderer would otherwise default', () => {
    const payload = previewDraft({ ...base, draft: typed, doc: onFile() });

    for (const field of CARRIED_FROM_THE_DOCUMENT) {
      expect(
        payload,
        `the preview drops "${field}", so it draws a different document`
      ).toHaveProperty(field);
    }
    for (const field of TYPED) {
      expect(payload, `the preview drops what is being typed into "${field}"`).toHaveProperty(
        field
      );
    }
  });

  it('shows the delivery charge the document carries', () => {
    // INV-000009: $42 of lines, $9 of delivery, $51 on the document. The preview
    // read $42 and said Balance due under it.
    const payload = previewDraft({ ...base, draft: typed, doc: onFile() });

    expect(payload.shippingTotal).toBe(9);
    expect(payload.surchargeTotal).toBe(0);
  });

  it('subtracts a deposit the same way the printed copy does', () => {
    const payload = previewDraft({ ...base, draft: typed, doc: onFile({ depositTotal: 30 }) });

    expect(payload.depositTotal).toBe(30);
  });

  it('keeps the ship-to block the document has', () => {
    const payload = previewDraft({ ...base, draft: typed, doc: onFile() });

    expect(payload.shipTo).toEqual({ name: 'Rowan Ellery', lines: ['18 Larkspur Lane'] });
  });

  it('dates the document when it was raised, not today', () => {
    expect(previewDraft({ ...base, draft: typed, doc: onFile() }).issuedAt).toBe(
      '2026-09-08T03:02:06.744Z'
    );
    expect(
      previewDraft({
        ...base,
        draft: typed,
        doc: onFile({ finalizedAt: '2026-09-10T00:00:00.000Z' }),
      }).issuedAt
    ).toBe('2026-09-10T00:00:00.000Z');
  });

  it('leaves the issue date open on a document that has none', () => {
    // The renderer's own fallback stamps today, so the date block renders rather
    // than collapsing to an empty row while a new invoice is being typed.
    expect(previewDraft({ ...base, draft: typed, doc: undefined }).issuedAt).toBeNull();
  });

  it('puts the one date where the kind of document keeps it', () => {
    const bill = previewDraft({ ...base, draft: typed, doc: onFile() });
    expect(bill.dueAt).toBe('2026-09-08');
    expect(bill.validUntil).toBeNull();

    const offer = previewDraft({
      ...base,
      workflowSlug: 'quote',
      priceOffer: true,
      draft: typed,
      doc: onFile(),
    });
    expect(offer.dueAt).toBeNull();
    expect(offer.validUntil).toBe('2026-09-08');
  });

  it('sends no date at all when the box is empty', () => {
    const payload = previewDraft({
      ...base,
      draft: { ...typed, dueAt: '' },
      doc: onFile(),
    });

    expect(payload.dueAt).toBeNull();
    expect(payload.validUntil).toBeNull();
  });

  it('lets what is being typed win over what is on file', () => {
    // The whole point of a live preview: the notes box beats the saved note.
    const payload = previewDraft({
      ...base,
      draft: { ...typed, notes: 'Thanks for the order.' },
      doc: onFile({ notes: 'For order O-000006.' }),
    });

    expect(payload.notes).toBe('Thanks for the order.');
  });
});
