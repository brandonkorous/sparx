// A place with no zone of its own follows the business, and says so. The form
// showed a blank box (and fed React a null value) while the booking page quietly
// used the business's zone (sparx persona issue 119).

import { describe, expect, it } from 'vitest';

import { followBusinessLabel } from './setup-data';

describe('followBusinessLabel', () => {
  it('names the business zone it follows', () => {
    // In words, not the raw zone name (issue 286).
    expect(followBusinessLabel('America/Denver')).toBe('Same as your business (Mountain time)');
  });

  it('says when the business has no zone either, and while it loads', () => {
    expect(followBusinessLabel(null)).toBe('Same as your business (not set yet)');
    expect(followBusinessLabel(undefined)).toBe('Same as your business');
  });
});
