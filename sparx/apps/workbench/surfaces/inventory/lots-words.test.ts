import { describe, expect, it } from 'vitest';
import { endsSentence, soldUnitsLine } from './lots-data';

describe('ending somebody’s own words', () => {
  it('does not add a second full stop to a sentence that has one', () => {
    // Measured on screen: a recall reason typed as a proper sentence rendered
    // "Do not put any of it on a belt.. Raised 2 minutes ago." The field asks
    // for a sentence, so writing one must not be punished.
    expect(endsSentence('Do not put any of it on a belt.')).toBe('Do not put any of it on a belt.');
  });

  it('adds one to words that stop without any', () => {
    expect(endsSentence('Lacquer flakes off')).toBe('Lacquer flakes off.');
  });

  it('leaves a question or a shout exactly as it was written', () => {
    // Replacing these with a period would edit what she wrote.
    expect(endsSentence('Is this the same run?')).toBe('Is this the same run?');
    expect(endsSentence('Do not ship any of this!')).toBe('Do not ship any of this!');
    expect(endsSentence('It just stops…')).toBe('It just stops…');
  });

  it('gives nothing back for nothing, so the sentence around it can drop out', () => {
    expect(endsSentence('')).toBe('');
    expect(endsSentence('   ')).toBe('');
  });

  it('trims, so a trailing space does not push the next sentence along', () => {
    expect(endsSentence('  Lacquer flakes off  ')).toBe('Lacquer flakes off.');
  });
});

describe('how much of a recalled batch is already out', () => {
  it('reads correctly for exactly one unit', () => {
    // "with the order each one left on" is fine for six and wrong for one. The
    // sentence used to be a plural-only phrase wrapped around plural(), which
    // provenance-copy.test.ts exists to catch, and did.
    expect(soldUnitsLine(1)).toBe(
      '1 unit from it has already gone to a customer. It is listed below, with the order it left on.'
    );
  });

  it('reads correctly for several', () => {
    expect(soldUnitsLine(6)).toContain('6 units');
    expect(soldUnitsLine(6)).toContain('each one');
  });

  it('says plainly that none went out, rather than printing a zero', () => {
    expect(soldUnitsLine(0)).toBe('No individually-numbered unit from it has been sold.');
  });

  it('treats a negative the same as none, so a bad count cannot invent customers', () => {
    expect(soldUnitsLine(-2)).toBe('No individually-numbered unit from it has been sold.');
  });
});
