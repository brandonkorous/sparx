// A COLUMN OF DASHES NEEDS A SENTENCE, LIKE THE ONE BESIDE IT ALREADY HAS.
//
// "Cost to keep" counts the stock levels with no cost price and says so above
// the figures. Two columns to the right, Cover was a dash on almost every row
// with nothing anywhere explaining it.
//
// Measured: of 600 stocked levels on the platform, 13 have a positive demand
// forecast, and they belong to two businesses. Six of the eight shops with stock
// cannot show a cover figure on a single row.

import { describe, expect, it } from 'vitest';
import { coverNote, type CoverRow } from './cover-note';

const rows = (...cover: (number | null)[]): CoverRow[] =>
  cover.map((daysOfCover) => ({ daysOfCover }));

describe('coverNote', () => {
  it('says nothing when every row can show a figure', () => {
    // The note is an explanation for an absence. With nothing absent it is
    // noise, and the table speaks for itself.
    expect(coverNote(rows(12, 40, 3))).toBeNull();
  });

  it('says nothing about an empty table', () => {
    // The empty state above it is that screen's job, not this sentence's.
    expect(coverNote([])).toBeNull();
  });

  it('counts the rows that cannot, and stays plural', () => {
    const note = coverNote(rows(12, null, null, 8));
    expect(note).toContain('2 of these have no cover figure');
  });

  it('says one rather than "1 of these have"', () => {
    const note = coverNote(rows(12, null, 8));
    expect(note).toContain('One of these has no cover figure');
    expect(note).not.toContain('1 of these');
  });

  it('says so plainly when not one row can show it', () => {
    // Six of the eight shops with stock, today.
    const note = coverNote(rows(null, null, null));
    expect(note).toContain('None of these has a cover figure yet');
    expect(note).not.toContain('3 of these');
  });

  it('always explains WHY, not just how many', () => {
    // The property: a count on its own reads as a fault in the product. Every
    // branch that appears at all has to say what cover needs.
    const shapes = [rows(null), rows(1, null), rows(null, null), rows(5, null, null)];
    for (const shape of shapes) {
      const note = coverNote(shape);
      expect(note, JSON.stringify(shape)).not.toBeNull();
      expect(note, JSON.stringify(shape)).toContain('at the rate it has been selling');
      expect(note, JSON.stringify(shape)).toContain('some sales behind it');
    }
  });
});
