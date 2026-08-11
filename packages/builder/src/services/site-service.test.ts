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

import type { BuilderLayout, BuilderPage } from '@sparx/db';
import { BuilderOpTarget, SiteSyncInput, resolvePageFrame } from '@sparx/builder-schemas';

import {
  framesToDelete,
  hasSilicaContent,
  hasStagedTree,
  pagesToDelete,
  recordPagePlan,
  rowsToStoredSite,
  stagedFrameId,
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

// ── The chrome pointer obeys the same boundary (docs/silicaui/01 §5) ──────────────────
//
// `frame_id` shipped as ONE column read live by the storefront, which was invisible
// while nothing could write it. Once the editor got a frame picker, saving "no header
// on this page" would have changed the live site immediately — while the body visitors
// saw was still the last published one and Publish reported nothing to publish.
//
// These tests pin the fix. They are cheap and they matter, because reading the wrong
// column here is SILENT: both hold the same three values, so the only symptom is a
// production page that changed shape without anyone publishing it.

const LAYOUT_A = '11111111-1111-4111-8111-111111111111';
const LAYOUT_B = '22222222-2222-4222-8222-222222222222';

describe('stagedFrameId — chrome follows the publish lifecycle', () => {
  it('published serves the published choice, draft (preview) serves the edited one', () => {
    const edited = { frameId: 'none', publishedFrameId: LAYOUT_A };
    expect(stagedFrameId(edited, 'published')).toBe(LAYOUT_A);
    expect(stagedFrameId(edited, 'draft')).toBe('none');
  });

  it('an UNPUBLISHED "no header" choice leaves the live site alone', () => {
    // The regression this column exists for: the author has chosen bare and saved, and
    // has not published. Visitors keep the site default until they do.
    const staged = { frameId: 'none', publishedFrameId: null };
    expect(stagedFrameId(staged, 'published')).toBeNull();
    expect(stagedFrameId(staged, 'draft')).toBe('none');
  });

  it('resolves each stage to the choice that stage means', () => {
    // Null is not "unset" here — it IS the site default, and it has to survive the
    // round trip through `resolvePageFrame` as `default` rather than as a dangling id.
    const takesDefault = { frameId: null, publishedFrameId: null };
    expect(resolvePageFrame(stagedFrameId(takesDefault, 'published'), []).kind).toBe('default');

    const bare = { frameId: 'none', publishedFrameId: 'none' };
    expect(resolvePageFrame(stagedFrameId(bare, 'published'), []).kind).toBe('none');

    const named = { frameId: LAYOUT_B, publishedFrameId: LAYOUT_B };
    expect(resolvePageFrame(stagedFrameId(named, 'published'), [LAYOUT_B])).toEqual({
      kind: 'named',
      frameId: LAYOUT_B,
    });
  });

  it('reports a published pointer at a DELETED layout instead of restoring the default', () => {
    // Publishing froze a layout id; the layout has since been deleted. The page renders
    // bare and says so — putting the site header back is the wrong repair, because the
    // author moved this page off the default on purpose.
    const dangling = { frameId: LAYOUT_A, publishedFrameId: LAYOUT_A };
    expect(resolvePageFrame(stagedFrameId(dangling, 'published'), [LAYOUT_B])).toEqual({
      kind: 'missing',
      frameId: LAYOUT_A,
    });
  });

  it('a page reverted to the site default publishes that revert', () => {
    // The direction that a naive `frameId ?? publishedFrameId` fallback would break:
    // clearing the choice must actually reach visitors, not leave the old shell frozen.
    const reverted = { frameId: null, publishedFrameId: LAYOUT_A };
    expect(stagedFrameId(reverted, 'draft')).toBeNull();
    expect(
      stagedFrameId({ ...reverted, publishedFrameId: reverted.frameId }, 'published')
    ).toBeNull();
  });
});

// ── Named layouts (silicaui 0.37) ────────────────────────────────────────────
//
// `Site.frames` gave the engine a catalog of alternative shells, which maps onto the
// `builder_layouts` rows sparx already had. Deleting one is the only irreversible thing
// in that mapping, so it is the part with tests.

describe('framesToDelete — a layout is only removed when it is named', () => {
  it('deletes NOTHING when the payload names nothing, however many are absent', () => {
    // The concurrent-authoring case, one namespace over from pages: this client loaded
    // before an agent added a layout over MCP. Its payload cannot mention what it never
    // saw, and that silence must not be read as "remove it".
    expect(framesToDelete(undefined, LAYOUT_A)).toEqual([]);
    expect(framesToDelete([], LAYOUT_A)).toEqual([]);
  });

  it('deletes exactly the ids named', () => {
    expect(framesToDelete([LAYOUT_B], LAYOUT_A)).toEqual([LAYOUT_B]);
  });

  it('REFUSES to delete the active layout, even when explicitly named', () => {
    // The site's default shell. Removing it leaves every page that takes the default
    // with no chrome at all — so a stale client naming it is ignored, not obeyed.
    expect(framesToDelete([LAYOUT_A], LAYOUT_A)).toEqual([]);
    expect(framesToDelete([LAYOUT_A, LAYOUT_B], LAYOUT_A)).toEqual([LAYOUT_B]);
  });
});

// ── The other half: does a second layout SURVIVE A RELOAD? ───────────────────
//
// `framesToDelete` above guards the write. This guards the READ, and together they are
// the claim the builder audit left open: an author creates a second layout, saves, comes
// back tomorrow, and it is still in the switcher.
//
// It needs its own tests because the two halves agree by CONVENTION, in three places, and
// every disagreement is silent. `syncNamedLayoutsTx` writes `frames[id]` to rows with
// `isActive: false` and skips the active id; `rowsToStoredSite` has to split them back the
// same way, key by the same value, and make the same call about a tree-less row. Get any
// of the three wrong and the layout simply is not there after a reload — which an author
// reads as "it never saved", not as a read bug.

/** A `builder_layouts` row, at the width these functions actually touch. Same `as`-cast
 *  idiom as `row()` above — the real model carries thirty columns none of this reads —
 *  but narrowed to the real type rather than `any`, so a field this test invents that the
 *  model does not have is still a compile error. */
function layoutRow(over: {
  id: string;
  name?: string;
  isActive?: boolean;
  silicaDraftTree?: unknown;
}): BuilderLayout {
  return {
    name: 'Layout',
    isActive: false,
    silicaDraftTree: DRAFT,
    ...over,
  } as unknown as BuilderLayout;
}

/** A page row, ditto — every case here needs at least one so the site is non-empty. */
function pageRow(id = 'page-1'): BuilderPage {
  return {
    id,
    name: 'Home',
    slug: '/',
    silicaDraftTree: DRAFT,
    frameId: null,
  } as unknown as BuilderPage;
}

describe('rowsToStoredSite — a named layout survives the reload', () => {
  it('splits the ACTIVE layout into `frame` and every other one into `frames`', () => {
    const site = rowsToStoredSite(
      [pageRow()],
      [
        layoutRow({ id: LAYOUT_A, name: 'Default layout', isActive: true }),
        layoutRow({ id: LAYOUT_B, name: 'Landing pages', silicaDraftTree: LIVE }),
      ],
      null
    );
    expect(site.frame?.root).toBe(DRAFT);
    // The whole claim, in one assertion: the second layout comes back, under its own id.
    expect(Object.keys(site.frames ?? {})).toEqual([LAYOUT_B]);
    expect(site.frames?.[LAYOUT_B]).toMatchObject({ root: LIVE, name: 'Landing pages' });
  });

  it('keys `frames` by the ROW id, which is what a page points at', () => {
    // Load-bearing, and the reason there is no translation table anywhere: `Page.frameId`
    // in the engine, `builder_pages.frame_id` in Postgres and `builder_layouts.id` are one
    // value. A read that keyed by name or position would break every page's chrome pointer
    // while looking perfectly reasonable in the switcher.
    const site = rowsToStoredSite(
      [pageRow()],
      [layoutRow({ id: LAYOUT_A, isActive: true }), layoutRow({ id: LAYOUT_B })],
      null
    );
    expect(site.frames?.[LAYOUT_B]).toBeDefined();
  });

  it('SKIPS a layout with no silica tree rather than returning an empty shell', () => {
    // A row from the legacy `.bx-*` catalog, or one never opened. Sent through, the engine
    // lists a layout with no Outlet — which an author cannot repair from inside the editor,
    // so absence is the kinder failure.
    const site = rowsToStoredSite(
      [pageRow()],
      [
        layoutRow({ id: LAYOUT_A, isActive: true }),
        layoutRow({ id: LAYOUT_B, silicaDraftTree: null }),
      ],
      null
    );
    expect(site.frames).toBeUndefined();
  });

  it('omits `frames` entirely when the site has only its default shell', () => {
    // Not `{}`. The engine reads an absent map as "no alternatives", and a present-but-empty
    // one is the shape that makes a switcher render a header with nothing under it.
    const site = rowsToStoredSite([pageRow()], [layoutRow({ id: LAYOUT_A, isActive: true })], null);
    expect(site.frames).toBeUndefined();
    expect(site.frame).toBeDefined();
  });

  it('round-trips the write half: what sync excludes is exactly what the read adds back', () => {
    // The two conventions meeting. `syncNamedLayoutsTx` skips `frameId === activeId`, so
    // the active layout is never in the payload's `frames` — and the read must therefore be
    // the only thing that puts it in `frame`. If both did it, one save would carry two trees
    // for one row; if neither did, the site would reload with no chrome.
    const layouts = [
      layoutRow({ id: LAYOUT_A, isActive: true }),
      layoutRow({ id: LAYOUT_B, silicaDraftTree: LIVE }),
    ];
    const site = rowsToStoredSite([pageRow()], layouts, null);
    const payloadFrameIds = Object.keys(site.frames ?? {});
    expect(payloadFrameIds).not.toContain(LAYOUT_A);
    expect(framesToDelete(payloadFrameIds, LAYOUT_A)).toEqual([LAYOUT_B]);
  });
});

describe('BuilderOpTarget — a named layout keeps its id', () => {
  it('carries the frame id through, rather than stripping it to the default shell', () => {
    // `z.object` STRIPS unknown keys. Before the frame scope accepted an id, an op
    // editing a named layout parsed down to `{scope:'frame'}` and was filed against the
    // DEFAULT one — two shells sharing one history that no undo could untangle.
    expect(BuilderOpTarget.parse({ scope: 'frame', id: LAYOUT_B })).toEqual({
      scope: 'frame',
      id: LAYOUT_B,
    });
  });

  it('still accepts a bare frame target — that IS the site default', () => {
    expect(BuilderOpTarget.parse({ scope: 'frame' })).toEqual({ scope: 'frame' });
  });
});

// The storefront reads `silica_published_tree`; every silica-aware tool filtered on
// `silica_draft_tree`. A row where the first is set and the second is null is therefore
// LIVE and unreachable — it wins its slug, no listing shows it, and `reset` (the one
// tool for "get this off my site") skipped it, so it could not be removed at all. Seen
// in production: /contact served a seeded starter page while the page the tenant had
// authored never rendered, and nothing in the product could clear it.
describe('hasSilicaContent — reset must see what VISITORS see, not what the editor sees', () => {
  const row = (draft: unknown, published: unknown) =>
    ({ silicaDraftTree: draft, silicaPublishedTree: published }) as Parameters<
      typeof hasSilicaContent
    >[0];

  it('matches the orphan: published body, no draft', () => {
    expect(hasSilicaContent(row(null, { kind: 'element' }))).toBe(true);
  });

  it('still matches the ordinary cases', () => {
    expect(hasSilicaContent(row({ kind: 'element' }, { kind: 'element' }))).toBe(true);
    // Draft-only — authored, never published. Reset must clear it too.
    expect(hasSilicaContent(row({ kind: 'element' }, null))).toBe(true);
  });

  it('leaves a row carrying no silica content alone', () => {
    expect(hasSilicaContent(row(null, null))).toBe(false);
  });
});

// ── recordPagePlan — the 500 that took the builder down in production ─────────
//
// `GET /v1/builder/site` seeds any record detail page the property is missing, and it
// measured "missing" against SILICA rows only, on the premise that a legacy sparx-tier
// template "cannot collide — its slug is null".
//
// `20270203000000_record_page_addresses` ended that. It addresses record pages by
// `kind='collection'` + `record_type` and says nothing about tier, so the legacy
// `STARTER_PAGES` product template — no silica body, invisible to the switcher — came out
// of the migration holding `/products/:handle`. The seeding then read the property as
// still missing its product page, created a second row at the same address, and hit
// `(tenant_id, property_id, slug)`. Every builder load 500'd for every tenant whose site
// predated addresses, which is most of them.
//
// The fix separates DELIVERED (a silica row holds it — what the tenant can edit) from
// OCCUPIED (any row holds it — what the unique index sees), and upgrades the occupant in
// place instead of minting a rival.
describe('recordPagePlan — a legacy occupant is upgraded, never duplicated', () => {
  const row = (
    over: Partial<Parameters<typeof recordPagePlan>[0][number]>
  ): Parameters<typeof recordPagePlan>[0][number] => ({
    id: 'p1',
    // A name a person chose, so the default row is one the rename heal must NOT touch —
    // a fixture that opted into being healed would hide the guard rather than test it.
    name: 'Treatments',
    slug: null,
    recordType: null,
    position: 0,
    silicaDraftTree: null,
    ...over,
  });

  // A silica home so the property reads as a real site, as `load` requires.
  const home = row({ id: 'home', slug: '/', silicaDraftTree: { kind: 'element' } });

  // Commerce alone calls for THREE addresses (product, collection, category), so every
  // assertion below is scoped to the one under test — the others are legitimately created.
  const creates = (plan: ReturnType<typeof recordPagePlan>) =>
    plan.creates.map((a) => a.recordType);
  const upgradeOf = (plan: ReturnType<typeof recordPagePlan>, recordType: string) =>
    plan.upgrades.find((u) => u.address.recordType === recordType);

  it('THE REGRESSION: a migration-addressed legacy row is upgraded, not re-created', () => {
    const legacy = row({
      id: 'legacy-product',
      slug: '/products/:handle',
      recordType: 'commerce.product',
    });
    const plan = recordPagePlan([home, legacy], { commerceEnabled: true });

    // Nothing is created at a slug another row already holds — this is the 500.
    expect(creates(plan)).not.toContain('commerce.product');
    expect(upgradeOf(plan, 'commerce.product')).toEqual({
      id: 'legacy-product',
      address: expect.objectContaining({ recordType: 'commerce.product' }),
      // Already at its address, so the slug is left alone rather than rewritten.
      slug: null,
    });
  });

  it('upgrades a pre-migration legacy row and gives it the address', () => {
    // The same row as it looked BEFORE the migration ran: recordType, no slug.
    const legacy = row({ id: 'legacy-product', slug: null, recordType: 'commerce.product' });
    const plan = recordPagePlan([home, legacy], { commerceEnabled: true });

    expect(creates(plan)).not.toContain('commerce.product');
    expect(upgradeOf(plan, 'commerce.product')).toEqual({
      id: 'legacy-product',
      address: expect.objectContaining({ recordType: 'commerce.product' }),
      slug: '/products/:handle',
    });
  });

  it('creates only where NO row holds the address', () => {
    const plan = recordPagePlan([home], { commerceEnabled: true });
    expect(plan.upgrades).toEqual([]);
    expect(creates(plan)).toContain('commerce.product');
  });

  it('is idempotent once a silica row holds the address — the second load re-writes nothing', () => {
    const seeded = row({
      id: 'product',
      slug: '/products/:handle',
      recordType: 'commerce.product',
      silicaDraftTree: { kind: 'element' },
    });
    const plan = recordPagePlan([home, seeded], { commerceEnabled: true });
    expect(upgradeOf(plan, 'commerce.product')).toBeUndefined();
    expect(creates(plan)).not.toContain('commerce.product');
  });

  it('a silica row identified only by recordType still counts as delivered', () => {
    // `rowsToStoredSite` presents this row AT the address, so seeding another would put
    // two pages in the switcher for one route.
    const seeded = row({
      id: 'product',
      slug: null,
      recordType: 'commerce.product',
      silicaDraftTree: { kind: 'element' },
    });
    const plan = recordPagePlan([home, seeded], { commerceEnabled: true });
    expect(upgradeOf(plan, 'commerce.product')).toBeUndefined();
    expect(creates(plan)).not.toContain('commerce.product');
  });

  it('never writes an address a SIBLING row already holds', () => {
    // Two legacy rows: one parked ON the address, one merely claiming the record type.
    // The one at the address is upgraded; the other must not be handed the same slug.
    const atAddress = row({ id: 'at-address', slug: '/products/:handle' });
    const claiming = row({ id: 'claiming', slug: '/old-product', recordType: 'commerce.product' });
    const plan = recordPagePlan([home, atAddress, claiming], { commerceEnabled: true });

    expect(creates(plan)).not.toContain('commerce.product');
    expect(upgradeOf(plan, 'commerce.product')).toEqual({
      id: 'at-address',
      address: expect.objectContaining({ recordType: 'commerce.product' }),
      slug: null,
    });
    // The runner-up is left entirely alone — one address, one row.
    expect(plan.upgrades.filter((u) => u.id === 'claiming')).toEqual([]);
  });

  it('honours the module gates — a publisher gets no product page', () => {
    const plan = recordPagePlan([home], {
      commerceEnabled: false,
      cmsEnabled: true,
      schedulingEnabled: false,
    });
    const types = plan.creates.map((a) => a.recordType);
    expect(types).toContain('cms.blog_post');
    expect(types).not.toContain('commerce.product');
    expect(types).not.toContain('scheduling.service');
  });

  it('appends after the LAST row, counting legacy rows too', () => {
    const legacy = row({ id: 'legacy', slug: '/about', position: 7 });
    const plan = recordPagePlan([home, legacy], { commerceEnabled: true });
    expect(plan.nextPosition).toBe(8);
  });
});

// Record pages went into the page switcher, which turned their names from an internal DTO
// field into the first thing a business owner reads. Two of the old ones were actively
// misleading there — `Collection` sat one letter from the `Collections` index page — so
// the labels changed. Changing a label only reaches sites seeded AFTER the change, and the
// confusing pair is sitting in the switcher of every site that already has these pages, so
// the plan heals them on read. The line it must not cross is a name a PERSON chose.
describe('recordPagePlan — stale platform names are healed, chosen names are not', () => {
  const row = (
    over: Partial<Parameters<typeof recordPagePlan>[0][number]>
  ): Parameters<typeof recordPagePlan>[0][number] => ({
    id: 'p1',
    name: 'Treatments',
    slug: null,
    recordType: null,
    position: 0,
    silicaDraftTree: null,
    ...over,
  });
  const home = row({ id: 'home', name: 'Home', slug: '/', silicaDraftTree: { kind: 'element' } });
  const commerce = { commerceEnabled: true, cmsEnabled: false, schedulingEnabled: false };

  const product = (name: string) =>
    row({
      id: 'prod',
      name,
      slug: '/products/:handle',
      recordType: 'commerce.product',
      silicaDraftTree: { kind: 'element' },
    });

  it('corrects a name an earlier release wrote', () => {
    const plan = recordPagePlan([home, product('Product detail')], commerce);
    expect(plan.renames).toContainEqual({ id: 'prod', name: 'Each product' });
  });

  it('corrects the pre-silica starter name too', () => {
    // `STARTER_PAGES` seeded `Product page` on every fresh property for a long time; those
    // rows are the majority of what exists, so missing them would miss most of the fleet.
    const plan = recordPagePlan([home, product('Product page')], commerce);
    expect(plan.renames).toContainEqual({ id: 'prod', name: 'Each product' });
  });

  it('leaves a name a person chose completely alone', () => {
    // The whole reason the heal is gated rather than blanket. An operator who renamed
    // their product page to `Our range` gets to keep it, confusing neighbour or not —
    // silently reverting that on a READ is an edit they never made.
    const plan = recordPagePlan([home, product('Our range')], commerce);
    expect(plan.renames).toEqual([]);
  });

  it('is idempotent — a healed row plans nothing', () => {
    // `load` runs this on every open. A rename that re-fires would write on every read and
    // show up as a change the operator never made, forever.
    const plan = recordPagePlan([home, product('Each product')], commerce);
    expect(plan.renames).toEqual([]);
  });

  it('heals a row it is not otherwise touching', () => {
    // The case that makes this a separate pass rather than a field on `upgrades`: this row
    // is already delivered — silica body, right address — so it is neither an upgrade nor
    // a create, and an earlier release is exactly what gave it its stale name.
    const plan = recordPagePlan([home, product('Product detail')], commerce);
    expect(plan.upgrades).toEqual([]);
    expect(plan.creates.map((a) => a.recordType)).not.toContain('commerce.product');
    expect(plan.renames).toHaveLength(1);
  });

  it('never renames an ordinary page that happens to share the name', () => {
    // `Blog post` is a platform record-page name AND a plausible name for an ordinary
    // page. Only a row sitting at a record ADDRESS is eligible.
    const ordinary = row({ id: 'ord', name: 'Blog post', slug: '/writing' });
    const plan = recordPagePlan([home, ordinary], commerce);
    expect(plan.renames).toEqual([]);
  });
});
