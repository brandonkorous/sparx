// A line's cost reaches the server whenever it changes (sparx persona issue 086):
// comparing only the typed cost missed one cleared on a reopened line.

import { describe, expect, it } from 'vitest';

import { lineBody, lineChanged } from './line-body';
import type { DraftLine } from './totals';

const loaded = (over: Partial<DraftLine> = {}): DraftLine => ({
  key: 'k',
  id: 'line-1',
  lineTypeId: 'type-labor',
  description: 'Diagnose no-start',
  quantity: 2,
  unitPrice: 145,
  discountAmount: 0,
  taxable: true,
  productId: null,
  variantId: null,
  // As the server returned it: a stored cost, nothing typed yet.
  costCents: 6_200,
  ...over,
});

describe('lineChanged', () => {
  it('sees a cost cleared in the editor', () => {
    const previous = loaded();
    expect(lineChanged(loaded({ explicitCostCents: null, costCents: null }), previous)).toBe(true);
  });

  it('sees a new cost typed in the editor', () => {
    expect(lineChanged(loaded({ explicitCostCents: 7_000, costCents: 7_000 }), loaded())).toBe(
      true
    );
  });

  it('does not resend a line whose cost was typed back as it was', () => {
    expect(lineChanged(loaded({ explicitCostCents: 6_200, costCents: 6_200 }), loaded())).toBe(
      false
    );
  });
});

describe('lineBody', () => {
  it('sends the cost of a line priced by hand', () => {
    expect(lineBody(loaded()).explicitCostCents).toBe(6_200);
  });

  it('sends null for a cost cleared, so the server stops keeping it', () => {
    const body = lineBody(loaded({ explicitCostCents: null, costCents: null }));
    expect('explicitCostCents' in body).toBe(true);
    expect(body.explicitCostCents).toBeNull();
  });
});
