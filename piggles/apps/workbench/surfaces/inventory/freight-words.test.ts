import { describe, expect, it } from 'vitest';
import { freightNote } from './freight-words';

/**
 * "FREIGHT $0.00", ON AN ORDER THAT COST $14.00 TO GET HERE.
 *
 * PO-000002: 60 brass buckles at $3.60, order total $216.00, Freight $0.00 —
 * and the supplier's invoice, four inches down the same screen, $222.72. The
 * $6.72 has a reason and the screen gave none. It is $14.00 of freight booked
 * in when the goods were received, which lands on `GoodsReceiptCharge` while
 * the Freight field reads `PurchaseOrder.freightCents`.
 *
 * Every other figure had it: the stock is valued at $3.84 a unit against a
 * $3.60 goods cost, and 58 × $3.84 is exactly $222.72. Only the screen where
 * she would check an invoice against an order did not.
 */
const money = (cents: number): string => `$${(cents / 100).toFixed(2)}`;

describe('freightNote', () => {
  it('shows freight that arrived with the goods when none was agreed', () => {
    const note = freightNote(0, 1400, money);
    expect(note.cents).toBe(1400);
    expect(note.detail).toContain('Nothing was agreed for freight');
    expect(note.detail).toContain('$14.00 was charged when the goods came in');
  });

  it('says both when both happened, and keeps them apart', () => {
    // One is what she agreed to pay, the other is what turned up, and the gap
    // is the thing she is checking. A single figure hides it.
    const note = freightNote(2500, 1400, money);
    expect(note.cents).toBe(3900);
    expect(note.detail).toContain('$25.00 agreed when this order was raised');
    expect(note.detail).toContain('$14.00 more charged when the goods came in');
  });

  it('leaves an ordinary order alone', () => {
    const note = freightNote(2500, 0, money);
    expect(note.cents).toBe(2500);
    expect(note.detail).toBe(
      'Spread across the items as they arrive, so what you hold is valued at what it really cost.'
    );
  });

  it('is a plain zero when there is genuinely no freight', () => {
    const note = freightNote(0, 0, money);
    expect(note.cents).toBe(0);
    expect(note.detail).not.toContain('charged when the goods came in');
  });

  it('never prints a zero over a real charge', () => {
    // The whole failure, stated as a rule: if anything arrived, the figure moves.
    for (const arrived of [1, 50, 1400, 99_999]) {
      expect(freightNote(0, arrived, money).cents).toBeGreaterThan(0);
    }
  });

  it('ignores a negative or nonsense arrival rather than subtracting it', () => {
    expect(freightNote(2500, -100, money).cents).toBe(2500);
  });
});
