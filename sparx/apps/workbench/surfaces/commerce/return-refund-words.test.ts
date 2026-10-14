// A refund on money taken by hand must not say it moves money (sparx persona
// issue 178): Doty was told Brynn's $750.00 went back the way she paid, and it
// was still in his till.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { refundSettledText, refundStepText, refundWords } from './return-refund-words';

const words = (byHand: boolean, asCredit = false) =>
  refundWords({ who: "Brynn O'Hara-Løvdal", amount: '$750.00', byHand, asCredit });

describe('refundWords', () => {
  it('tells the owner to hand counter money back themselves', () => {
    const w = words(true);
    expect(w.description).toContain('you hand the money over yourself');
    expect(w.description).not.toMatch(/moves real money|the way they paid/);
    expect(w.submitLabel).toBe('Mark $750.00 as given back');
    expect(w.creditLabel).not.toContain('card');
  });

  it('still says the money moves when a gateway holds the charge', () => {
    const w = words(false);
    expect(w.description).toContain('This moves real money');
    expect(w.submitLabel).toBe('Give back $750.00');
  });

  it('names store credit as store credit, however they paid', () => {
    for (const byHand of [true, false]) {
      expect(words(byHand, true).submitLabel).toBe('Give $750.00 as store credit');
    }
  });

  it('says a finished counter refund went back by hand', () => {
    const labels = { original_payment: 'Back to how they paid', account_credit: 'Store credit' };
    expect(refundSettledText('original_payment', true, labels)).toBe('Given back by hand');
    expect(refundSettledText('original_payment', false, labels)).toBe('Back to how they paid');
    expect(refundSettledText('account_credit', true, labels)).toBe('Store credit');
  });

  it('words the step on the page the same way', () => {
    expect(refundStepText(true)).not.toContain('moves real money');
    expect(refundStepText(false)).toContain('moves real money');
  });
});

describe('the return screens use it', () => {
  const read = (file: string) =>
    readFileSync(fileURLToPath(new URL(file, import.meta.url)), 'utf8');

  it('the refund dialog words itself from the server answer', () => {
    const source = read('./return-actions.tsx');
    expect(source).toMatch(/refundWords\(\{[\s\S]*?byHand: detail\.refundsByHand/);
    expect(source).not.toContain('moves real money');
  });

  it('the step on the return page does too', () => {
    const source = read('./return-detail.tsx');
    expect(source).toContain('refundStepText(detail.refundsByHand)');
    expect(source).toMatch(/refundSettledText\(\s*detail\.refundIssuedAs,\s*detail\.refundsByHand/);
    expect(source).not.toContain('moves real money');
  });
});
