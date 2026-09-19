// What a LIVE product page cannot say.
//
// WHY THIS EXISTS. It is the page-body twin of `live-chrome-gap.ts`, and it exists
// because the gap that file describes turned out to be the smaller half.
//
// A product page is STAMPED from the catalog once, on the day the site is made, and
// never re-reads it. `upgradePageBody` repairs a stale one the first time its owner
// opens it in the builder, and that repair lands on the DRAFT only. That is the right
// blast radius — the platform must never rewrite somebody's live site — but it means
// the site improves when the owner publishes, and an owner who likes their site and
// never goes back to the builder keeps the day-one page forever.
//
// MEASURED 2026-09-19, across every stored product page in the dev fleet. Thirteen are
// published and live, and every one of them has a working Add-to-cart form:
//
//   can say "Sold out"            0 of 13
//   can say "Made to order"       1 of 13
//   can say "Preorder, ships …"   0 of 13
//   can say "Back in stock …"     0 of 13
//
// NOT ONE live shop can tell a customer a thing is gone. Their form is not gated on
// `soldOut` either, so it renders in full on a product with nothing behind it: a live
// button, a firm price, and no sentence anywhere. Nobody was told. Issue 684.
//
// The first version of that table read "3 of 13" for sold out, and it was measured the
// obvious way: search the stored tree for the `soldOut` ref. Every tree has it —
// `versionChoice` gates each version on `soldOut` so a sold-out size greys itself out —
// so the count was of pages that have a version picker, not of pages that can say
// anything. The real number was zero. Presence is not placement, and it is the reason
// this file asks `missingDisclosures` rather than comparing sets of refs.
//
// DERIVED, NOT STORED, for the same reasons the chrome version is: a "we repaired you
// on Tuesday" flag would need a migration, a place to be cleared, and would go stale
// the moment somebody published from another device. This cannot. It is computed from
// what is live, and it disappears the instant the live site has it.
//
// DISCLOSURES ONLY. A missing sentence about supply is a missing CAPABILITY — the page
// physically cannot say a true thing about what is being sold. Ordinary authored
// differences are not listed; the existing "N pages have changes" line is the right
// home for those, and a diff of every node would be noise nobody could act on.
//
// IT CANNOT NAG ABOUT A DELETION, and that cuts both ways, exactly as the chrome
// version says of itself. The repair only adds what is absent, so an owner who
// deliberately deleted the sold-out notice and published that is told she is missing
// it. That is the honest cost of not being able to recover intent from a tree, and it
// is the safer direction to err in: the alternative is silence about a shop selling
// things it does not have.

import type { Node } from '@wizeworks/silicaui-html';

import { missingDisclosures, type DisclosureRef } from './upgrade-page';

/** One thing the published page cannot say. */
export interface PageGap {
  /** The binding ref that is missing — for grouping and for tests, never for display. */
  ref: string;
  /** What a VISITOR is missing right now, in the owner's words. */
  says: string;
  /**
   * WHICH of the two ways this site is behind, because they need different sentences
   * and different remedies. The same split as `ChromeGap`, and for the same reason
   * (issue 315).
   *
   *   · `'saved'`   — every page that lacks it already has it saved, and only a
   *                   publish is missing. Publishing resolves it.
   *   · `'waiting'` — at least one page has never been opened since the repair
   *                   existed, so its draft is exactly as stale as its live copy.
   *                   PUBLISHING RESOLVES NOTHING for that page. What resolves it is
   *                   opening the page, which is the read the repair runs on.
   *
   * Conservative on purpose: one un-opened page makes the whole row `waiting`. Telling
   * an owner to publish something a publish cannot fix is the failure this field
   * exists to prevent, and it is worse than telling her to open a page she has
   * already opened.
   */
  source: 'saved' | 'waiting';
  /** How many live pages are missing it, so a surface can say "on 2 of your pages"
   *  rather than implying the whole shop when one template is behind. */
  pages: number;
}

