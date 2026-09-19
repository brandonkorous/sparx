// A DESIGN THAT IS "LIVE" ON A SITE NOBODY CAN REACH.
//
// The install badge said, whenever a design had been published:
//
//     Live — This design has been published: visitors see it on your site now.
//
// A suspended account's public site serves the "Temporarily unavailable" overlay
// instead of its pages. Measured when this was found: 32 of the 113 tenants on
// the platform are past their grace window, so for a third of them nobody is
// looking at the design however published it is.
//
// The badge still says Live and stays green, because the design IS the published
// one and that is what the badge is about. Only the sentence changes.

import { describe, expect, it } from 'vitest';
import { installState } from './blueprints-data';

describe('installState', () => {
  it('says visitors see it while the site is served', () => {
    expect(installState('live', false).detail).toContain('visitors see it on your site now');
  });

  it('stops saying so once the site is offline', () => {
    const state = installState('live', true);
    expect(state.label).toBe('Live');
    expect(state.tone).toBe('success');
    expect(state.detail).not.toContain('visitors');
    expect(state.detail).toContain('the moment your site is back');
  });

  it('leaves every other install state alone, dark or not', () => {
    // Drafts, setting up and failed are already about what nobody can see, so
    // the site being dark adds nothing and must not reword them.
    for (const status of ['installed', 'running', 'failed', 'anything-else']) {
      expect(installState(status, true), status).toEqual(installState(status, false));
    }
  });
});
