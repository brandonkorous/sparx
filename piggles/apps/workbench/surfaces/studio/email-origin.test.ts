// TWO ROWS WITH ONE NAME MUST NOT LOOK THE SAME.
//
// Measured 2026-09-17: 13 tenants hold two emails sharing a name. `nextFreeName`
// stops new ones from colliding; it cannot repair the ones already written.

import { describe, expect, it } from 'vitest';

import { emailOriginNote } from './email-origin';

/** Her account, as the list receives it. */
const builtIn = { name: 'Welcome', key: 'welcome-customer' };
const copy = { name: 'Welcome', key: null };
const winBack = { name: 'Win-back', key: 'win-back' };
const all = [builtIn, copy, winBack];

describe('when two rows share a name', () => {
  it('tells them apart', () => {
    expect(emailOriginNote(builtIn, all)).toBe('Comes with Piggles');
    expect(emailOriginNote(copy, all)).toBe('A copy on your account');
  });

  it('gives them DIFFERENT lines, which is the entire job', () => {
    // A note that read the same on both would be decoration.
    expect(emailOriginNote(builtIn, all)).not.toBe(emailOriginNote(copy, all));
  });
});

describe('when a name stands on its own', () => {
  it('says nothing, so the note stays a signal', () => {
    expect(emailOriginNote(winBack, all)).toBe(null);
  });

  it('says nothing on a tidy account, even for a built-in', () => {
    const tidy = [{ name: 'Welcome', key: 'welcome-customer' }];
    expect(emailOriginNote(tidy[0]!, tidy)).toBe(null);
  });
});

describe('it states where it came from, not what it does', () => {
  it('never promises that anything will be sent', () => {
    // A keyed email whose automation is paused sends nothing, so a line saying
    // "Piggles sends this one for you" would be false on a real account.
    for (const email of all) {
      expect(emailOriginNote(email, all) ?? '').not.toMatch(/send|will|automatic/i);
    }
  });
});

describe('three of a name', () => {
  it('still marks the built-in one out from the copies', () => {
    const crowded = [
      { name: 'Welcome', key: 'welcome-customer' },
      { name: 'Welcome', key: null },
      { name: 'Welcome', key: null },
    ];
    expect(emailOriginNote(crowded[0]!, crowded)).toBe('Comes with Piggles');
    expect(emailOriginNote(crowded[1]!, crowded)).toBe('A copy on your account');
  });
});