/**
 * What each missing disclosure costs the people using the shop.
 *
 * Written from the VISITOR's side and as a CAPABILITY rather than an incident: "when
 * something sells out, your page does not say so" is true and actionable for every
 * shop on the platform, where "you have a sold-out product right now" would be a
 * claim about stock this file cannot check and has no business making.
 *
 * A ref with no sentence here is not reported. A line an owner cannot act on trains
 * her to ignore the whole panel.
 */
const COSTS: Record<string, string> = {
  soldOut:
    'When something sells out, your page does not say so. The Add to cart button stays on it, and somebody can buy a thing you do not have.',
  'preorder.shown':
    'If you take preorders, your page cannot tell a customer that it is a preorder or when it ships.',
  backInStock: 'When you know the day a sold-out thing comes back, your page cannot tell anybody.',
  'madeToOrder.shown':
    'If something is made to order, your page cannot say how long it takes or that a deposit is due.',
};

/**
 * What every buy box on this page cannot say.
 *
 * Asks `missingDisclosures` — the SAME function the repair asks — rather than
 * comparing sets of binding refs, which is what the first version did and which was
 * wrong in the one way that mattered. `soldOut` appears inside the add-to-cart form
 * already, because `versionChoice` greys out a sold-out size with it, so a ref-set diff
 * reported that every stale page could say "sold out" when not one of them could.
 * Presence is not placement. [[feedback_test_as_a_business_owner]]
 */
function gapsIn(node: unknown, found = new Set<DisclosureRef>()): Set<DisclosureRef> {
  if (Array.isArray(node)) {
    for (const item of node) gapsIn(item, found);
    return found;
  }
  if (node && typeof node === 'object') {
    for (const ref of missingDisclosures(node as never)) found.add(ref);
    for (const value of Object.values(node as Record<string, unknown>)) gapsIn(value, found);
  }
  return found;
}

/** One stored page, as both trees. */
export interface PageTrees {
  draft: Node | null;
  published: Node | null;
}

/**
 * What the LIVE pages of a site cannot say.
 *
 * TWO SOURCES, the same two the chrome version has, because only reporting the first
 * would miss the owners who most need telling.
 *
 *   · **The saved draft has it.** She opened the page, the repair ran, and it is
 *     waiting on a publish.
 *   · **The repair would add it.** She has NEVER opened that page, so nothing has run
 *     and her draft is as old as her live page. Comparing draft to published finds
 *     nothing at all here — the two agree, and they are both stale. This is the common
 *     case and the invisible one, so the published tree is run through the repair IN
 *     MEMORY to ask what it would gain. Nothing is written; this is a read.
 *
 * A page with nothing published is skipped rather than reported as missing everything:
 * a page nobody can see is a different problem with a different sentence, and listing
 * four gaps against it would bury the one that matters. A page with no buy box gains
 * nothing from the repair and so reports nothing, which is how a contact page stays
 * out of this without needing to be recognised.
 */
export function livePageGaps(pages: readonly PageTrees[]): PageGap[] {
  /** ref → how many live pages lack it, and whether every one of them has it saved. */
  const missing = new Map<string, { pages: number; allSaved: boolean }>();

  for (const page of pages) {
    if (!page.published) continue;
    const live = gapsIn(page.published);
    if (live.size === 0) continue;
    // What her SAVED copy is still missing. A gap she has already healed is one a
    // publish resolves; a gap in both is one only opening the page can supply.
    const saved = page.draft ? gapsIn(page.draft) : live;

    for (const ref of live) {
      if (COSTS[ref] === undefined) continue;
      const seen = missing.get(ref) ?? { pages: 0, allSaved: true };
      missing.set(ref, { pages: seen.pages + 1, allSaved: seen.allSaved && !saved.has(ref) });
    }
  }

  return [...missing.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([ref, seen]) => ({
      ref,
      says: COSTS[ref]!,
      source: seen.allSaved ? ('saved' as const) : ('waiting' as const),
      pages: seen.pages,
    }));
}
