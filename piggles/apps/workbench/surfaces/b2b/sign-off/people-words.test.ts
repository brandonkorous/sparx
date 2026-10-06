// How a list of names is joined, the same way the server's refusal joins them.
import { describe, expect, it } from 'vitest';
import { peopleWords } from './people-words';

describe('peopleWords', () => {
  it('joins names the way the server refusal does', () => {
    expect(peopleWords(['A'])).toBe('A');
    expect(peopleWords(['A', 'B'])).toBe('A or B');
    expect(peopleWords(['A', 'B', 'C'])).toBe('A, B, or C');
  });
});
