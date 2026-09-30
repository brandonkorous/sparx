// AN INVOICE RAISED FROM AN ORDER MUST NOT FORGET HOW THE MONEY ARRIVED.
//
// Read on screen 2026-09-20. Order O-000018, $30 handed over at the counter:
//
//     $30.00 · Cash                              Taken
//
// The invoice raised from it, one click later:
//
//     When            Kind        How
//     Sep 20, 2026    Deposit     Other
//
// The copy hardcoded `method: 'other'` and never fetched the order's payment
// rows, so the one screen a bookkeeper matches against the till lost the only
// column that does the matching.

import { describe, expect, it } from 'vitest';
import { invoicePaymentMethod, invoicePaymentNote } from './invoice-payment-method';

describe('invoicePaymentMethod', () => {
  it('calls the till’s cash cash', () => {
    // `manual` is what the till writes for Cash; a check and a transfer have
    // their own values, so nothing else lands there (issue 044).
    expect(invoicePaymentMethod(['manual'])).toBe('cash');
  });

  it('keeps a check a check and a wire a wire', () => {
    expect(invoicePaymentMethod(['check'])).toBe('check');
    expect(invoicePaymentMethod(['wire'])).toBe('wire');
  });

  it('calls every gateway a card', () => {
    // What the How column answers is what the customer handed over, not which
    // company processed it. Two card payments through two gateways are one
    // method, so this must NOT fall through to `other`.
    expect(invoicePaymentMethod(['stripe'])).toBe('card');
    expect(invoicePaymentMethod(['stripe', 'paypal', 'square'])).toBe('card');
  });

  it('says other when the money arrived more than one way', () => {
    // One row carries the lot, so no single word is true. Taking the first or
    // the largest would print a fact about part of the money as a fact about
    // all of it.
    expect(invoicePaymentMethod(['manual', 'check'])).toBe('other');
  });

  it('says other for a processor nobody listed, rather than inventing one', () => {
    expect(invoicePaymentMethod(['some_new_gateway'])).toBe('other');
  });

  it('does not call buying on terms a way money arrived', () => {
    expect(invoicePaymentMethod(['net_terms'])).toBe('other');
  });

  it('says other when there are no payment rows at all', () => {
    // Belt and braces: an order whose amountPaid is positive with no captured
    // rows behind it is a disagreement in the data, and `other` is the only
    // honest answer to a question nothing can answer.
    expect(invoicePaymentMethod([])).toBe('other');
  });
});

describe('invoicePaymentNote', () => {
  it('names the order', () => {
    expect(invoicePaymentNote('O-000018', ['manual'])).toBe(
      'Already received against order O-000018.'
    );
  });

  it('says so when the How column beside it has to read Other', () => {
    expect(invoicePaymentNote('O-000018', ['manual', 'check'])).toBe(
      'Already received against order O-000018, in more than one way.'
    );
  });

  it('does not say so when two gateways both mean card', () => {
    expect(invoicePaymentNote('O-000018', ['stripe', 'paypal'])).toBe(
      'Already received against order O-000018.'
    );
  });
});
