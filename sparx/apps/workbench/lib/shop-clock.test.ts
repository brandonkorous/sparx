import { afterEach, describe, expect, it } from 'vitest';

import { formatShopDateTime, setShopClock } from './shop-clock';

// Sparx persona issue 333: Gillett's payment at 09:28 UTC read 2:28 AM on a
// computer set to Pacific time. In Bluffdale it was 3:28 AM.
describe('formatShopDateTime', () => {
  afterEach(() => setShopClock(null));

  it('shows a moment on the shop’s clock, wherever the computer is', () => {
    setShopClock('America/Denver');
    expect(formatShopDateTime('2026-10-18T09:28:58.393Z')).toContain('3:28');
    setShopClock('America/New_York');
    expect(formatShopDateTime('2026-10-18T09:28:58.393Z')).toContain('5:28');
  });

  it('shows a dash for nothing, or for something that is not a date', () => {
    expect(formatShopDateTime(null)).toBe('—');
    expect(formatShopDateTime('not a date')).toBe('—');
  });

  it('falls back to this computer’s clock for a zone the browser does not know', () => {
    setShopClock('Not/AZone');
    expect(formatShopDateTime('2026-10-18T09:28:58.393Z')).toMatch(/2026/);
  });
});
