// Issue 084: the wholesale account pages showed the buyer the platform's codes
// ("buyer · NET30", "partial") and priced a quote the shop had not priced yet.

import { describe, expect, it } from 'vitest';

import {
  accountStatusTone,
  accountStatusWords,
  contactRoleWords,
  coreDepositSentence,
  invoiceStatusTone,
  invoiceStatusWords,
  paymentTermsWords,
  pricedQuote,
  quantityWords,
  quoteStageView,
  quoteSummaryRows,
  type QuoteStageInput,
} from './trade-account-words';

function stage(patch: Partial<QuoteStageInput>): QuoteStageInput {
  return {
    stageName: 'Submitted',
    stageType: 'draft',
    totalCents: 0,
    shopName: 'Gillett Diesel Service',
    canWrite: true,
    validUntil: null,
    ...patch,
  };
}

describe('contact role words', () => {
  it('names every documented role as a word', () => {
    expect(contactRoleWords('primary_contact')).toBe('Primary contact');
    expect(contactRoleWords('buyer')).toBe('Buyer');
    expect(contactRoleWords('approver')).toBe('Approver');
    expect(contactRoleWords('viewer')).toBe('Viewer');
  });

  it('never prints an underscore for a role it does not know', () => {
    expect(contactRoleWords('purchasing_lead')).toBe('Purchasing lead');
  });
});

describe('payment terms words', () => {
  it('says when the account pays, in days', () => {
    expect(paymentTermsWords('net30')).toBe('Pay within 30 days');
    expect(paymentTermsWords('net15')).toBe('Pay within 15 days');
    expect(paymentTermsWords('net1')).toBe('Pay within 1 day');
  });

  it('says a prepay account pays before it ships', () => {
    expect(paymentTermsWords('prepay')).toBe('Pay before it ships');
  });

  it('prints nothing rather than a code it cannot read', () => {
    expect(paymentTermsWords(null)).toBeNull();
    expect(paymentTermsWords('cod')).toBeNull();
  });
});

describe('account status', () => {
  it('reads and colors each status', () => {
    expect(accountStatusWords('credit_hold')).toBe('Credit hold');
    expect(accountStatusTone('credit_hold')).toBe('warning');
    expect(accountStatusTone('suspended')).toBe('danger');
    expect(accountStatusTone('active')).toBe('success');
  });

  it('gives inactive no color, never a grey one', () => {
    expect(accountStatusTone('inactive')).toBeUndefined();
  });
});

describe('invoice status', () => {
  it('says partial as a buyer would', () => {
    expect(invoiceStatusWords('partial')).toBe('Partly paid');
    expect(invoiceStatusWords('void')).toBe('Canceled');
  });

  it('colors what she owes and what she paid differently', () => {
    expect(invoiceStatusTone('paid')).toBe('success');
    expect(invoiceStatusTone('overdue')).toBe('danger');
    expect(invoiceStatusTone('partial')).toBe('warning');
  });
});

describe('quote stage view', () => {
  it('tells her the shop is still working on a draft, by name', () => {
    const view = quoteStageView(stage({ stageName: 'Draft' }));
    expect(view.note).toBe('Gillett Diesel Service is still working on this quote.');
    expect(view.priced).toBe(false);
  });

  it('falls back to "The shop" when the shop is not known', () => {
    expect(quoteStageView(stage({ stageName: 'Draft', shopName: null })).note).toBe(
      'The shop is still working on this quote.'
    );
  });

  it('hides the placeholder prices on a request the shop has not priced', () => {
    // A typed line is stored at $0.00 and a catalog line at list price.
    expect(quoteStageView(stage({ stageName: 'Submitted', totalCents: 41250 })).priced).toBe(false);
    expect(quoteStageView(stage({ stageName: 'Under Review', totalCents: 41250 })).priced).toBe(
      false
    );
  });

  it('shows the prices once the shop has quoted them', () => {
    expect(quoteStageView(stage({ stageName: 'Quoted', totalCents: 41250 })).priced).toBe(true);
    expect(quoteStageView(stage({ stageName: 'Accepted', stageType: 'committed' })).priced).toBe(
      true
    );
  });

  it('tells a buyer who cannot answer a quote who can', () => {
    expect(quoteStageView(stage({ stageName: 'Quoted', canWrite: false })).note).toMatch(
      /A buyer or the primary contact on your account can accept or decline it\./
    );
    expect(quoteStageView(stage({ stageName: 'Quoted' })).note).toMatch(/Accept it to go ahead/);
  });

  it('offers a new request on an expired quote only to someone who can make one', () => {
    const writer = quoteStageView(
      stage({ stageName: 'Expired', stageType: 'void', validUntil: 'Sep 1, 2026' })
    );
    expect(writer.note).toBe(
      'This quote expired on Sep 1, 2026. Request a new one if you still need these items.'
    );
    const reader = quoteStageView(
      stage({ stageName: 'Expired', stageType: 'void', canWrite: false })
    );
    expect(reader.note).toBe('This quote has expired.');
  });

  it('never prices a quote that was declined before the shop priced it', () => {
    expect(
      quoteStageView(stage({ stageName: 'Declined', stageType: 'void', totalCents: 0 })).priced
    ).toBe(false);
  });
});

describe('quantity words', () => {
  it('writes a quantity without trailing zeros', () => {
    expect(quantityWords(2)).toBe('2');
    expect(quantityWords(2.5)).toBe('2.5');
    expect(quantityWords(1200)).toBe('1,200');
  });
});

