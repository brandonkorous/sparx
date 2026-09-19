// "ANYONE CAN READ IT" IS A CLAIM ABOUT A STRANGER, NOT ABOUT A STATUS COLUMN.
//
// A suspended account's public site serves an overlay instead of its pages —
// checked rather than assumed: the tenant site answered 200 with "Temporarily
// unavailable · Back soon" while the console showed four legal pages each
// saying **Live on your site. Anyone can read it.**
//
// Measured the same day: **32 of the 113 tenants on the platform are past their
// grace window**, so a third of the platform was being told a stranger can read
// pages nobody can reach — on the Legal pages screen, the Content list and every
// content detail.
//
// The label and its color stay put. The page IS published, that is the state the
// owner controls, and turning twenty green badges amber would report twenty
// problems where there is one. Only the sentence about who can READ it changes.

import { describe, expect, it } from 'vitest';
import type { BillingPhaseView } from '../finance/bill-data';
import { siteIsDark } from '../../lib/billing/site-live';
import { entryStatusState } from './data';
import { legalItemStatus, type ChecklistItem } from './legal-data';

const phase = (over: Partial<BillingPhaseView>): BillingPhaseView => ({
  phase: 'active',
  daysLeft: null,
  trialEndsAt: null,
  suspendsAt: null,
  ...over,
});

/** A published, reviewed, current legal page — the one that earns the sentence. */
function publishedLegal(): ChecklistItem {
  return {
    legalKind: 'privacy_policy',
    entry: {
      id: 'entry-1',
      status: 'published',
      acknowledged: true,
      templateVersion: 3,
      currentVersion: 3,
    },
  } as unknown as ChecklistItem;
}

describe('siteIsDark', () => {
  it('is true only once the site is actually being withheld', () => {
    expect(siteIsDark(phase({ phase: 'suspended' }))).toBe(true);
  });

  it('is false through grace, which exists to keep the site up', () => {
    // The whole point of the grace window is that the public site stays live.
    expect(siteIsDark(phase({ phase: 'grace', daysLeft: 4 }))).toBe(false);
  });

  it('is false while trialing or paid', () => {
    for (const p of ['trialing', 'active', 'exempt'] as const) {
      expect(siteIsDark(phase({ phase: p })), p).toBe(false);
    }
  });

  it('is false when the answer has not arrived', () => {
    // A page is not declared unreachable on a guess.
    expect(siteIsDark(undefined)).toBe(false);
  });
});

describe('a published content entry', () => {
  it('says anyone can read it while the site is served', () => {
    const state = entryStatusState('published', false);
    expect(state.label).toBe('Published');
    expect(state.detail).toContain('Anyone can read it');
  });

  it('stops saying so once the site is dark', () => {
    const state = entryStatusState('published', siteIsDark(phase({ phase: 'suspended' })));
    expect(state.detail).not.toContain('Anyone can read it');
    expect(state.detail).toContain('as soon as your site is online again');
  });

  it('keeps the label and the color, because the page is still published', () => {
    const lit = entryStatusState('published', false);
    const dark = entryStatusState('published', true);
    expect(dark.label).toBe(lit.label);
    expect(dark.tone).toBe(lit.tone);
  });
});

describe('a published legal page', () => {
  it('says anyone can read it while the site is served', () => {
    expect(legalItemStatus(publishedLegal(), false).detail).toContain('Anyone can read it');
  });

  it('stops saying so once the site is dark', () => {
    const state = legalItemStatus(publishedLegal(), true);
    expect(state.label).toBe('Published');
    expect(state.detail).not.toContain('Anyone can read it');
    expect(state.detail).toContain('as soon as your site is online again');
  });
});

describe('the property both helpers share', () => {
  it('never promises a reader while the site is withholding every page', () => {
    // Whatever the shape of the input, the promise and the state must agree.
    for (const dark of [false, true]) {
      for (const detail of [
        entryStatusState('published', dark).detail,
        legalItemStatus(publishedLegal(), dark).detail,
      ]) {
        expect(/anyone can read/i.test(detail), `dark=${String(dark)}: "${detail}"`).toBe(!dark);
      }
    }
  });

  it('leaves every unpublished state alone, dark or not', () => {
    // Draft, scheduled and archived are already about what nobody can see, so
    // the site being dark adds nothing and must not reword them.
    for (const status of ['draft', 'scheduled', 'archived'] as const) {
      expect(entryStatusState(status, true), status).toEqual(entryStatusState(status, false));
    }
  });
});
