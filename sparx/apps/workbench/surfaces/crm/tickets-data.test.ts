// A promise typed in working minutes, read back in words (issue 913).

import { describe, expect, it } from 'vitest';
import { workingTimeWords } from './tickets-data';

describe('workingTimeWords', () => {
  it('reads whole hours as hours', () => {
    expect(workingTimeWords('60')).toBe('1 working hour');
    expect(workingTimeWords('480')).toBe('8 working hours');
    expect(workingTimeWords('2400')).toBe('40 working hours');
  });

  it('keeps the minutes left over', () => {
    expect(workingTimeWords('90')).toBe('1 working hour 30 minutes');
    expect(workingTimeWords('61')).toBe('1 working hour 1 minute');
  });

  it('reads less than an hour as minutes', () => {
    expect(workingTimeWords('45')).toBe('45 working minutes');
    expect(workingTimeWords('1')).toBe('1 working minute');
  });

  it('says nothing for an empty or unusable box, rather than a guess', () => {
    expect(workingTimeWords('')).toBeNull();
    expect(workingTimeWords('0')).toBeNull();
    expect(workingTimeWords('-5')).toBeNull();
    expect(workingTimeWords('soon')).toBeNull();
  });
});
