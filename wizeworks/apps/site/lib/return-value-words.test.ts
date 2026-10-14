// The return form says what the chosen goods are worth (sparx persona issue 211).
// Brynn chose what to send back and asked for her money, and nothing on the form
// said how much that was. The figure is the one the shop starts from: the price
// she paid for each, plus the core deposit on a rebuilt part that still owed its
// old part (the console adds the same, issue 051).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { returnValueOf, returnValueSentence } from './return-value-words';

// Two O-rings sold untaxed; four injectors with Utah's 7.25% on them.
const oRing = {
  orderItemId: 'a',
  quantity: 2,
  goodsPaidCents: 864,
  taxPaidCents: 0,
  coreDepositCents: null,
  coresOwed: 0,
};
const injector = {
  orderItemId: 'b',
  quantity: 4,
  goodsPaidCents: 240_000,
  taxPaidCents: 17_400,
  coreDepositCents: 15_000,
  coresOwed: 2,
};

describe('returnValueOf', () => {
  it('adds up the price paid for what she chose', () => {
    expect(returnValueOf([oRing], { a: 1 })).toEqual({
      goodsCents: 432,
      taxCents: 0,
      coreCents: 0,
    });
  });

  // Brynn sent back one of two injectors and was told $600.00: the $43.50 of tax
  // she paid on it was left out (sparx persona issue 231).
  it('adds the sales tax she paid on what she chose', () => {
    expect(returnValueOf([injector], { b: 1 })).toEqual({
      goodsCents: 60_000,
      taxCents: 4_350,
      coreCents: 15_000,
    });
  });

  it('adds the core deposit for each part that still owed its old one', () => {
    expect(returnValueOf([injector], { b: 3 }).coreCents).toBe(30_000);
  });

  it('counts only what she chose', () => {
    expect(returnValueOf([oRing, injector], { a: 2 })).toEqual({
      goodsCents: 864,
      taxCents: 0,
      coreCents: 0,
    });
  });
});

describe('returnValueSentence', () => {
  it('says what it comes to, and that the shop decides', () => {
    expect(returnValueSentence({ goodsCents: 432, taxCents: 0, coreCents: 0 }, 'USD')).toBe(
      'At the price you paid, this comes to $4.32. We tell you what we give back once we have looked at it.'
    );
  });

  it('names the core deposit that comes back with a rebuilt part', () => {
    expect(returnValueSentence({ goodsCents: 60_000, taxCents: 0, coreCents: 15_000 }, 'USD')).toBe(
      'At the price you paid, this comes to $600.00, and $150.00 of core deposit comes back with it. We tell you what we give back once we have looked at it.'
    );
  });

  it('counts the sales tax she paid in what it comes to', () => {
    expect(
      returnValueSentence({ goodsCents: 60_000, taxCents: 4_350, coreCents: 15_000 }, 'USD')
    ).toBe(
      'At the price you paid, with its sales tax, this comes to $643.50, and $150.00 of core deposit comes back with it. We tell you what we give back once we have looked at it.'
    );
  });

  it('says nothing before anything is chosen', () => {
    expect(returnValueSentence({ goodsCents: 0, taxCents: 0, coreCents: 0 }, 'USD')).toBeNull();
  });
});

describe('the return form', () => {
  it('shows it when she asks for her money', () => {
    const page = readFileSync(
      fileURLToPath(
        new URL('../app/account/(authed)/orders/[orderId]/return/page.tsx', import.meta.url)
      ),
      'utf8'
    );
    expect(page).toContain('returnValueSentence(');
  });
});
