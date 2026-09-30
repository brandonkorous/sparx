// ONE SHIRT, THREE DIFFERENT NUMBERS.
//
// Juniper Row had exactly one version nobody had counted, and the band over her
// stock list managed to be singular, plural and singular again inside one
// paragraph, then offer a button in the wrong number (issue 856).
//
// The property below is the one that matters and it is deliberately blunt: for
// one version, NOTHING the band says may be plural. It reads as obvious, and it
// is the assertion the shipped code failed.

import { describe, expect, it } from 'vitest';
import { uncountedWords, type UncountedWords } from './uncounted-words';

/** Words that give a plural away, whatever sentence they are hiding in. */
const PLURAL = /\b(they|them|their|these|are not below)\b/i;
const SINGULAR = /\b(it|its|this one|is not below)\b/i;

/** Which of the band's sentences match, named, so a failure says WHICH one. */
function sentencesMatching(words: UncountedWords, pattern: RegExp): string[] {
  const keys = Object.keys(words) as (keyof UncountedWords)[];
  return keys.filter((key) => pattern.test(words[key]));
}

describe('uncountedWords, for exactly one version', () => {
  it('never says a plural word, in any of its sentences', () => {
    const words = uncountedWords(1, false);
    expect(sentencesMatching(words, PLURAL)).toEqual([]);
  });

  it('never says a plural word while she is searching either', () => {
    // The search branch is a second copy of the same sentence, and a second
    // place for the number to be forgotten.
    const words = uncountedWords(1, true);
    expect(sentencesMatching(words, PLURAL)).toEqual([]);
  });

  it('offers a button she can read', () => {
    expect(uncountedWords(1, false).action).toBe('Count it');
  });

  it('counts the one in its heading', () => {
    expect(uncountedWords(1, false).title).toBe('1 version you sell has never been counted');
  });

  it('says where it is, in the singular', () => {
    expect(uncountedWords(1, false).whereTheyAre).toBe(
      'This list only holds what you have counted, so it is not below.'
    );
    expect(uncountedWords(1, true).whereTheyAre).toBe(
      'Your search matched it, but this list only holds what you have counted, so it is not below.'
    );
  });
});

describe('uncountedWords, for several', () => {
  it('never says a singular word, in any of its sentences', () => {
    // The mirror of the property above, so a fix in one direction cannot quietly
    // break the other.
    for (const total of [2, 5, 47]) {
      const words = uncountedWords(total, false);
      expect(sentencesMatching(words, SINGULAR), `${String(total)} versions`).toEqual([]);
    }
  });

  it('counts them in its heading', () => {
    expect(uncountedWords(5, false).title).toBe('5 versions you sell have never been counted');
  });

  it('offers the plural button', () => {
    expect(uncountedWords(5, false).action).toBe('Count them');
  });

  it('says where they are, searching or not', () => {
    expect(uncountedWords(5, false).whereTheyAre).toBe(
      'This list only holds what you have counted, so they are not below.'
    );
    expect(uncountedWords(5, true).whereTheyAre).toContain('Your search matched them');
  });
});

describe('the band says four things and they all carry number', () => {
  it('has no sentence that forgot to have two forms', () => {
    // The shape of the original bug: a sentence that is byte-identical for one
    // and for many is a sentence nobody gave a number to. Adding a fifth to the
    // band without a singular form fails here.
    const one = uncountedWords(1, false);
    const many = uncountedWords(4, false);

    const same = Object.keys(one).filter(
      (key) => one[key as keyof typeof one] === many[key as keyof typeof many]
    );
    expect(same).toEqual([]);
  });
});
