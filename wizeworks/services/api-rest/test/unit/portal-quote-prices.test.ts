// The prices on a quote stay the business's until it has made the offer (sparx
// persona issue 086).
//
// A request the buyer sends now starts at their account's price, so the
// business opens it already priced to work from. Those are the business's
// working figures: the buyer's portal shows "Not priced yet" and no money until
// the quote is Quoted, and the portal API sends no money either, so nothing can
// be read off the page's network traffic.

import { describe, expect, it, vi } from 'vitest';

import {
  accountPricer,
  portalDocumentPrintable,
  portalQuoteMoney,
  quotePricesShown,
} from '../../src/lib/portal-quote-prices.js';

const stage = (name: string, stageType: string) => ({ name, stageType });

describe('quotePricesShown', () => {
  it('hides them while the business is still working on it', () => {
    expect(quotePricesShown(stage('Draft', 'draft'), {})).toBe(false);
    expect(quotePricesShown(stage('Submitted', 'draft'), {})).toBe(false);
    expect(quotePricesShown(stage('Under Review', 'draft'), {})).toBe(false);
  });

  it('shows them once it is priced and offered, and after it is accepted', () => {
    expect(quotePricesShown(stage('Quoted', 'draft'), {})).toBe(true);
    expect(quotePricesShown(stage('Accepted', 'committed'), {})).toBe(true);
  });

  it('shows them on a declined or expired quote only when it was sent', () => {
    expect(quotePricesShown(stage('Declined', 'void'), {})).toBe(false);
    expect(quotePricesShown(stage('Expired', 'void'), { sentAt: '2026-10-02T17:00:00.000Z' })).toBe(
      true
    );
  });
});

describe('portalQuoteMoney', () => {
  const row = {
    totalCents: 249_200,
    totals: { subtotalCents: 249_200, discountCents: 0, taxCents: 0 },
    lines: [
      {
        id: 'l1',
        description: 'O-ring',
        quantity: 100,
        unitPriceCents: 380,
        lineSubtotalCents: 38_000,
        lineTotalCents: 38_000,
        coreDepositCents: null,
      },
    ],
  };

  it('sends no money at all before the offer', () => {
    const out = portalQuoteMoney(row, false);
    expect(out.totalCents).toBeNull();
    expect(out.totals).toBeNull();
    expect(out.lines[0]).toEqual({
      id: 'l1',
      description: 'O-ring',
      quantity: 100,
      unitPriceCents: null,
      lineSubtotalCents: null,
      lineTotalCents: null,
      coreDepositCents: null,
    });
    expect(JSON.stringify(out)).not.toContain('380');
  });

  it('sends it all once the offer is made', () => {
    expect(portalQuoteMoney(row, true)).toEqual(row);
  });
});

describe('accountPricer', () => {
  it('asks the price engine for the account’s price and passes on its words', async () => {
    const resolveForAccount = vi.fn(() =>
      Promise.resolve({ effectivePriceCents: 380, words: 'Fleet price: 12% off $4.32' })
    );
    const price = accountPricer({ tenantId: 't' }, resolveForAccount);
    await expect(
      price({ variantId: 'v', accountId: 'a', quantity: 100, propertyId: 'site' })
    ).resolves.toEqual({ unitPrice: 3.8, priceNote: 'Fleet price: 12% off $4.32' });
    expect(resolveForAccount).toHaveBeenCalledWith(
      { tenantId: 't' },
      { variantId: 'v', accountId: 'a', quantity: 100, propertyId: 'site' }
    );
  });
});

// The printable quote is the same page the business prints, figures and all,
// so it follows the same rule as the list: not before the offer. A Quoted quote
// was refused by the old rule (every stage up to Quoted is a `draft` type), so
// its "Print or save as PDF" link led nowhere.
describe('portalDocumentPrintable', () => {
  const quote = (name: string, stageType: string, metadata: unknown = {}) => ({
    isQuote: true,
    stage: { name, stageType },
    metadata,
  });

  it('prints a quote once the offer is made, and not before', () => {
    expect(portalDocumentPrintable(quote('Quoted', 'draft'))).toBe(true);
    expect(portalDocumentPrintable(quote('Accepted', 'committed'))).toBe(true);
    expect(portalDocumentPrintable(quote('Submitted', 'draft'))).toBe(false);
    expect(portalDocumentPrintable(quote('Declined', 'void'))).toBe(false);
  });

  it('prints an issued bill', () => {
    expect(
      portalDocumentPrintable({
        isQuote: false,
        stage: { name: 'Issued', stageType: 'open' },
        metadata: {},
      })
    ).toBe(true);
  });
});
