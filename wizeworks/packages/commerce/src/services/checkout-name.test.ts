// The customer's name, which checkout collected and then dropped.
//
// Her Orders screen read "Who bought it: rowan.pike@example.test" — the email,
// twice, where a person's name belongs — after the shopper had typed "Rowan
// Pike" into a REQUIRED field two steps earlier.

import { describe, expect, it } from 'vitest';
import { readRecipientName, splitName } from './checkout-service';

describe('splitName', () => {
  it('keeps the name somebody typed', () => {
    expect(splitName('Rowan Pike')).toEqual({ firstName: 'Rowan', lastName: 'Pike' });
  });

  it('does not invent a surname for a one-word name', () => {
    expect(splitName('Cher')).toEqual({ firstName: 'Cher' });
  });

  it('treats everything after the first name as the family name, not just one word', () => {
    expect(splitName('Ines Marchetti Rossi')).toEqual({
      firstName: 'Ines',
      lastName: 'Marchetti Rossi',
    });
  });

  it('writes NOTHING for a blank name — an empty column would read as "they declined"', () => {
    expect(splitName('')).toEqual({});
    expect(splitName('   ')).toEqual({});
    expect(splitName(null)).toEqual({});
    expect(splitName(undefined)).toEqual({});
  });

  it('does not leave the padding somebody typed on the value', () => {
    expect(splitName('  Rowan   Pike  ')).toEqual({ firstName: 'Rowan', lastName: 'Pike' });
  });
});

describe('readRecipientName', () => {
  it('finds the name checkout stored on the address', () => {
    expect(readRecipientName({ recipientName: 'Rowan Pike', city: 'Riverton' })).toBe('Rowan Pike');
  });

  it('returns null rather than throwing on anything that is not an address', () => {
    expect(readRecipientName(null)).toBeNull();
    expect(readRecipientName(undefined)).toBeNull();
    expect(readRecipientName('Rowan Pike')).toBeNull();
    expect(readRecipientName({})).toBeNull();
    expect(readRecipientName({ recipientName: 42 })).toBeNull();
  });

  it('treats a blank recipient as absent', () => {
    expect(readRecipientName({ recipientName: '   ' })).toBeNull();
  });
});
