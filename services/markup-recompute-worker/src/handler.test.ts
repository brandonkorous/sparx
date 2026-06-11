import { describe, expect, it } from 'vitest';
import { parseEvent } from './handler.js';

// Guards the contract between the variant.cost.updated publishers (commerce
// variant-service + dropship sync) and this worker's consume.

const VALID = {
  type: 'variant.cost.updated',
  tenantId: '550e8400-e29b-41d4-a716-446655440000',
  data: {
    variantId: 'f47ac10b-58cc-4372-a567-0e02b2c3d479',
    productId: '123e4567-e89b-12d3-a456-426614174000',
    basis: 'variant_cost',
    prevCostCents: 1000,
    newCostCents: 1200,
  },
};

describe('parseEvent (variant.cost.updated)', () => {
  it('accepts a well-formed event', () => {
    const e = parseEvent(VALID);
    expect(e).not.toBeNull();
    expect(e?.data.variantId).toBe(VALID.data.variantId);
    expect(e?.data.basis).toBe('variant_cost');
  });

  it('accepts the supplier_cost basis with null costs', () => {
    const e = parseEvent({
      ...VALID,
      data: { ...VALID.data, basis: 'supplier_cost', prevCostCents: null, newCostCents: null },
    });
    expect(e).not.toBeNull();
    expect(e?.data.basis).toBe('supplier_cost');
  });

  it('rejects a different event type', () => {
    expect(parseEvent({ ...VALID, type: 'variant.updated' })).toBeNull();
  });

  it('rejects an unknown basis', () => {
    expect(parseEvent({ ...VALID, data: { ...VALID.data, basis: 'average_cost' } })).toBeNull();
  });

  it('rejects a non-uuid variant or tenant id', () => {
    expect(parseEvent({ ...VALID, tenantId: 'nope' })).toBeNull();
    expect(parseEvent({ ...VALID, data: { ...VALID.data, variantId: 'nope' } })).toBeNull();
  });
});
