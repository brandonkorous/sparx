// WHAT A STOCK ROW SAYS IT IS, AND HOW MANY OF THE FOUR NUMBERS IT ASKED FOR.
//
// "Sellable" is on-hand, minus what is spoken for, minus the cushion held back
// from the website, minus what is sitting on a shelf nothing may be sold from.
// Four terms. `sellable()` takes all four; `levelState()` — the function that
// produces the badge — declared a parameter type with three of them, and the
// endpoint did not send the fourth at all, so the badge and the row's own filter
// answered the same question differently.
//
// On Juniper Row: one brass belt buckle on a quarantine shelf at the fulfillment
// center read "To sell 1 · In stock" on the very row the "None to sell" filter
// had returned (issue 862).

import { describe, expect, it } from 'vitest';

import { levelState, sellable, overallState } from './data';

/** A level with every term explicit, so no test leans on a default. */
function level(over: {
  onHand: number;
  allocated?: number;
  safetyBuffer?: number;
  unsellableOnHand?: number;
  reorderPoint?: number | null;
}) {
  return {
    onHand: over.onHand,
    allocated: over.allocated ?? 0,
    safetyBuffer: over.safetyBuffer ?? 0,
    unsellableOnHand: over.unsellableOnHand ?? 0,
    reorderPoint: over.reorderPoint ?? null,
  };
}

describe('what can be sold', () => {
  it('counts all four terms, not three', () => {
    expect(sellable(level({ onHand: 10 }))).toBe(10);
    expect(sellable(level({ onHand: 10, allocated: 3 }))).toBe(7);
    expect(sellable(level({ onHand: 10, allocated: 3, safetyBuffer: 2 }))).toBe(5);
    expect(
      sellable(level({ onHand: 10, allocated: 3, safetyBuffer: 2, unsellableOnHand: 5 }))
    ).toBe(0);
  });

  it('never reports a negative, because nobody says minus three to sell', () => {
    expect(sellable(level({ onHand: 1, allocated: 0, unsellableOnHand: 4 }))).toBe(0);
  });
});

describe('the badge on a stock row', () => {
  it('says none to sell when the last unit is on a shelf it cannot leave', () => {
    // THE BUG, as her data holds it: one on hand, none spoken for, and that one
    // quarantined. Three terms say 1 and "In stock"; four say 0.
    expect(levelState(level({ onHand: 1, unsellableOnHand: 1 })).label).toBe('None to sell');
  });

  it('still says in stock when nothing is held back', () => {
    expect(levelState(level({ onHand: 1 })).label).toBe('In stock');
    expect(levelState(level({ onHand: 59 })).label).toBe('In stock');
  });

  it('agrees with what can be sold, on every mix of the four', () => {
    // The property that makes the badge and the number beside it one answer: the
    // column shows `sellable()` and the badge is derived from it, so a zero in one
    // must never be an "In stock" in the other.
    const disagreements: string[] = [];
    for (const onHand of [0, 1, 5]) {
      for (const allocated of [0, 1, 5]) {
        for (const safetyBuffer of [0, 1]) {
          for (const unsellableOnHand of [0, 1]) {
            const l = level({ onHand, allocated, safetyBuffer, unsellableOnHand });
            const canSell = sellable(l);
            const label = levelState(l).label;
            if ((canSell === 0) !== (label === 'None to sell')) {
              disagreements.push(
                `${onHand}/${allocated}/${safetyBuffer}/${unsellableOnHand}: ${String(canSell)} vs “${label}”`
              );
            }
          }
        }
      }
    }
    expect(disagreements).toEqual([]);
  });

  it('says running low only against a trigger the business set', () => {
    expect(levelState(level({ onHand: 3, reorderPoint: 5 })).label).toBe('Running low');
    // No reorder point is no alert: an owner who set no trigger asked for none.
    expect(levelState(level({ onHand: 3, reorderPoint: null })).label).toBe('In stock');
  });

  it('calls a quarantined level none to sell rather than running low', () => {
    // Worse beats worse-ish: zero sellable is not "low", whatever the trigger is.
    expect(levelState(level({ onHand: 2, unsellableOnHand: 2, reorderPoint: 5 })).label).toBe(
      'None to sell'
    );
  });

  it('treats a missing fourth number as zero, and only that', () => {
    // A row cached before the endpoint sent the field. It must not throw, and it
    // must not claim the quarantine shelf is empty for any row that DOES carry it.
    const stale = { onHand: 1, allocated: 0, safetyBuffer: 0, reorderPoint: null };
    expect(levelState(stale).label).toBe('In stock');
  });
});

describe('the worst state across locations', () => {
  it('says out somewhere when one place is empty and another is not', () => {
    // Her brass buckle exactly: 59 at the main warehouse, 1 quarantined at the
    // fulfillment center, 0 in transit.
    const levels = [
      level({ onHand: 59 }),
      level({ onHand: 1, unsellableOnHand: 1 }),
      level({ onHand: 0 }),
    ] as never[];
    expect(overallState(levels).label).toBe('Out somewhere');
  });
});