describe('quote summary', () => {
  // Q-000002 as Renée saw it: 6 injectors at $528.00 with a $150.00 core each,
  // and 2 seals at $3.80.
  const q2 = {
    subtotalCents: 317560,
    discountCents: 0,
    taxCents: 0,
    shippingCents: 0,
    surchargeCents: 0,
    coreDepositCents: 90000,
    totalCents: 407560,
  };

  it('shows the core deposits the lines leave out', () => {
    expect(quoteSummaryRows(q2)).toEqual([
      { label: 'Subtotal', cents: 317560 },
      { label: 'Refundable core deposits', cents: 90000 },
      { label: 'Total', cents: 407560, total: true },
    ]);
  });

  it('always adds up to the total', () => {
    const t = {
      subtotalCents: 100000,
      discountCents: 5000,
      taxCents: 7600,
      shippingCents: 2500,
      surchargeCents: 300,
      coreDepositCents: 15000,
      totalCents: 120400,
    };
    const rows = quoteSummaryRows(t);
    const parts = rows.filter((r) => !r.total).reduce((sum, r) => sum + r.cents, 0);
    expect(parts).toBe(t.totalCents);
    expect(rows.map((r) => r.label)).toEqual([
      'Subtotal',
      'Discount',
      'Tax',
      'Shipping',
      'Surcharge',
      'Refundable core deposits',
      'Total',
    ]);
  });
});

describe('core deposit sentence', () => {
  it('says the deposit is per part and comes back', () => {
    expect(coreDepositSentence('$150.00', 6)).toBe(
      'Plus a $150.00 refundable core deposit on each, paid back when the old parts are returned.'
    );
    expect(coreDepositSentence('$150.00', 1)).toBe(
      'Plus a $150.00 refundable core deposit, paid back when the old part is returned.'
    );
  });
});

// Sparx persona issue 085: accepting a quote places its order, so an accepted
// quote names the order it became, and says when that order is waiting for the
// shop's approval.
describe('an accepted quote', () => {
  const base = {
    stageName: 'Accepted',
    stageType: 'committed',
    totalCents: 407560,
    shopName: 'Gillett Diesel Service',
    canWrite: true,
    validUntil: null,
  };

  it('names the order it became', () => {
    const view = quoteStageView({ ...base, order: { orderNumber: 'O-000011', status: 'placed' } });
    expect(view.note).toBe('You accepted this quote. It is now order O-000011.');
  });

  // Sparx persona issue 087: the account's own approver may be the one asked,
  // so the note names whoever the held order is waiting on.
  const teodora = { customerId: 'c-1', name: 'Teodora Vukić-Hale', email: null };

  it('names the account approver a held order is waiting on', () => {
    const view = quoteStageView({
      ...base,
      order: {
        orderNumber: 'O-000012',
        status: 'pending_approval',
        signOff: {
          needs: ['account'],
          waitingOn: ['account'],
          signed: {},
          accountApprovers: [teodora],
        },
      },
    });
    expect(view.note).toBe(
      'You accepted this quote. Your order O-000012 is waiting for Teodora Vukić-Hale to approve it.'
    );
  });

  it('names the shop when it is the one asked', () => {
    const view = quoteStageView({
      ...base,
      order: {
        orderNumber: 'O-000012',
        status: 'pending_approval',
        signOff: { needs: ['business'], waitingOn: ['business'], signed: {}, accountApprovers: [] },
      },
    });
    expect(view.note).toBe(
      'You accepted this quote. Your order O-000012 is waiting for Gillett Diesel Service to approve it.'
    );
  });

  it('names both when both are asked', () => {
    const view = quoteStageView({
      ...base,
      order: {
        orderNumber: 'O-000012',
        status: 'pending_approval',
        signOff: {
          needs: ['account', 'business'],
          waitingOn: ['account', 'business'],
          signed: {},
          accountApprovers: [teodora],
        },
      },
    });
    expect(view.note).toBe(
      'You accepted this quote. Your order O-000012 needs two approvals: one from Teodora Vukić-Hale, and one from Gillett Diesel Service.'
    );
  });

  it('says only that it is waiting when nobody says who', () => {
    const view = quoteStageView({
      ...base,
      order: { orderNumber: 'O-000012', status: 'pending_approval', signOff: null },
    });
    expect(view.note).toBe(
      'You accepted this quote. Your order O-000012 is waiting for approval before it goes ahead.'
    );
  });

  it('says the shop will make the order when there is none yet', () => {
    expect(quoteStageView({ ...base, order: null }).note).toBe(
      'You accepted this quote. Gillett Diesel Service will turn it into an order.'
    );
  });
});

// Sparx persona issue 086: a quote's figures reach the buyer only once the shop
// has made the offer. Before that the portal sends none, and the page must not
// print a figure it was not sent.
describe('pricedQuote', () => {
  const line = { id: 'l1', description: 'O-ring', quantity: 100, coreDepositCents: null };
  const totals = {
    subtotalCents: 38_000,
    discountCents: 0,
    taxCents: 0,
    shippingCents: 0,
    surchargeCents: 0,
    coreDepositCents: 0,
  };

  it('is the figures when the shop has sent them', () => {
    const q = {
      totalCents: 38_000,
      totals,
      lines: [{ ...line, unitPriceCents: 380, lineSubtotalCents: 38_000, lineTotalCents: 38_000 }],
    };
    expect(pricedQuote(q)).toEqual(q);
  });

  it('is nothing when any figure was held back', () => {
    expect(
      pricedQuote({
        totalCents: null,
        totals: null,
        lines: [{ ...line, unitPriceCents: null, lineSubtotalCents: null, lineTotalCents: null }],
      })
    ).toBeNull();
    expect(
      pricedQuote({
        totalCents: 38_000,
        totals,
        lines: [{ ...line, unitPriceCents: null, lineSubtotalCents: null, lineTotalCents: null }],
      })
    ).toBeNull();
  });
});
