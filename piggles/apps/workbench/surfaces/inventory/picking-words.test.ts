import { describe, expect, it } from 'vitest';
import { pickingRate } from './picking-data';

describe('the headline picking rate', () => {
  it('refuses to print a rate for a walk done too fast to measure', () => {
    // Measured as P03: one unit picked in a few seconds read
    // "0.0 units an hour · 1 unit over 0 hours of picking" — a measurement of
    // somebody being infinitely slow, printed for work that actually happened.
    const { value, hint } = pickingRate(1, 0);
    expect(value).toBe('—');
    expect(hint).toContain('too close together in time');
    expect(hint).toContain('1 unit');
  });

  it('counts in minutes while the span is under an hour', () => {
    // "0 hours of picking" was the other half of it: a real twenty minutes
    // rounding to a zero that reads as nothing happening.
    const { value, hint } = pickingRate(30, 20);
    expect(value).toBe('90.0');
    expect(hint).toBe('30 units over 20 minutes of picking.');
  });

  it('counts in hours once there are hours', () => {
    const { value, hint } = pickingRate(240, 120);
    expect(value).toBe('120.0');
    expect(hint).toBe('240 units over 2 hours of picking.');
  });

  it('says so when every line came up short', () => {
    // The screen above refuses to draw at all when nothing was picked OR short,
    // so nothing taken here means the whole window was shorts.
    const { value, hint } = pickingRate(0, 45);
    expect(value).toBe('—');
    expect(hint).toContain('Nothing was actually taken off a shelf');
  });

  it('says one unit and one minute in the singular', () => {
    expect(pickingRate(1, 1).hint).toBe('1 unit over 1 minute of picking.');
    expect(pickingRate(60, 60).hint).toBe('60 units over 1 hour of picking.');
  });
});
