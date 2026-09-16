// Whether a surface should be offered — and now, whether it should MOUNT.
//
// This predicate had two callers, the rail and the command palette, and its own
// comment says why it is shared: they must never disagree about what exists. It
// has a third now. A pane opened from a saved layout, a bookmark or a shared
// link bypasses both of those, so until the mount asked the same question a
// switched-off module produced a pane that ran, got a 404 from api-rest's module
// gate, and told a shop "something went wrong reaching the server · try again in
// a moment" — over a button that could not work on the first press or the
// hundredth.
//
// The loading case is the one worth guarding hardest. `null` means the module
// list has not arrived, and answering "switched off" from a list nobody has read
// yet would accuse somebody of a decision they did not make.

import { describe, expect, it } from 'vitest';

import { moduleIsVisible, surfaceIsVisible } from './use-visible-nav';

// Every slug named below must be in here. A module the server has NEVER
// mentioned is treated as visible — it has no flag to be disabled by — so a
// negative assertion about a slug missing from this set proves nothing.
const KNOWN = new Set(['email', 'commerce', 'finance', 'invoicing', 'b2b']);

const surface = (over: Partial<Parameters<typeof surfaceIsVisible>[0]> = {}) => ({
  module: 'email' as const,
  ...over,
});

describe('a surface whose module is switched off', () => {
  it('is not offered', () => {
    expect(surfaceIsVisible(surface(), new Set(['commerce']), KNOWN)).toBe(false);
  });

  it('is offered once the module is back on', () => {
    expect(surfaceIsVisible(surface(), new Set(['commerce', 'email']), KNOWN)).toBe(true);
  });
});

describe('what happens before the module list arrives', () => {
  it('shows the surface rather than accusing anyone of switching it off', () => {
    // `null` is "don't know yet". Reading it as "off" would put the
    // switched-off state in front of every pane on every cold load, which is
    // both wrong and the worst possible first impression of the console.
    expect(surfaceIsVisible(surface(), null, KNOWN)).toBe(true);
    expect(moduleIsVisible('email', null, KNOWN)).toBe(true);
  });

  it('shows a module the server has never mentioned', () => {
    // No server flag to be disabled BY. A module the activation list has not
    // heard of is new, not off.
    expect(surfaceIsVisible(surface({ module: 'social' }), new Set(['commerce']), KNOWN)).toBe(
      true
    );
  });

  it('never hides the workbench itself', () => {
    // Settings and Team are how somebody FIXES a wrong restriction, so gating
    // them is how an account locks itself out.
    expect(surfaceIsVisible(surface({ module: 'platform' }), new Set(), KNOWN)).toBe(true);
  });
});

describe('a surface whose hue and entitlement differ', () => {
  it('is offered when ANY module it names is on', () => {
    // Finance: Payments is a free view of data commerce/invoicing already
    // bought, so it must not be taken hostage by the billable finance module.
    const payments = surface({
      module: 'finance',
      requiresModules: ['commerce', 'invoicing', 'b2b'],
    });
    expect(surfaceIsVisible(payments, new Set(['invoicing']), KNOWN)).toBe(true);
    expect(surfaceIsVisible(payments, new Set(['email']), KNOWN)).toBe(false);
  });
});
