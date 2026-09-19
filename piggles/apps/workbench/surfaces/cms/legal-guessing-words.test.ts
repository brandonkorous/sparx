// A COUNT AND THE NOUN IT IS ATTACHED TO MUST AGREE.
//
// The banner's subject is the REQUIRED pages ("Every page you are expected to
// have…"), and the count that followed was over every page on the screen. The
// account it was found on had four clean required pages and one optional page
// still carrying the starter's guesses, so the banner said one of the four was
// marked and none of them was.

import { describe, expect, it } from 'vitest';

import { guessingLine } from './legal-guessing-words';

describe('when every page is in her own words', () => {
  it('says nothing at all', () => {
    expect(guessingLine({ required: 0, optional: 0 })).toBe(null);
  });
});

describe('when only an OPTIONAL page still guesses', () => {
  it('does not claim it is one of the required ones', () => {
    // The exact case on screen. "1 of them" sent her to four rows with no mark.
    const line = guessingLine({ required: 0, optional: 1 });
    expect(line).toBe(
      '1 of your optional pages still says things we guessed about your business. It is marked below.'
    );
    expect(line).not.toContain('of them');
  });
});

describe('when only a REQUIRED page still guesses', () => {
  it('says "of them", which is what the sentence before it named', () => {
    expect(guessingLine({ required: 1, optional: 0 })).toBe(
      '1 of them still says things we guessed about your business. It is marked below.'
    );
  });

  it('agrees with itself in the plural', () => {
    expect(guessingLine({ required: 3, optional: 0 })).toBe(
      '3 of them still say things we guessed about your business. They are marked below.'
    );
  });
});

describe('when both do', () => {
  it('counts them separately, because they are two different nouns', () => {
    expect(guessingLine({ required: 2, optional: 1 })).toBe(
      '2 of them and 1 of your optional pages still say things we guessed about your business. They are marked below.'
    );
  });
});

describe('one row, or several', () => {
  it('says "It is marked below" for exactly one, wherever it is', () => {
    // A screen that says "They are" over a single row reads as though nobody is
    // reading it back.
    expect(guessingLine({ required: 1, optional: 0 })).toContain('It is marked below.');
    expect(guessingLine({ required: 0, optional: 1 })).toContain('It is marked below.');
    expect(guessingLine({ required: 1, optional: 1 })).toContain('They are marked below.');
  });
});
