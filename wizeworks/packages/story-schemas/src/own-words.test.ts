import { describe, expect, it } from 'vitest';
import { INDUSTRIES, matchIndustries } from './clauses';
import { storyNoun, storySubject } from './model';

describe('matchIndustries', () => {
  it('finds a starter from one word of a longer description', () => {
    expect(matchIndustries('diesel parts and repair').map((i) => i.slug)).toEqual(['auto-parts']);
  });

  it('ignores filler words, so "and" or "shop" alone match nothing', () => {
    expect(matchIndustries('and the shop')).toEqual([]);
  });

  it('lists every starter for an empty query', () => {
    expect(matchIndustries('  ')).toBe(INDUSTRIES);
  });
});

describe('storyNoun', () => {
  it("prints the owner's own words verbatim", () => {
    const s = { industry: 'generic', industryLabel: 'diesel parts and repair' };
    expect(storyNoun(s)).toBe('diesel parts and repair');
    expect(storySubject(s)).toBe('diesel parts and repair');
  });

  it("falls back to the starter's noun, then to a business", () => {
    expect(storyNoun({ industry: 'salon' })).toBe('a salon');
    expect(storySubject({ industry: 'salon' })).toBe('salon');
    expect(storyNoun({ industry: null, industryLabel: '   ' })).toBe('a business');
  });
});
