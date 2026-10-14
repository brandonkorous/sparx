// The save rule and the website rule for a kind's web address must agree.
//
// `@wizeworks/cms` refuses a pattern on save (`urlPatternProblem`); the website serves
// a kind's pieces at the patterns `@wizeworks/silica-catalog` accepts
// (`kindAddressFromPattern`). The cms package cannot import the catalog, so the rule is
// written twice. This package depends on both, so this is where they are held together:
// a pattern one accepts and the other refuses is either a kind that saves and 404s, or
// a kind the website could serve that nobody can save.

import { describe, expect, it } from 'vitest';
import { RESERVED_ADDRESS_WORDS, urlPatternProblem } from '@wizeworks/cms';
import { RESERVED_KIND_SEGMENTS, kindAddressFromPattern } from '@wizeworks/silica-catalog';

const PATTERNS = [
  '/articles/{slug}',
  '/recipes/{slug}',
  '/journal/field-notes/{slug}',
  '/case-studies/{slug}',
  '/a1/{slug}',
  '/{slug}',
  '/articles/{slug}/',
  '/articles',
  'articles/{slug}',
  '/Articles/{slug}',
  '/my articles/{slug}',
  '/articles//{slug}',
  '/articles/{slug}/more',
  '/{slug}/{slug}',
  '/-x/{slug}',
  'C:/Program Files/Git/articles/{slug}',
  ...RESERVED_KIND_SEGMENTS.map((w) => `/${w}/{slug}`),
  ...RESERVED_KIND_SEGMENTS.map((w) => `/journal/${w}/{slug}`),
];

describe('a kind web address: what saves is what the website serves', () => {
  it.each(PATTERNS)('%s', (pattern) => {
    const saves = urlPatternProblem(pattern) === null;
    const served = kindAddressFromPattern(pattern) !== null;
    expect({ pattern, saves }).toEqual({ pattern, saves: served });
  });

  it('reserves the same first words', () => {
    expect([...RESERVED_ADDRESS_WORDS].sort()).toEqual([...RESERVED_KIND_SEGMENTS].sort());
  });

  it('lets an empty pattern save, meaning "no page"', () => {
    expect(urlPatternProblem('')).toBeNull();
    expect(urlPatternProblem(null)).toBeNull();
  });
});
