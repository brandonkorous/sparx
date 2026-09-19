// A COLUMN OF ZEROS HAS TO SAY WHICH KIND OF ZERO IT IS.
//
// Juniper Row's Shelves list showed five shelves with 0 on every one, while 491
// units sat at another location that has no shelves at all. A zero means "this
// shelf is empty" or "nothing here can hold stock", and those want different
// answers from the reader.

import { describe, expect, it } from 'vitest';
import { emptyShelvesNote, locationStockLine, type LocationStock } from './location-stock-line';

const place = (name: string, onHand: number | null, binCount: number | null): LocationStock => ({
  name,
  onHand,
  binCount,
});

/** Juniper Row, as measured on 2026-09-16. */
const JUNIPER = [place('Fulfillment Center', 0, 5), place('Main Warehouse', 491, 0)];

describe('locationStockLine', () => {
  it('says what is in the place and whether it has shelves', () => {
    expect(locationStockLine(place('Main Warehouse', 491, 0))).toBe('491 units · no shelves');
    expect(locationStockLine(place('Fulfillment Center', 0, 5))).toBe('Nothing here · 5 shelves');
  });

  it('counts in ones without saying "1 units"', () => {
    expect(locationStockLine(place('Shop', 1, 1))).toBe('1 unit · 1 shelf');
  });

  it('groups the thousands, because 12162 is not a number anybody reads', () => {
    expect(locationStockLine(place('FC', 12_162, 3))).toContain('12,162 units');
  });

  it('says NOTHING when nobody counted', () => {
    // A location read on its own carries no counts. "0 units" there would be a
    // claim about the warehouse made by a request that never asked.
    expect(locationStockLine(place('Main Warehouse', null, null))).toBeNull();
    expect(locationStockLine(place('Main Warehouse', 491, null))).toBeNull();
    expect(locationStockLine(place('Main Warehouse', null, 0))).toBeNull();
  });
});

describe('emptyShelvesNote', () => {
  it('names where the stock actually is', () => {
    // The whole finding, in one sentence.
    const note = emptyShelvesNote([{ unitCount: 0 }, { unitCount: 0 }], JUNIPER);
    expect(note).toContain('Main Warehouse');
    expect(note).toContain('no shelves');
  });

  it('lists every place holding unshelvable stock', () => {
    const note = emptyShelvesNote(
      [{ unitCount: 0 }],
      [place('Main Warehouse', 400, 0), place('Back room', 91, 0), place('FC', 0, 5)]
    );
    expect(note).toContain('Main Warehouse');
    expect(note).toContain('Back room');
  });

  it('says so plainly when there is no stock anywhere', () => {
    const note = emptyShelvesNote([{ unitCount: 0 }], [place('FC', 0, 5)]);
    expect(note).toContain('no stock anywhere else either');
    expect(note).not.toContain('which has no shelves');
  });

  it('covers the third case: stock is here, nothing is put away', () => {
    // Every location that holds stock also HAS shelves, and none of them is
    // used. That is a put-away problem, not a location problem, and it must not
    // borrow the sentence about a place with no shelves.
    const note = emptyShelvesNote([{ unitCount: 0 }], [place('FC', 250, 5)]);
    expect(note).toContain('250 units');
    expect(note).toContain('put away onto a shelf');
    expect(note).not.toContain('which has no shelves');
  });

  it('stays quiet when a shelf on screen has something on it', () => {
    // There is nothing to explain, and a standing notice is noise.
    expect(emptyShelvesNote([{ unitCount: 0 }, { unitCount: 12 }], JUNIPER)).toBeNull();
  });

  it('stays quiet on an empty table', () => {
    // The list's own empty state owns that, and it says something better.
    expect(emptyShelvesNote([], JUNIPER)).toBeNull();
  });

  it('stays quiet until the locations have loaded', () => {
    // A guess made before the facts arrive is how a pane came to report the
    // server unreachable over a link that was fine.
    expect(emptyShelvesNote([{ unitCount: 0 }], null)).toBeNull();
    expect(emptyShelvesNote([{ unitCount: 0 }], [place('FC', null, null)])).toBeNull();
  });

  it('always says what the reader should look at next', () => {
    // The property: every branch that speaks at all has to leave the reader
    // somewhere, not just report that the column is blank.
    const shapes: [{ unitCount: number }[], LocationStock[]][] = [
      [[{ unitCount: 0 }], JUNIPER],
      [[{ unitCount: 0 }], [place('FC', 0, 5)]],
      [[{ unitCount: 0 }], [place('FC', 250, 5)]],
    ];
    for (const [shelvesShown, locations] of shapes) {
      const note = emptyShelvesNote(shelvesShown, locations);
      expect(note, JSON.stringify(locations)).not.toBeNull();
      expect(note ?? '', JSON.stringify(locations)).toMatch(/shelf|shelves/);
    }
  });
});
