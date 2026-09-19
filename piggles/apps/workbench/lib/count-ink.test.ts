import { describe, expect, it } from 'vitest';
import { countClass, countInk } from './count-ink';

describe('a count that means "here is a problem"', () => {
  it('wears the color when there is something to see', () => {
    expect(countInk(1, 'text-danger')).toBe('text-danger');
    expect(countInk(74, 'text-warning')).toBe('text-warning');
  });

  it('does not wear it at zero', () => {
    // A red 0 beside a blue 0 beside an amber 1 sends the eye to the number
    // that says nothing went wrong.
    expect(countInk(0, 'text-danger')).toBe('');
    expect(countInk(0, 'text-warning')).toBe('');
    expect(countInk(0, 'text-info')).toBe('');
  });

  it('never fades it instead', () => {
    // A zero is still a figure she is meant to read. Reaching for `text-soft`
    // or an opacity here would break RULE #3 to fix RULE #4.
    for (const ink of ['text-danger', 'text-warning', 'text-info', 'text-success']) {
      const quiet = countInk(0, ink);
      expect(quiet).not.toContain('soft');
      expect(quiet).not.toContain('muted');
      expect(quiet).not.toContain('/');
    }
  });

  it('treats a negative count as nothing to shout about', () => {
    // No caller passes one today. If a subtraction ever produces one, a red
    // minus number is a second bug on top of the first, not a warning.
    expect(countInk(-3, 'text-danger')).toBe('');
  });
});

describe('countClass', () => {
  it('keeps size and weight whichever way the count goes', () => {
    const base = 'text-2xl font-semibold tabular-nums';
    expect(countClass(0, base, 'text-danger')).toBe(base);
    expect(countClass(2, base, 'text-danger')).toBe(`${base} text-danger`);
  });

  it('leaves no trailing space when the count is zero', () => {
    // It lands straight in a className, and a stray space is the sort of thing
    // that turns into a snapshot diff later.
    expect(countClass(0, 'text-2xl', 'text-danger')).toBe('text-2xl');
    expect(countClass(0, 'text-2xl', 'text-danger').endsWith(' ')).toBe(false);
  });
});
