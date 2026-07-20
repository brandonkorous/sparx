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

import { SiteSyncInput } from '@sparx/builder-schemas';

import { symbolsUpdateFor, wouldClobberSite } from './site-service';

// ── The symbol-library wipe (docs/125 §9.3) ──────────────────────────────────
//
// `silicaDraftSymbols` was written unconditionally as `input.symbols ?? {}`, so ANY
// sync payload that didn't carry symbols destroyed the tenant's entire saved-component
// library. The studio only includes them when `site.symbols` is truthy, so an engine
// handing back an absent map silently wiped every saved component — while `theme` and
// `savedThemes`, written one line above, were already guarded against exactly this.

describe('symbolsUpdateFor — absent vs empty', () => {
  it('writes NOTHING when the payload carries no symbols (preserve the library)', () => {
    expect(symbolsUpdateFor(undefined)).toEqual({});
    expect(symbolsUpdateFor(null)).toEqual({});
  });

  it('writes an EMPTY map when the author explicitly cleared their last symbol', () => {
    // A library you can never empty is its own bug — `{}` must round-trip.
    expect(symbolsUpdateFor({})).toEqual({ silicaDraftSymbols: {} });
  });

  it('writes the map when symbols are present', () => {
    const symbols = { hero: { root: { kind: 'element' } } };
    expect(symbolsUpdateFor(symbols)).toEqual({ silicaDraftSymbols: symbols });
  });
});

// ── Partial-payload sync (docs/126 Phase 0) ──────────────────────────────────
//
// `pageIds` lets the studio send only the page bodies that changed while the server
// still resolves deletion + ordering against the full roster. The dangerous failure
// mode is a partial payload being mistaken for a whole-site one — which would delete
// every page the author didn't happen to edit. These lock the contract.

describe('SiteSyncInput.pageIds', () => {
  const page = (id: string) => ({ id, name: id, slug: `/${id}`, root: { kind: 'element' } });

  it('accepts a partial payload carrying the full roster', () => {
    const parsed = SiteSyncInput.parse({
      pages: [page('about')],
      pageIds: ['home', 'about', 'contact'],
    });
    expect(parsed.pageIds).toEqual(['home', 'about', 'contact']);
    expect(parsed.pages).toHaveLength(1);
  });

  it('stays backward compatible — no roster means `pages` IS the whole site', () => {
    const parsed = SiteSyncInput.parse({ pages: [page('home'), page('about')] });
    expect(parsed.pageIds).toBeUndefined();
  });
});

describe('clobber guard under partial payloads', () => {
  it('compares the ROSTER, not the changed subset', () => {
    // The real hazard: one page edited on a five-page site. Judged by the changed
    // subset alone this looks like 1-of-5 overlap; judged by the roster it is a
    // normal edit. If the guard ever reads `input.pages` instead of the roster, a
    // single-page edit on a site whose one changed page is new would wipe the site.
    const stored = ['home', 'about', 'services', 'journal', 'contact'];
    const roster = ['home', 'about', 'services', 'journal', 'contact'];
    expect(wouldClobberSite(stored, roster)).toBe(false);
  });

  it('still refuses a fresh starter even when it arrives as a partial payload', () => {
    const stored = ['home-1', 'about-2'];
    expect(wouldClobberSite(stored, ['new-a', 'new-b', 'new-c'])).toBe(true);
  });
});

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
