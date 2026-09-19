import { describe, expect, it } from 'vitest';
import { questionAuthorName, reviewAuthorName } from './review-author-words';

// 85 of the 111 reviews published on live websites carry no signed name, across
// 8 businesses. The review card rendered nothing for them — stars, a badge and a
// date with nobody attached — while the question card one file away already said
// "A customer asked" (issue 641).

describe('the name under a published review', () => {
  it('never leaves a review with nobody attached', () => {
    expect(reviewAuthorName(null)).toBe('A customer');
    expect(reviewAuthorName(undefined)).toBe('A customer');
    expect(reviewAuthorName('')).toBe('A customer');
    expect(reviewAuthorName('   ')).toBe('A customer');
  });

  it('uses the name they signed with when they gave one', () => {
    expect(reviewAuthorName('Tessa Wren')).toBe('Tessa Wren');
  });

  it('gives every unnamed review the same words, so no account can leak through', () => {
    // The fallback is a plain noun on purpose: somebody who left no name never
    // agreed to their full name appearing under their words. The only way in is
    // the signed name, so there is nothing else this could print.
    expect(reviewAuthorName(null)).toBe(reviewAuthorName(''));
    expect(reviewAuthorName(null)).toBe(reviewAuthorName('   '));
    expect(reviewAuthorName(null)).toBe('A customer');
  });
});

describe('the name above a question', () => {
  it('keeps the wording it already had', () => {
    expect(questionAuthorName(null)).toBe('A customer asked');
    expect(questionAuthorName('Tomas Villalobos')).toBe('Tomas Villalobos');
  });

  it('answers the same absence the review card does', () => {
    // The pair drifted apart once. They take their fallback from one place now.
    expect(questionAuthorName('')).toContain('A customer');
    expect(reviewAuthorName('')).toContain('A customer');
  });
});
