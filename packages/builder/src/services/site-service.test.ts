// Locks the sync CLOBBER GUARD.
//
// `sync` reconciles a whole site: every stored page missing from the payload is
// DELETED, published tree and all. A payload that isn't "this site, edited" therefore
// destroys the tenant's live content with no recovery path. That is not hypothetical —
// a transient read failure made the studio seed a pristine starter (fresh page ids)
// over a real tenant, and the first autosave deleted every page of a real site.
//
// The invariant: a non-empty stored site must share at least ONE page id with the
// incoming payload, or the write is refused. silica hands back the same Site it was
// given, so a genuine edit always retains ids; zero overlap means the caller is holding
// a different site than the store.

import { describe, expect, it } from 'vitest';

import { wouldClobberSite } from './site-service';

describe('wouldClobberSite', () => {
  it('REFUSES the real-world failure: a fresh starter synced over an existing site', () => {
    const stored = ['home-1', 'about-2', 'services-3', 'journal-4', 'contact-5'];
    const starter = ['new-a', 'new-b', 'new-c']; // starterSite() mints fresh ids
    expect(wouldClobberSite(stored, starter)).toBe(true);
  });

  it('allows seeding a brand-new property (nothing stored ⇒ nothing to clobber)', () => {
    expect(wouldClobberSite([], ['new-a', 'new-b'])).toBe(false);
  });

  it('allows a normal edit that keeps its pages', () => {
    const stored = ['home-1', 'about-2'];
    expect(wouldClobberSite(stored, ['home-1', 'about-2', 'new-3'])).toBe(false);
  });

  it('allows deleting pages, as long as one page still matches', () => {
    // The author deleted every page but the home page — a real, expressible edit.
    expect(wouldClobberSite(['home-1', 'about-2', 'services-3'], ['home-1'])).toBe(false);
  });

  it('refuses an EMPTY payload against a non-empty site (delete-everything)', () => {
    expect(wouldClobberSite(['home-1', 'about-2'], [])).toBe(true);
  });

  it('refuses a same-shape site whose ids were all re-minted (id-identity is the test)', () => {
    // Same slugs/count, all-new ids — exactly what a re-seed looks like.
    expect(wouldClobberSite(['a', 'b', 'c'], ['a2', 'b2', 'c2'])).toBe(true);
  });
});
