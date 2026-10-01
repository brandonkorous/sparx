// What one linked record is called, on its badge (issue 914).

import { describe, expect, it } from 'vitest';
import { OBJECT_LABELS, objectSingular } from './associations-data';

describe('objectSingular', () => {
  it('names one of each built-in kind', () => {
    expect(objectSingular('contact')).toBe('Person');
    expect(objectSingular('company')).toBe('Company');
    expect(objectSingular('deal')).toBe('Deal');
    expect(objectSingular('ticket')).toBe('Request');
  });

  it('has a name for every kind that has a heading', () => {
    // A new kind given a heading and no single name would fall through to its
    // raw key on the badge.
    for (const key of Object.keys(OBJECT_LABELS)) {
      expect(objectSingular(key)).not.toBe(key);
    }
  });

  it('reads a kind a business made up as words', () => {
    expect(objectSingular('trade_show')).toBe('trade show');
  });
});
