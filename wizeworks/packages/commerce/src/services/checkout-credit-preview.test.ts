// The payment step knows, before Place order, that an order billed to the
// account runs past its credit (sparx persona issue 187). Wasatch had $1,676.08
// left on a $10,000.00 limit, and Renée's order came to $2,026.38.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { creditPreviewOf } from './checkout-credit-preview';

const wasatch = {
  status: 'active',
  creditLimit: '10000.00',
  creditUsed: '8323.92',
  paymentTerms: 'net30',
};

describe('creditPreviewOf', () => {
  it('says how much credit is left when the order runs past it', () => {
    expect(creditPreviewOf(wasatch, 202_638, 'USD')).toEqual({
      creditLeftCents: 167_608,
      orderTotalCents: 202_638,
      currency: 'USD',
    });
  });

  it('says nothing when the order fits', () => {
    expect(creditPreviewOf(wasatch, 167_608, 'USD')).toBeNull();
  });

  it('says nothing for an account that pays up front', () => {
    expect(creditPreviewOf({ ...wasatch, paymentTerms: 'prepay' }, 202_638, 'USD')).toBeNull();
    expect(creditPreviewOf({ ...wasatch, paymentTerms: null }, 202_638, 'USD')).toBeNull();
  });
});

describe('the checkout session carries it', () => {
  it('is asked of the same account the order is placed against', () => {
    const source = readFileSync(
      fileURLToPath(new URL('./checkout-service.ts', import.meta.url)),
      'utf8'
    );
    expect(source).toMatch(/creditPreviewOf\(\s*account,\s*totalCents,\s*row\.currency\s*\)/);
  });
});
