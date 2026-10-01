// One arrow press, one column (issue 912).

import { describe, expect, it } from 'vitest';
import { columnStep, nextColumnId } from './board-keyboard';

const COLUMNS = ['New inquiry', 'Worth pursuing', 'Quote sent', 'Won'];

describe('nextColumnId', () => {
  it('moves one column right', () => {
    expect(nextColumnId(COLUMNS, 'New inquiry', 1)).toBe('Worth pursuing');
  });

  it('moves one column left', () => {
    expect(nextColumnId(COLUMNS, 'Quote sent', -1)).toBe('Worth pursuing');
  });

  it('stays put at either end rather than sliding off the board', () => {
    expect(nextColumnId(COLUMNS, 'New inquiry', -1)).toBeNull();
    expect(nextColumnId(COLUMNS, 'Won', 1)).toBeNull();
  });

  it('goes nowhere from a column that is not on screen', () => {
    // A narrow pane shows one column; the card's own column is the only one.
    expect(nextColumnId(['Quote sent'], 'Quote sent', 1)).toBeNull();
    expect(nextColumnId(['Quote sent'], 'Lost', 1)).toBeNull();
  });
});

describe('columnStep', () => {
  it('reads left and right, and nothing else', () => {
    expect(columnStep('ArrowRight')).toBe(1);
    expect(columnStep('ArrowLeft')).toBe(-1);
    expect(columnStep('ArrowDown')).toBeNull();
    expect(columnStep('Space')).toBeNull();
  });
});
