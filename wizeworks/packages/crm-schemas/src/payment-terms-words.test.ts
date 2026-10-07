// The terms a bill was issued on, frozen with it and printed beside its due
// date (sparx persona issue 103).

import { describe, expect, it } from 'vitest';

import { paymentTermsOf, paymentTermsWords, withPaymentTerms } from './invoicing';

describe('payment terms on a bill', () => {
  it('prints a day count as Net N', () => {
    expect(paymentTermsWords('net45')).toBe('Net 45');
    expect(paymentTermsWords('NET30')).toBe('Net 30');
  });

  it('prints nothing for terms that are not a day count', () => {
    expect(paymentTermsWords('prepay')).toBeNull();
    expect(paymentTermsWords('')).toBeNull();
    expect(paymentTermsWords(null)).toBeNull();
    expect(paymentTermsWords('net0')).toBeNull();
  });

  it('freezes terms into the bag without losing what is there', () => {
    const bag = withPaymentTerms({ poNumber: 'SLCO-FM-26-1203', sentAt: 'x' }, 'net45');
    expect(bag).toEqual({ poNumber: 'SLCO-FM-26-1203', sentAt: 'x', paymentTerms: 'net45' });
    expect(paymentTermsOf(bag)).toBe('net45');
  });

  it('keeps the terms a bill was issued on when the account changes later', () => {
    expect(withPaymentTerms({ paymentTerms: 'net45' }, 'net30')).toEqual({ paymentTerms: 'net45' });
  });

  it('stores nothing for terms it would not print', () => {
    expect(withPaymentTerms({ poNumber: 'A' }, 'prepay')).toEqual({ poNumber: 'A' });
  });
});
