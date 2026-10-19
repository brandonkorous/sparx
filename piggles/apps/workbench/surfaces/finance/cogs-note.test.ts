import { describe, expect, it } from 'vitest';
import { costOfGoodsNote } from './cogs-note';

// "Cost of the goods: $0.00" on a shop whose 68 things had no cost: a gap shown as
// a figure (issue 545). A real $0.00 exists too, on a business that sells its
// time, so the two are told apart by the stock rather than by the sum.
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

  it('keeps a measured figure but says what it leaves out (issue 271)', () => {
    // Gillett: $1,100.00 of cost over $17,623.40 of sales, "You kept 93.8%",
    // while 560 things (3,677 units) had no cost and counted as free.
    const note = costOfGoodsNote(110_000, 560, 3677);
    expect(note.partial).toBe(true);
    expect(note.detail).toContain('actually cost you');
    expect(note.detail).toContain('560 things on your shelves, 3,677 units');
  });

  it('is not partial when every thing on the shelves has a cost', () => {
    expect(costOfGoodsNote(110_000, 0, 0).partial).toBe(false);
  });

  it('reads naturally for a single item', () => {
    expect(costOfGoodsNote(0, 1, 1).detail).toContain('1 thing on your shelves, 1 unit');
  });
});
