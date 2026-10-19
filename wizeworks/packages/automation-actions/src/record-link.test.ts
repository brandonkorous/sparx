// Sparx persona issue 331: a staff alert links to the record it is about.

import { describe, expect, it } from 'vitest';

import { recordLinkFor } from './email.js';

describe('recordLinkFor', () => {
  it('links an order alert to the order', () => {
    expect(recordLinkFor({ 'order.id': 'o1', 'customer.id': 'c1' })).toEqual({
      surface: 'commerce.order.detail',
      id: 'o1',
      label: 'Open the order',
    });
  });

  it('links a return alert to the return, not its order', () => {
    expect(recordLinkFor({ 'return.id': 'r1', 'order.id': 'o1' })?.surface).toBe(
      'commerce.return.detail'
    );
  });

  it('links a stock alert to the stock item by its own parameter', () => {
    expect(recordLinkFor({ 'variant.id': 'v1', 'product.id': 'p1' })).toEqual({
      surface: 'inventory.stock.item',
      id: 'v1',
      param: 'variantId',
      label: 'Open the stock item',
    });
  });

  it('adds nothing when the alert is about no record', () => {
    expect(recordLinkFor({})).toBeNull();
  });
});
