// Locks the sync DELETION model + CLOBBER GUARD.
//
// Deletion is EXPLICIT: `sync` removes a page only when the caller names it in
// `deletedPageIds` (or, on the wholesale-replace path, when it is absent from an
// authoritative roster). A page merely missing from the payload is PRESERVED — it may
// be a page a concurrent MCP writer (an agent authoring while the operator has the
// studio open) just added and this client never loaded. Inferring deletion from
// absence is exactly what let one autosave wipe every page an agent had just authored.
//
// The clobber guard is the remaining safety net: a non-empty stored site must share at
// least ONE page id with the incoming payload, or the write is refused. silica hands
// back the same Site it was given, so a genuine edit always retains ids; zero overlap
// means the caller is holding a different site than the store.

import { describe, expect, it } from 'vitest';

import { SiteSyncInput } from '@sparx/builder-schemas';

import {
  hasStagedTree,
  pagesToDelete,
  stagedTree,
  symbolsUpdateFor,
  wouldClobberSite,
  type StagedPageRow,
} from './site-service';

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

// ── Explicit-delete semantics (docs/126 §4.4) ────────────────────────────────
//
// The concurrent-authoring bug: an operator loads the studio (4 pages), an agent adds 3
// pages over MCP, the operator saves. The operator's roster is the original 4 — so under
// absence-as-deletion the 3 agent pages were deleted. `pagesToDelete` fixes the floor:
// absence never deletes; only explicitly-named ids do (except a wholesale replace).

describe('pagesToDelete — deletion is explicit, not inferred from absence', () => {
  it('deletes NOTHING when no pages are named, however many are absent from the roster', () => {
    // The operator loaded [home, about]; an agent added [shop, blog] over MCP. The
    // operator's save carries only its known roster and names no deletion. The agent's
    // pages must survive.
    expect(
      pagesToDelete({
        allowReplace: false,
        storedSilicaIds: ['home', 'about', 'shop', 'blog'],
        roster: ['home', 'about'],
        deletedPageIds: [],
      })
    ).toEqual([]);
  });

  it('deletes ONLY the pages the caller explicitly named', () => {
    expect(
      pagesToDelete({
        allowReplace: false,
        storedSilicaIds: ['home', 'about', 'shop'],
        roster: ['home', 'shop'],
        deletedPageIds: ['about'],
      })
    ).toEqual(['about']);
  });

  it('ignores a named id that no longer exists (a stale delete is a harmless no-op)', () => {
    expect(
      pagesToDelete({
        allowReplace: false,
        storedSilicaIds: ['home', 'about'],
        roster: ['home', 'about'],
        deletedPageIds: ['ghost'],
      })
    ).toEqual([]);
  });

  it('wholesale replace deletes every stored page absent from the authoritative roster', () => {
    // A blueprint install / reset owns the whole site — here the roster IS the truth and
    // `deletedPageIds` is ignored.
    expect(
      pagesToDelete({
        allowReplace: true,
        storedSilicaIds: ['old-a', 'old-b', 'old-c'],
        roster: ['old-a'],
        deletedPageIds: [],
      })
    ).toEqual(['old-b', 'old-c']);
  });
});

describe('SiteSyncInput.deletedPageIds', () => {
  const page = (id: string) => ({ id, name: id, slug: `/${id}`, root: { kind: 'element' } });

  it('carries the explicit removal list through the wire schema', () => {
    const parsed = SiteSyncInput.parse({
      pages: [page('home')],
      pageIds: ['home', 'shop'],
      deletedPageIds: ['about'],
    });
    expect(parsed.deletedPageIds).toEqual(['about']);
  });

  it('defaults to absent — a save that removes nothing sends no list', () => {
    const parsed = SiteSyncInput.parse({ pages: [page('home')] });
    expect(parsed.deletedPageIds).toBeUndefined();
  });
});

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

// ── Stage selection: which tree a read serves ────────────────────────────────
//
// The storefront serves `published`; the editor's Preview serves `draft`. Both go
// through the SAME readers, discriminated only by these two functions, so this pair is
// the whole boundary between "what visitors see" and "what the author is still working
// on". Two failure modes, opposite and both bad:
//
//   · published reading the DRAFT column → unpublished work leaks to the public;
//   · draft reading the PUBLISHED column → Preview shows the live site, which is the
//     bug this stage parameter exists to fix (the token was minted, sent, and ignored,
//     so Preview never once showed unpublished work).
//
// A two-branch ternary is exactly the kind of thing that gets inverted in a refactor
// and passes review, so it is pinned here rather than trusted.

/** A page row carrying only what the stage predicate reads. */
function row(trees: Partial<Pick<StagedPageRow, 'silicaDraftTree' | 'silicaPublishedTree'>>) {
  return trees as StagedPageRow;
}

const DRAFT = { kind: 'element', tag: 'div' } as const;
const LIVE = { kind: 'element', tag: 'section' } as const;

describe('stagedTree / hasStagedTree — the published↔draft boundary', () => {
  it('published reads the published column, draft reads the draft column', () => {
    const both = row({ silicaDraftTree: DRAFT, silicaPublishedTree: LIVE });
    expect(stagedTree(both, 'published')).toBe(LIVE);
    expect(stagedTree(both, 'draft')).toBe(DRAFT);
  });

  it('a page saved but NEVER published previews, and stays invisible to visitors', () => {
    // The whole point of preview: work that has no published counterpart yet.
    const unpublished = row({ silicaDraftTree: DRAFT, silicaPublishedTree: null });
    expect(hasStagedTree(unpublished, 'draft')).toBe(true);
    expect(hasStagedTree(unpublished, 'published')).toBe(false);
  });

  it('a published page whose draft column is empty still serves visitors', () => {
    // A page published before the draft column existed, or one never re-opened.
    const liveOnly = row({ silicaDraftTree: null, silicaPublishedTree: LIVE });
    expect(hasStagedTree(liveOnly, 'published')).toBe(true);
    expect(stagedTree(liveOnly, 'published')).toBe(LIVE);
  });

  it('a row with neither tree resolves at no stage (falls through to the starter)', () => {
    const empty = row({ silicaDraftTree: null, silicaPublishedTree: null });
    expect(hasStagedTree(empty, 'published')).toBe(false);
    expect(hasStagedTree(empty, 'draft')).toBe(false);
  });

  it('treats an ABSENT column the same as null (the stage did not select it)', () => {
    // `pageSelectFor` fetches ONE tree column per stage, so the other is undefined
    // rather than null on every real row. Both must read as "no tree".
    expect(hasStagedTree(row({ silicaPublishedTree: LIVE }), 'draft')).toBe(false);
    expect(hasStagedTree(row({ silicaDraftTree: DRAFT }), 'published')).toBe(false);
  });
});
