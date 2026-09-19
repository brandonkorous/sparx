import { describe, expect, it } from 'vitest';
import { costOfGoodsNote } from './cogs-note';

/**
 * "COST OF THE GOODS: $0.00", ON A SHOP THAT SEWS EVERYTHING IT SELLS.
 *
 * Money -> What you kept, 2026-09-16:
 *
 *     You lost $1,432.70
 *     Money in                $726.00
 *     Cost of the goods         $0.00   "What the stock you sold actually cost
 *                                        you, from your inventory records."
 *
 * Her inventory records hold no costs at all. Measured the same day: 68 items,
 * 375 units, **zero** with a cost. So the sum is zero and the screen prints it
 * with the confidence of a measurement, which tells a clothes maker that the
 * clothes she sells cost her nothing to make.
 *
 * The platform already says this out loud, two screens away, on the costing
 * page: "68 things on your shelves, 375 units in all, have never had a cost
 * recorded, so they count as nothing in every figure about what your stock is
 * worth." The screen she actually reads said $0.00.
 *
 * A real $0.00 exists as well, on a business that sells its time, so the two are
 * told apart by the STOCK rather than by the sum.
 */
describe('costOfGoodsNote', () => {
  it('says nothing is measured when the shelves have no costs', () => {
    const note = costOfGoodsNote(0, 68, 375);
    expect(note.unmeasured).toBe(true);
    expect(note.detail).toContain('68 things');
    expect(note.detail).toContain('375 units');
    expect(note.detail).not.toContain('actually cost you');
  });

  it('leaves a real zero alone when there is nothing uncosted', () => {
    // A business that sells its time has no cost of goods, and that IS the
    // answer rather than a gap.
    const note = costOfGoodsNote(0, 0, 0);
    expect(note.unmeasured).toBe(false);
    expect(note.detail).toContain('actually cost you');
  });

  it('leaves a figure that was measured alone, even with gaps elsewhere', () => {
    // Some stock costed, some not: the figure is real as far as it goes, and
    // overriding it would hide a number somebody worked for.
    const note = costOfGoodsNote(40_000, 12, 30);
    expect(note.unmeasured).toBe(false);
    expect(note.detail).toContain('actually cost you');
  });

  it('reads naturally for a single item', () => {
    expect(costOfGoodsNote(0, 1, 1).detail).toContain('1 thing on your shelves, 1 unit');
  });
});
