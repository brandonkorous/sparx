// What the business reads on a quote a trade buyer sent (sparx persona issue 086).
//
// A buyer's request carries their PO number and what they need about delivery:
// the day it is needed by, where it goes, and any other word about getting it
// there. Both ride in the quote's metadata bag; the staff read of a quote has to
// bring them out, or the business prices a job without knowing when or where.

import { describe, expect, it } from 'vitest';

import { mapQuote } from '../../src/routes/v1/b2b/quotes.js';

type QuoteDoc = Parameters<typeof mapQuote>[0];

function doc(metadata: unknown): QuoteDoc {
  return {
    id: 'q-1',
    number: 'Q-000044',
    companyId: 'acc-1',
    customerId: 'cus-1',
    subtotal: 0,
    taxTotal: 0,
    total: 0,
    currency: 'USD',
    validUntil: null,
    customerNote: 'Price for six',
    metadata,
    createdAt: new Date('2026-10-02T17:00:00Z'),
    updatedAt: new Date('2026-10-02T17:00:00Z'),
    stage: { id: 's-1', name: 'Submitted', customerLabel: 'Submitted', stageType: 'draft' },
    lines: [],
    company: { id: 'acc-1', companyName: 'Wasatch Front Utility Contractors' },
    customer: null,
  } as unknown as QuoteDoc;
}

describe('a buyer-sent quote, as the business reads it', () => {
  it('carries the PO number and the delivery needs', () => {
    const quote = mapQuote(
      doc({
        poNumber: 'WFUC-24-0901',
        delivery: { neededBy: '2026-10-20', deliverTo: 'Yard 2', notes: 'Forklift on site' },
      })
    );
    expect(quote.poNumber).toBe('WFUC-24-0901');
    expect(quote.delivery).toEqual({
      neededBy: '2026-10-20',
      deliverTo: 'Yard 2',
      notes: 'Forklift on site',
    });
  });

  it('reads none of either as null, not as blanks', () => {
    const quote = mapQuote(doc({}));
    expect(quote.poNumber).toBeNull();
    expect(quote.delivery).toBeNull();
  });
});
