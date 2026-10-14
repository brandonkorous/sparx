// "Due on collection" only where somebody collects and pays then (sparx persona
// issue 220). Renée's shipped order on Wasatch Front's 30-day account read "Due on
// collection $43.27" in her confirmation.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { dueOnCollectionCents } from './collection-balance.js';

describe('dueOnCollectionCents', () => {
  it('is what is left to pay on an order collected and paid at the counter', () => {
    expect(
      dueOnCollectionCents({ pickup: true, terms: null, totalCents: 12000, paidCents: 3000 })
    ).toBe(9000);
  });

  it('is nothing on an order that is shipped', () => {
    expect(
      dueOnCollectionCents({ pickup: false, terms: null, totalCents: 4327, paidCents: 0 })
    ).toBe(0);
  });

  it('is nothing on an order billed to an account, collected or not', () => {
    expect(
      dueOnCollectionCents({ pickup: true, terms: 'net30', totalCents: 4327, paidCents: 0 })
    ).toBe(0);
    expect(
      dueOnCollectionCents({ pickup: false, terms: 'net30', totalCents: 4327, paidCents: 0 })
    ).toBe(0);
  });

  it('is nothing once it is paid', () => {
    expect(
      dueOnCollectionCents({ pickup: true, terms: null, totalCents: 4327, paidCents: 4327 })
    ).toBe(0);
  });

  it('is what the order email binds', () => {
    const src = readFileSync(resolve(__dirname, 'email-data.ts'), 'utf8');
    expect(src).toMatch(/balanceDue: moneyPositive\(\s*dueOnCollectionCents\(/);
  });
});
