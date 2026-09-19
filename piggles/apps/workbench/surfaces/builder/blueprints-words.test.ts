// What adding a ready-made design says it will do.
//
// Pinned because these sentences were WRONG, not merely clumsy: the pane promised
// "nothing here replaces what you already have" and its confirm promised "your
// existing pages and products are left exactly as they are", while the install
// deletes every page on the site it lands on (issue 363). The reassuring branch
// is the dangerous one, so each case is asserted for what it must NOT say as well
// as what it must.

import { describe, expect, it } from 'vitest';
import { installImpact, installState } from './blueprints-words';

describe('installImpact', () => {
  it('reassures only when the site is genuinely empty', () => {
    const impact = installImpact('Juniper Row Press', 0);
    expect(impact.replaces).toBe(false);
    expect(impact.pages).toBe(0);
    expect(impact.sentence).toContain('has no pages yet');
    expect(impact.sentence).not.toMatch(/replace/i);
  });

  it('says how many pages go, and that it cannot be undone', () => {
    const impact = installImpact('Juniper Row', 22);
    expect(impact.replaces).toBe(true);
    expect(impact.pages).toBe(22);
    expect(impact.sentence).toContain('22 pages now');
    expect(impact.sentence).toContain('all 22 of its pages');
    expect(impact.sentence).toContain('cannot be undone');
  });

  it('names what SURVIVES, or the warning reads as "you may lose everything"', () => {
    // Only `builder_page` rows are ever deleted. A warning nobody can act on is a
    // worse warning than a specific one.
    const impact = installImpact('Juniper Row', 22);
    expect(impact.sentence).toContain('products, articles, customers and orders are not touched');
  });

  it('speaks singular for one page', () => {
    const impact = installImpact('Juniper Row Trade', 1);
    expect(impact.sentence).toContain('has 1 page now');
    expect(impact.sentence).toContain('its 1 page');
  });

  it('warns rather than reassures when nobody counted', () => {
    // The trap: an unknown count must never take the empty-site branch. "Not
    // counted" and "empty" are different answers and confusing them is the bug.
    const impact = installImpact('Juniper Row', undefined);
    expect(impact.replaces).toBe(true);
    expect(impact.pages).toBeNull();
    expect(impact.sentence).toContain('is replaced by this design');
    expect(impact.sentence).not.toMatch(/no pages yet/);
  });
});

describe('a design that is live on a dark site', () => {
  it('says visitors see it while the site is served', () => {
    expect(installState('live', false).detail).toContain('visitors see it on your site now');
  });

  it('stops saying so once the site is offline', () => {
    const state = installState('live', true);
    // The badge still says Live, because the design IS the published one.
    expect(state.label).toBe('Live');
    expect(state.tone).toBe('success');
    expect(state.detail).not.toContain('visitors');
    expect(state.detail).toContain('the moment your site is back');
  });

  it('leaves every other install state alone, dark or not', () => {
    for (const status of ['installed', 'running', 'failed', 'anything-else']) {
      expect(installState(status, true), status).toEqual(installState(status, false));
    }
  });
});
