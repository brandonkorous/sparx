import { describe, expect, it } from 'vitest';

import { startingHoursZone } from './hours-zone';

describe('the zone new chat hours start on', () => {
  it('is the business’s, not this computer’s', () => {
    expect(startingHoursZone('Europe/London', 'America/Los_Angeles')).toBe('Europe/London');
  });

  it('is this computer’s only while the business has none', () => {
    expect(startingHoursZone(null, 'America/Los_Angeles')).toBe('America/Los_Angeles');
    expect(startingHoursZone(undefined, 'America/Los_Angeles')).toBe('America/Los_Angeles');
  });
});
