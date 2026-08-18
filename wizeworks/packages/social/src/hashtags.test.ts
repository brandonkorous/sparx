import { describe, expect, it } from 'vitest';

import { normalizeTag, normalizeTags, tagsToText } from './hashtags.js';

// Normalizing is what makes a saved set worth having: "#NewArrival" typed one day and
// "newarrival" the next are the same tag, and a set that quietly holds both is exactly
// the mess this feature exists to remove.

describe('normalizeTag', () => {
  it('drops the leading hash', () => {
    expect(normalizeTag('#sale')).toBe('sale');
  });

  it('drops several leading hashes', () => {
    expect(normalizeTag('##sale')).toBe('sale');
  });

  it('lower-cases, so the same tag typed two ways is one tag', () => {
    expect(normalizeTag('#NewArrival')).toBe('newarrival');
  });

  it('keeps underscores and digits, which platforms allow', () => {
    expect(normalizeTag('#shop_local_2026')).toBe('shop_local_2026');
  });

  it('strips punctuation a platform would end the tag at', () => {
    expect(normalizeTag('#sale!')).toBe('sale');
    expect(normalizeTag('#one-two')).toBe('onetwo');
  });

  it('keeps non-Latin letters', () => {
    expect(normalizeTag('#café')).toBe('café');
  });

  it('returns null for something that is not a tag at all', () => {
    expect(normalizeTag('#')).toBeNull();
    expect(normalizeTag('   ')).toBeNull();
    expect(normalizeTag('!!!')).toBeNull();
  });
});

describe('normalizeTags', () => {
  it('de-duplicates after normalizing', () => {
    expect(normalizeTags(['#Sale', 'sale', '#SALE'])).toEqual(['sale']);
  });

  it('preserves order — the first tags are the ones that survive a platform cap', () => {
    expect(normalizeTags(['#b', '#a', '#c'])).toEqual(['b', 'a', 'c']);
  });

  it('drops unusable entries instead of keeping empty ones', () => {
    expect(normalizeTags(['#ok', '', '#', '!!'])).toEqual(['ok']);
  });

  it('caps the size of a set', () => {
    const many = Array.from({ length: 100 }, (_, i) => `#tag${String(i)}`);
    expect(normalizeTags(many)).toHaveLength(60);
  });
});

describe('tagsToText', () => {
  it('renders the block that actually goes in a post', () => {
    expect(tagsToText(['sale', 'newarrival'])).toBe('#sale #newarrival');
  });

  it('is empty for an empty set', () => {
    expect(tagsToText([])).toBe('');
  });
});
