// Sparx persona issue 355: three walks over six injectors said 16 were missing.

import { describe, expect, it } from 'vitest';

import { stillShort } from './still-short';

describe('stillShort', () => {
  it('is what the newest walk could not find', () => {
    expect(stillShort([4, 6, 6])).toBe(4);
  });

  it('is nothing once the newest walk found them all', () => {
    expect(stillShort([0, 6])).toBe(0);
  });

  it('is nothing for a line never walked', () => {
    expect(stillShort(null)).toBe(0);
    expect(stillShort([])).toBe(0);
  });
});
