// What a diary block says: a walk-in reads "With Jordan", never a bare name that
// looks like the client's, and a short block draws fewer lines (issue 148).

import { describe, expect, it } from 'vitest';

import { blockWho, linesFor } from './calendar-block-text';

const WALK_IN = { customerName: null, partySize: null, resourceNames: ['Jordan Avery'] };

describe('blockWho', () => {
  it('names the customer first', () => {
    expect(blockWho({ ...WALK_IN, customerName: 'Dana Wells' })).toBe('Dana Wells');
  });

  it('says who a walk-in is WITH, never a bare name that reads as theirs', () => {
    expect(blockWho(WALK_IN)).toBe('With Jordan Avery');
  });
});

describe('linesFor', () => {
  it('draws one line on a half hour and three from an hour', () => {
    expect(linesFor(2)).toBe(1);
    expect(linesFor(3)).toBe(2);
    expect(linesFor(4)).toBe(3);
  });
});
