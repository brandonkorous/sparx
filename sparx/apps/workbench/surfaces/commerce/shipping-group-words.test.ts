import { describe, expect, it } from 'vitest';
import { groupDeliveryWarning, type GroupDeliveryShape } from './shipping-group-words';

function group(over: Partial<GroupDeliveryShape> = {}): GroupDeliveryShape {
  return {
    rateCount: 1,
    isDefault: false,
    productCount: 1,
    variantCount: 0,
    collectionCount: 0,
    ...over,
  };
}

describe('whether a product group can be delivered', () => {
  it('says nothing when a region prices it', () => {
    expect(groupDeliveryWarning(group())).toBeNull();
  });

  it('calls it an emergency when the DEFAULT group has no price', () => {
    // Nothing in the shop can be delivered: the default group covers every
    // product not filed under another one.
    const w = groupDeliveryWarning(group({ rateCount: 0, isDefault: true, productCount: 0 }));
    expect(w?.tone).toBe('error');
    expect(w?.detail).toContain('every product not filed under another group');
  });

  it('names how many products are stranded', () => {
    const w = groupDeliveryWarning(group({ rateCount: 0, productCount: 4 }));
    expect(w?.tone).toBe('error');
    expect(w?.detail).toContain('4 products');
  });

  it('reads differently at one than at two', () => {
    const one = groupDeliveryWarning(group({ rateCount: 0, productCount: 1 }))?.detail ?? '';
    const two = groupDeliveryWarning(group({ rateCount: 0, productCount: 2 }))?.detail ?? '';
    expect(one).toContain('the 1 product in it');
    expect(one.replace(/\d+/g, 'N')).not.toBe(two.replace(/\d+/g, 'N'));
  });

  it('counts variants and collections as filed, not just products', () => {
    // A group can hold a whole collection without holding a single product row.
    const w = groupDeliveryWarning(
      group({ rateCount: 0, productCount: 0, variantCount: 2, collectionCount: 1 })
    );
    expect(w?.detail).toContain('3 products');
  });

  it('is only a warning when nothing is filed under it yet', () => {
    // A group created a minute ago is not broken. It is about to be.
    const w = groupDeliveryWarning(
      group({ rateCount: 0, productCount: 0, variantCount: 0, collectionCount: 0 })
    );
    expect(w?.tone).toBe('warning');
    expect(w?.detail).toContain('nothing is affected');
  });

  it('tells an empty group apart from a stranded one', () => {
    // Same zero rate count, two different situations, two different reactions.
    const empty = groupDeliveryWarning(group({ rateCount: 0, productCount: 0 }));
    const stranded = groupDeliveryWarning(group({ rateCount: 0, productCount: 3 }));
    expect(empty?.tone).not.toBe(stranded?.tone);
  });
});
