import { describe, expect, it } from 'vitest';
import type { Buildable } from './assembly-data';
import { planRunNote } from './plan-run-words';

const buildable = (quantity: number): Buildable => ({
  bomId: 'b',
  outputVariantId: 'o',
  outputSku: 'KIT',
  warehouseId: 'w',
  quantity,
  outputQuantityPerBatch: 1,
  limitingVariantId: 'v',
  limitingSku: '4062328',
  components: [
    {
      variantId: 'v',
      variantSku: '4062328',
      productTitle: 'Crossover Tube O-Ring',
      variantName: null,
      requiredPerBatch: 1,
      available: quantity,
      supports: quantity,
      isLimiting: true,
    },
  ],
});

describe('the plan form note', () => {
  it('says when none can be made, naming what runs out first', () => {
    expect(planRunNote(buildable(0), 1, 'the shop')).toEqual({
      short: true,
      text: 'None can be made at the shop from what is free: Crossover Tube O-Ring runs out first. You can still plan it, and hold the parts once they are in.',
    });
  });

  it('says how many when fewer than asked', () => {
    expect(planRunNote(buildable(1200), 1500, 'the shop')?.text).toMatch(/^Only 1,200 can be made/);
  });

  it('says how many can be made when there is enough', () => {
    expect(planRunNote(buildable(3), 2, 'the shop')).toEqual({
      short: false,
      text: 'Up to 3 can be made at the shop from what is free.',
    });
  });

  it('says nothing before a recipe or a count is chosen', () => {
    expect(planRunNote(undefined, 1, 'the shop')).toBeNull();
    expect(planRunNote(buildable(3), Number.NaN, 'the shop')).toBeNull();
  });
});
