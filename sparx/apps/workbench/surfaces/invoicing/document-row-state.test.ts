// A quote on any list of documents is a price offered, never "Owed".
//
// MEASURED 2026-10-06 on Gillett: Wasatch Front's company page said "$13,469.60
// outstanding across 9 documents" and listed Q-000002, Q-000006, Q-000011,
// Q-000012 and Q-000013 as Owed. Only $5,976.80 was owed, on four invoices. The
// Invoicing list had learned the rule in issue 085; the company page and the
// customer's Invoices tab had not (sparx persona issue 111).

import { describe, expect, it } from 'vitest';

import { documentRowState, owedOn } from './types';

const quote = {
  status: 'unpaid' as const,
  balance: 4075.6,
  priceOffer: true,
  stageName: 'Accepted',
  stageType: 'committed',
};
const invoice = { status: 'unpaid' as const, balance: 4075.6, priceOffer: false };

describe('documentRowState', () => {
  it('names a quote by where it stands, not by its payment status', () => {
    expect(documentRowState(quote)).toEqual({ label: 'Accepted', tone: 'success' });
  });

  it('names an invoice by what is owed on it', () => {
    expect(documentRowState(invoice)).toEqual({ label: 'Owed', tone: 'warning' });
  });
});

describe('owedOn', () => {
  it('owes nothing on a quote and the balance on an invoice', () => {
    expect(owedOn(quote)).toBe(0);
    expect(owedOn(invoice)).toBe(4075.6);
  });
});
