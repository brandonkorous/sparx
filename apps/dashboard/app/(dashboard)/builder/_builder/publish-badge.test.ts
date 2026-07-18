// The studio's save/publish badge — the one surface that tells an author whether
// their visitors can see their work.
//
// These tests exist because the badge got this WRONG in a way that cost real days:
// it went green on "All changes saved" while the published site was untouched, so
// "saved" read as "done". The rule being pinned here is that green means LIVE, and
// nothing else ever gets to be green.

import { describe, expect, it } from 'vitest';

import { badgeView, type PublishView } from './publish-badge';

const live: PublishView = {
  hasUnpublished: false,
  lastPublishedAt: '2026-07-17T07:23:00.000Z',
  neverPublished: false,
};
const unpublished: PublishView = { ...live, hasUnpublished: true };
const virgin: PublishView = {
  hasUnpublished: true,
  lastPublishedAt: null,
  neverPublished: true,
};

describe('badgeView — green means live, never merely saved', () => {
  it('is NOT success when work is saved but unpublished', () => {
    // The whole bug, in one assertion.
    const view = badgeView('saved', unpublished);
    expect(view?.color).not.toBe('success');
    expect(view?.color).toBe('warning');
  });

  it('says so in words, not just colour', () => {
    // Colour alone fails anyone who doesn't parse amber-vs-green, which is most
    // people most of the time.
    expect(badgeView('saved', unpublished)?.label).toMatch(/not live/i);
    expect(badgeView('saved', unpublished)?.detail).toMatch(/visitors/i);
  });

  it('is success only once the draft matches what visitors are served', () => {
    const view = badgeView('saved', live);
    expect(view?.color).toBe('success');
    expect(view?.label).toBe('Live');
  });

  it('distinguishes "never published" from "changes not live"', () => {
    // Materially different: one site is invisible, the other is merely stale. An
    // author who has never published needs to know nobody can reach their site.
    expect(badgeView('saved', virgin)?.detail).toMatch(/isn’t visible/i);
    expect(badgeView('saved', unpublished)?.detail).toMatch(/still see/i);
  });

  it('lets a save failure outrank publish state', () => {
    // Transient and actionable right now — and it must not be reassuring.
    const view = badgeView('error', live);
    expect(view?.color).toBe('danger');
  });

  it('never reports a stale publish time as if it were fresh', () => {
    const old = badgeView('saved', { ...live, lastPublishedAt: '2020-01-01T00:00:00.000Z' });
    expect(old?.detail).not.toMatch(/just now/i);
  });

  it('shows nothing on an untouched, never-published-but-empty session', () => {
    // Opening the studio and changing nothing shouldn't nag.
    expect(badgeView('idle', { ...live, lastPublishedAt: null })).toBeNull();
  });

  it('reports in-flight saves without claiming anything about live state', () => {
    const view = badgeView('saving', unpublished);
    expect(view?.color).toBe('info');
    expect(view?.color).not.toBe('success');
  });
});
