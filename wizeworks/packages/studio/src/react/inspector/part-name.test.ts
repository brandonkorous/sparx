import { describe, expect, it } from 'vitest';
import { partName } from './settings-tab';

describe('partName', () => {
  it('takes what an owner would actually type', () => {
    expect(partName('Our cakes')).toBe('our-cakes');
    expect(partName('Ask about a cake')).toBe('ask-about-a-cake');
  });

  it('collapses runs of punctuation rather than leaving a trail of hyphens', () => {
    expect(partName('Bread &  Rye!!')).toBe('bread-rye');
  });

  it('never leaves a leading or trailing hyphen — `#-cakes-` matches nothing', () => {
    expect(partName('  cakes  ')).toBe('cakes');
    expect(partName('--cakes--')).toBe('cakes');
  });

  it('returns empty for a name with nothing usable in it, so the id is removed', () => {
    expect(partName('   ')).toBe('');
    expect(partName('!!!')).toBe('');
  });

  it('is idempotent — re-saving an unchanged field does not rewrite it', () => {
    expect(partName(partName('Our cakes'))).toBe('our-cakes');
  });
});
