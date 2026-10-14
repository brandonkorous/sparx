// The formatting toolbar is one Tab stop with the arrows inside it, not fourteen
// stops between a standfirst and a body (P09, issue 953).

import { describe, expect, it } from 'vitest';

import { nextToolIndex } from './toolbar-keys';

describe('nextToolIndex', () => {
  it('moves along the row with the arrows, and wraps', () => {
    expect(nextToolIndex('ArrowRight', 0, 14)).toBe(1);
    expect(nextToolIndex('ArrowRight', 13, 14)).toBe(0);
    expect(nextToolIndex('ArrowLeft', 0, 14)).toBe(13);
  });

  it('goes to the ends with Home and End', () => {
    expect(nextToolIndex('Home', 7, 14)).toBe(0);
    expect(nextToolIndex('End', 2, 14)).toBe(13);
  });

  it('leaves Tab and every other key alone', () => {
    expect(nextToolIndex('Tab', 3, 14)).toBeNull();
    expect(nextToolIndex('a', 3, 14)).toBeNull();
    expect(nextToolIndex('ArrowRight', 0, 0)).toBeNull();
  });
});
