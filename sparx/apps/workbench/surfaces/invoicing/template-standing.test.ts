// Two booleans, four outcomes, and the two that matter are the ones that mean
// "your customers are not getting this."
//
// A default that was never published is the quiet failure: the owner chose their
// letterhead, the row said "Default", and every bill went out on the built-in
// layout regardless. The badge has to say so out loud, so these assertions are
// about the WORDS as much as the branch.

import { describe, expect, it } from 'vitest';
import { templateStanding } from './template-standing';

describe('what a customer actually gets', () => {
  it('is in force only when it is both chosen and published', () => {
    const inUse = templateStanding({ isDefault: true, published: true });
    expect(inUse.inForce).toBe(true);
    expect(inUse.label).toBe('In use');
    expect(inUse.tone).toBe('success');
  });

  it('warns when the chosen one was never published', () => {
    const chosen = templateStanding({ isDefault: true, published: false });
    expect(chosen.inForce).toBe(false);
    expect(chosen.tone).toBe('warning');
    // The sentence has to name the consequence, not the flag.
    expect(chosen.sentence).toContain('customers still get the standard layout');
    expect(chosen.sentence).toContain('Publish');
  });

  it('says a published one that is not chosen is not in use', () => {
    const ready = templateStanding({ isDefault: false, published: true });
    expect(ready.inForce).toBe(false);
    expect(ready.label).toBe('Ready');
    expect(ready.sentence).toContain('not the one in use');
  });

  it('gives a draft no color, because a draft is not a state it is in', () => {
    const draft = templateStanding({ isDefault: false, published: false });
    expect(draft.inForce).toBe(false);
    expect(draft.tone).toBeNull();
  });

  it('names the business when there is one to name', () => {
    expect(
      templateStanding({ isDefault: true, published: true, propertyName: 'Trade counter' }).sentence
    ).toContain('for Trade counter');
    // And says nothing extra on an account with one business, where a
    // qualification would be noise.
    expect(templateStanding({ isDefault: true, published: true }).sentence).toBe(
      'This is what your customers get.'
    );
  });

  it('never reduces to a bare flag name', () => {
    for (const isDefault of [true, false]) {
      for (const published of [true, false]) {
        const standing = templateStanding({ isDefault, published });
        expect(standing.label).not.toBe('Default');
        expect(standing.label).not.toBe('Published');
        expect(standing.sentence.endsWith('.')).toBe(true);
      }
    }
  });
});
