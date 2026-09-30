// What a diary block says. Pinned because both rules are sentences a screen
// shows: a walk-in's block read "Jordan Avery", which is the stylist, as if it
// were the customer; and a half-hour block drew three lines and cut them.

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
