import { describe, expect, it } from 'vitest';

import { noteWrite } from './checkout-note';

describe('noteWrite', () => {
  // An older storefront, the B2B portal, an integration: none of them are
  // talking about notes, and none of them may wipe one.
  it('leaves a stored note alone when nobody mentioned it', () => {
    expect(noteWrite(undefined)).toEqual({});
    expect('customerNote' in noteWrite(undefined)).toBe(false);
  });

  // Breaking this is the obvious tidy-up: `if (!sent) return {}`. It reads a
  // cleared box as "not mentioned", so the note comes back on the next render
  // and the shopper cannot work out why.
  it('clears the note when the box is emptied', () => {
    expect(noteWrite('')).toEqual({ customerNote: null });
  });

  // The other obvious tidy-up: drop the trim. A box holding two spaces then
  // prints a blank line on the order under a heading saying the customer said
  // something.
  it('treats a box of whitespace as an empty box', () => {
    expect(noteWrite('   ')).toEqual({ customerNote: null });
    expect(noteWrite('\n\t ')).toEqual({ customerNote: null });
  });

  it('stores what the buyer typed', () => {
    expect(noteWrite('Leave it with number 12')).toEqual({
      customerNote: 'Leave it with number 12',
    });
  });

  it('trims the edges without touching the middle', () => {
    expect(noteWrite('  It is a gift.\n\nNo receipt please.  ')).toEqual({
      customerNote: 'It is a gift.\n\nNo receipt please.',
    });
  });
});
