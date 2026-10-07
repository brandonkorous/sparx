import { describe, expect, it } from 'vitest';
import { stillWaiting } from './published-words';

describe('pages still waiting after one publish (issue 939)', () => {
  it('says nothing when nothing is waiting', () => {
    expect(stillWaiting(0)).toBeNull();
  });

  it('counts the pages that are saved and not live', () => {
    expect(stillWaiting(1)).toBe('1 other page is saved and not live yet.');
    expect(stillWaiting(4)).toBe('4 other pages are saved and not live yet.');
  });
});
