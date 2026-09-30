import { describe, expect, it } from 'vitest';

import { countNoteWrite } from './count-note';

describe('countNoteWrite', () => {
  // A bulk import, the scan-to-count flow, an older console: none of them are
  // talking about the note, and none of them may wipe one somebody wrote while
  // walking the shelf.
  it('leaves a stored note alone when nobody mentioned it', () => {
    expect(countNoteWrite(undefined)).toEqual({});
    expect('note' in countNoteWrite(undefined)).toBe(false);
  });

  // The obvious tidy-up is `if (!sent) return {}`. It reads a cleared box as
  // "not mentioned", so the words come back on the next refresh and the person
  // who deleted them cannot work out why.
  it('clears the note when the box is emptied', () => {
    expect(countNoteWrite('')).toEqual({ note: null });
  });

  it('clears the note when a caller says null outright', () => {
    expect(countNoteWrite(null)).toEqual({ note: null });
  });

  // The other obvious tidy-up: drop the trim. A box holding two spaces then
  // counts as a filled note on every later measurement of this table.
  it('treats a box of whitespace as an empty box', () => {
    expect(countNoteWrite('   ')).toEqual({ note: null });
    expect(countNoteWrite('\n\t ')).toEqual({ note: null });
  });

  it('stores what the counter typed', () => {
    expect(countNoteWrite('Four went to the Saturday market')).toEqual({
      note: 'Four went to the Saturday market',
    });
  });

  it('trims the edges without touching the middle', () => {
    expect(countNoteWrite('  Two were damaged.\n\nOne was a sample.  ')).toEqual({
      note: 'Two were damaged.\n\nOne was a sample.',
    });
  });
});
