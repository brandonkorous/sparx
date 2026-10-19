// A refund that belongs to a return says so (sparx persona issue 347).

import { describe, expect, it } from 'vitest';

import { refundSource } from './refund-source';

describe('refundSource', () => {
  it('is a return when the row names one', () => {
    expect(refundSource({ returnId: 'e47f977e', issuedAs: 'original_payment' })).toBe('return');
    expect(refundSource({ returnId: 'e47f977e', kind: 'core' })).toBe('return');
  });

  it('is the order for every other refund', () => {
    expect(refundSource({})).toBe('order');
    expect(refundSource({ returnId: '' })).toBe('order');
    expect(refundSource(null)).toBe('order');
    expect(refundSource(undefined)).toBe('order');
    expect(refundSource(['returnId'])).toBe('order');
  });
});
