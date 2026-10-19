// A refund that belongs to a return says so (sparx persona issue 347).

import { describe, expect, it } from 'vitest';

import { refundAmount, refundGoesTo, refundSource } from './refund-source';

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

// The refund's own amount, not the order's running total (sparx persona issue 350).
describe('refundAmount', () => {
  it('is the money this refund gave back', () => {
    expect(refundAmount('15.00', 'USD')).toBe('$15.00');
    expect(refundAmount(640.96, 'USD')).toBe('$640.96');
    expect(refundAmount(1286.4, 'USD')).toBe('$1,286.40');
  });

  it('is blank when there is no amount', () => {
    expect(refundAmount(null, 'USD')).toBe('');
    expect(refundAmount(undefined, 'USD')).toBe('');
    expect(refundAmount('not money', 'USD')).toBe('');
  });

  it('reads dollars when the currency is missing', () => {
    expect(refundAmount(15, null)).toBe('$15.00');
  });
});

// A cash refund is never told it takes days at the bank (sparx persona issue 352).
describe('refundGoesTo', () => {
  it('is a card when a gateway settled it', () => {
    expect(refundGoesTo({ settledBy: 'gateway' })).toBe('card');
  });

  it('is by hand for money taken by hand, and for a row that does not say', () => {
    expect(refundGoesTo({ settledBy: 'hand' })).toBe('hand');
    expect(refundGoesTo({})).toBe('hand');
    expect(refundGoesTo(null)).toBe('hand');
  });
});
