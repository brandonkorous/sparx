// A place with no zone of its own follows the business, and says so (the rule
// the Sparx console was missing; sparx persona issue 119).

import { describe, expect, it } from 'vitest';

import { followLabel } from './location-draft';

describe('followLabel', () => {
  it('says the place follows the business, and when the business has no zone', () => {
    expect(followLabel(null)).toBe('Same as your business (not set yet)');
    expect(followLabel(undefined)).toBe('Same as your business');
    expect(followLabel('America/Denver')).toContain('Same as your business (');
  });
});
