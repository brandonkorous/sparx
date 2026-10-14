import { describe, expect, it } from 'vitest';

import { BOARD_COLUMNS, canSee, visibleWhere } from './owner-visibility';

// "Off keeps it to you" (persona issue 264), as one rule both ways it is asked:
// of a row in hand, and as the `where` a list sends.

const DOTY = '0d07a000-0000-4000-8000-000000000001';
const MIKE = '0d07a000-0000-4000-8000-000000000002';

describe('who may see a thing somebody made', () => {
  it('lets its maker see it whether it is shared or not', () => {
    expect(canSee(DOTY, { ownerId: DOTY, shared: false })).toBe(true);
    expect(canSee(DOTY, { ownerId: DOTY, shared: true })).toBe(true);
  });

  it('keeps a private one from a teammate, and shows a shared one', () => {
    expect(canSee(MIKE, { ownerId: DOTY, shared: false })).toBe(false);
    expect(canSee(MIKE, { ownerId: DOTY, shared: true })).toBe(true);
  });

  it('shows everyone what nobody made, like the ready-made reports', () => {
    expect(canSee(MIKE, { ownerId: null, shared: false })).toBe(true);
    expect(canSee(undefined, { ownerId: null, shared: false })).toBe(true);
  });

  it('gives a caller who is not a person nothing private', () => {
    expect(canSee(undefined, { ownerId: DOTY, shared: false })).toBe(false);
    expect(canSee(null, { ownerId: DOTY, shared: true })).toBe(true);
  });
});

describe('the same rule as a query', () => {
  it('asks for shared, unowned, or this person’s own', () => {
    expect(visibleWhere(MIKE, BOARD_COLUMNS)).toEqual({
      OR: [{ shared: true }, { ownerId: null }, { ownerId: MIKE }],
    });
  });

  it('asks a caller with no person for shared or unowned only', () => {
    expect(visibleWhere(undefined, BOARD_COLUMNS)).toEqual({
      OR: [{ shared: true }, { ownerId: null }],
    });
  });

  it('speaks a table’s own column names', () => {
    expect(visibleWhere(MIKE, { owner: 'ownerUserId', shared: 'isShared' })).toEqual({
      OR: [{ isShared: true }, { ownerUserId: null }, { ownerUserId: MIKE }],
    });
  });
});
