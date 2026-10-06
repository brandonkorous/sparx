import { describe, expect, it } from 'vitest';
import { parsePercent, percentText } from './tax-rate';

// The tax box takes a percentage the way an owner says it (sparx persona issue
// 077) and stores the same fraction the document always held.

describe('parsePercent', () => {
  it('reads 8.75 as the fraction 0.0875', () => {
    expect(parsePercent('8.75')).toBe(0.0875);
    expect(parsePercent('8.75%')).toBe(0.0875);
    expect(parsePercent(' 7 ')).toBe(0.07);
  });

  it('stores a clean fraction, not a floating point tail', () => {
    // 6.85 / 100 is 0.06849999999999999 in floating point.
    expect(parsePercent('6.85')).toBe(0.0685);
  });

  it('reads an empty box as no tax', () => {
    expect(parsePercent('')).toBe(0);
  });

  it('refuses what is not a rate', () => {
    expect(parsePercent('abc')).toBeNull();
    expect(parsePercent('8,75')).toBeNull();
    expect(parsePercent('150')).toBeNull();
    expect(parsePercent('-5')).toBeNull();
  });
});

describe('percentText', () => {
  it('shows the stored fraction as a percentage', () => {
    expect(percentText(0.0875)).toBe('8.75');
    expect(percentText(0)).toBe('0');
    expect(percentText(0.07)).toBe('7');
  });

  it('round-trips', () => {
    for (const typed of ['8.75', '6.85', '7', '0', '10.5']) {
      expect(percentText(parsePercent(typed) ?? -1)).toBe(typed);
    }
  });
});
