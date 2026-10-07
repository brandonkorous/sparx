// Which shared screens this console does not have.
//
// The list is kept by hand, and an entry going missing renders exactly like a
// screen that belongs here: the launcher offers it and it opens. Each entry
// below was found by a persona reaching the screen, so each one is pinned.

import { describe, expect, it } from 'vitest';
import { hiddenBy } from '../product';
import { PIGGLES_HIDDEN_SURFACES } from './hidden';

const hidden = (key: string) => hiddenBy(PIGGLES_HIDDEN_SURFACES, key);

describe('the screens Piggles does not have', () => {
  it('hides sparx setup, because getpiggles sets every business up first (issue 935)', () => {
    expect(hidden('workbench.onboarding')).toBe(true);
    expect(hidden('workbench.onboarding.story')).toBe(true);
  });

  it('keeps Get set up, where somebody searching "set up" should land', () => {
    expect(hidden('workbench.welcome')).toBe(false);
  });

  it('hides the whole sparx partner programme, including the pane missed once (issue 002)', () => {
    expect(hidden('partner.bootcamp.detail')).toBe(true);
    expect(hidden('finance.subscription')).toBe(true);
  });
});
