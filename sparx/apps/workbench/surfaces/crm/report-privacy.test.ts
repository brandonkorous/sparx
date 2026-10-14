// What a board says about a report kept to its maker (persona issue 264).

import { describe, expect, it } from 'vitest';

import {
  keptToItsMaker,
  PRIVATE_CARD_WORDS,
  PRIVATE_ON_SHARED_WARNING,
} from './report-builder-data';

const DOTY = '0d07a000-0000-4000-8000-000000000001';

describe('a report kept to its maker', () => {
  it('is one with sharing off and a maker', () => {
    expect(keptToItsMaker({ shared: false, ownerId: DOTY })).toBe(true);
  });

  it('is not a shared one, nor one of the business’s own', () => {
    expect(keptToItsMaker({ shared: true, ownerId: DOTY })).toBe(false);
    expect(keptToItsMaker({ shared: false, ownerId: null })).toBe(false);
  });
});

describe('the words', () => {
  it('are one plain sentence each', () => {
    for (const words of [PRIVATE_CARD_WORDS, PRIVATE_ON_SHARED_WARNING]) {
      expect(words.match(/[.!?]/g)).toHaveLength(1);
      expect(words.endsWith('.')).toBe(true);
      expect(words).not.toMatch(/[—–]/);
    }
  });

  it('tell a teammate whose choice it was, and the maker what teammates will see', () => {
    expect(PRIVATE_CARD_WORDS).toBe(
      'This card shows a report kept private by the person who made it.'
    );
    expect(PRIVATE_ON_SHARED_WARNING).toContain('teammates');
    expect(PRIVATE_ON_SHARED_WARNING).toContain('not its name or numbers');
  });
});
