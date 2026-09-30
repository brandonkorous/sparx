// A QUOTE IS NOT MONEY SOMEBODY OWES YOU.
//
// Her console said she was owed $3,911.70 over 16 invoices. $1,512.00 of it, 39%,
// was two quotes: one still in Draft that nobody had ever seen, and one a
// customer had accepted and nobody had billed (issue 857).
//
// The cause is that `status` is PAYMENT state and nothing else. An unsent quote
// carries `unpaid` and a balance exactly like an invoice does, because the status
// machine is derived from what has been paid and knows nothing about workflows —
// `billing-ar.ts` says so in its opening paragraph. Eight queries across four
// packages asked "is this owed" as `status in (unpaid | partial | overdue)`, and
// all eight got quotes.
//
// The rule that tells a bill from an offer had existed since issue 764, with a
// guard against second copies. 764 named the four places that needed it: the
// print renderer, the preview renderer and the two consoles. The query that adds
// the money up was a fifth nobody had listed.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { describe, expect, it } from 'vitest';
import {
  B2B_QUOTE_WORKFLOW_SLUG,
  CUSTOMER_ESTIMATE_WORKFLOW_SLUG,
  isOwedDocument,
  NOT_OWED_STAGE_TYPES,
  PRICE_OFFER_WORKFLOW_SLUGS,
} from './invoicing';

/** An ordinary unpaid invoice, which every case below varies one field of. */
const INVOICE = {
  workflowSlug: 'invoice',
  stageType: 'open' as const,
  status: 'unpaid',
};

describe('isOwedDocument', () => {
  it('counts an ordinary unpaid invoice', () => {
    expect(isOwedDocument(INVOICE)).toBe(true);
  });

  it('counts a part-paid one, and an overdue one', () => {
    expect(isOwedDocument({ ...INVOICE, status: 'partial' })).toBe(true);
    expect(isOwedDocument({ ...INVOICE, status: 'overdue' })).toBe(true);
  });

  it('counts a final-stage bill, which is where the platform says "they owe it"', () => {
    expect(isOwedDocument({ ...INVOICE, stageType: 'final' })).toBe(true);
  });

  it('does not count a quote, whatever stage it has reached', () => {
    // Both of hers. Q-000016 sat in Draft; Q-000017 had been accepted, which is
    // `committed` — a commitment to buy, not a bill anybody has raised.
    for (const stageType of ['draft', 'committed', 'open', 'final'] as const) {
      expect(
        isOwedDocument({ ...INVOICE, workflowSlug: B2B_QUOTE_WORKFLOW_SLUG, stageType }),
        `quote in ${stageType}`
      ).toBe(false);
    }
  });

  it('does not count a customer estimate either', () => {
    expect(isOwedDocument({ ...INVOICE, workflowSlug: CUSTOMER_ESTIMATE_WORKFLOW_SLUG })).toBe(
      false
    );
  });

  it('does not count a bill still being drafted', () => {
    // "Nothing is promised to the customer yet." — the console's own words for
    // this stage type, on the screen where a tenant chooses one.
    expect(isOwedDocument({ ...INVOICE, stageType: 'draft' })).toBe(false);
  });

  it('does not count one that was called off', () => {
    // "it is not owed and not collectable." Also the console's own words, and
    // the reason this is not simply a question about the workflow: a canceled
    // INVOICE can carry `unpaid` and a balance.
    expect(isOwedDocument({ ...INVOICE, stageType: 'void' })).toBe(false);
  });

  it('does not count one that is settled', () => {
    expect(isOwedDocument({ ...INVOICE, status: 'paid' })).toBe(false);
    expect(isOwedDocument({ ...INVOICE, status: 'void' })).toBe(false);
  });

  it('treats a workflow the tenant invented as a bill', () => {
    // The honest default, the same one `isPriceOfferWorkflow` takes: we do not
    // know what they made, and calling their invoices "not owed" would hide
    // money rather than show too much.
    expect(isOwedDocument({ ...INVOICE, workflowSlug: 'monthly-retainer' })).toBe(true);
    expect(isOwedDocument({ ...INVOICE, workflowSlug: null })).toBe(true);
  });
});

describe('the lists the queries are built from', () => {
  it('names both system price-offer workflows', () => {
    // A query excludes them all at once, so this list and the single-slug test
    // must not drift apart.
    expect([...PRICE_OFFER_WORKFLOW_SLUGS].sort()).toEqual(
      [B2B_QUOTE_WORKFLOW_SLUG, CUSTOMER_ESTIMATE_WORKFLOW_SLUG].sort()
    );
  });

  it('names exactly the two stages that are not a demand for money', () => {
    expect([...NOT_OWED_STAGE_TYPES].sort()).toEqual(['draft', 'void']);
  });

  it('leaves committed on a bill workflow alone', () => {
    // Deliberate, and the one judgment in here worth stating: on a QUOTE
    // workflow "committed" is an accepted price and is excluded by the workflow
    // clause above. On a bill workflow a tenant built, it is theirs to mean what
    // they like, so it is not guessed at.
    expect(NOT_OWED_STAGE_TYPES).not.toContain('committed');
    expect(isOwedDocument({ ...INVOICE, stageType: 'committed' })).toBe(true);
  });
});
