// What a kind's web address pattern may say, and the reason given when it may not.
//
// The reasons are read by the person who typed the pattern, so they are pinned word for
// word where they name her mistake. Which patterns pass is pinned against the website's
// own rule in api-rest's `kind-address-agreement.test.ts`.

import { describe, expect, it } from 'vitest';

import { samePatternAddress, urlPatternProblem } from './url-pattern.js';

describe('urlPatternProblem', () => {
  it('accepts an address the website serves, and an empty box', () => {
    expect(urlPatternProblem('/articles/{slug}')).toBeNull();
    expect(urlPatternProblem('/journal/field-notes/{slug}')).toBeNull();
    expect(urlPatternProblem('  /recipes/{slug}  ')).toBeNull();
    expect(urlPatternProblem('')).toBeNull();
    expect(urlPatternProblem(null)).toBeNull();
  });

  it('refuses what a shell made of /articles/{slug} on a test machine', () => {
    expect(urlPatternProblem('C:/Program Files/Git/articles/{slug}')).toMatch(/starts with "\/"/);
  });

  it('refuses a pattern with no place for each one’s own name', () => {
    expect(urlPatternProblem('/articles')).toMatch(/ends with \/\{slug\}/);
    expect(urlPatternProblem('/articles/{slug}/more')).toMatch(/ends with \/\{slug\}/);
  });

  it('refuses a pattern that would take the pages’ own addresses', () => {
    expect(urlPatternProblem('/{slug}')).toMatch(/Put a word before \{slug\}/);
  });

  it('names a word that cannot be in an address', () => {
    expect(urlPatternProblem('/My Articles/{slug}')).toBe(
      '"My Articles" cannot be part of a web address. Use lowercase letters, numbers and hyphens. Write it like /articles/{slug}.'
    );
  });

  it('says which of the website’s own words was taken', () => {
    expect(urlPatternProblem('/products/{slug}')).toBe(
      'Your website already uses /products for its own pages. Pick another word.'
    );
  });

  it('refuses a doubled slash', () => {
    expect(urlPatternProblem('/articles//{slug}')).toMatch(/one "\/" between words/);
  });
});

describe('samePatternAddress', () => {
  it('treats a trailing slash as the same address', () => {
    expect(samePatternAddress('/news/{slug}', '/news/{slug}/')).toBe(true);
    expect(samePatternAddress('/news/{slug}', '/press/{slug}')).toBe(false);
    expect(samePatternAddress(null, null)).toBe(false);
  });
});
