import { describe, expect, it } from 'vitest';
import { scopeLine } from './site-scope-words';

describe('what each site switch covers (issue 944)', () => {
  it('tells the three Sell modules apart', () => {
    const lines = ['commerce', 'b2b', 'dropship'].map(scopeLine);
    expect(new Set(lines).size).toBe(3);
    expect(lines.every((line) => line.length > 0)).toBe(true);
  });

  it('does not promise a visitor-facing change where there is none', () => {
    expect(scopeLine('email')).toContain('Visitors see no difference');
  });

  it('covers bookings', () => {
    expect(scopeLine('scheduling')).toContain('Booking pages');
  });
});
