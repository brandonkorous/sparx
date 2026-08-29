// What the LIVE header and footer are missing.
//
// WHY THIS EXISTS. The platform improves a tenant's header and footer without being
// asked: `upgradeFrameChrome` repairs a stale stored frame the first time its owner
// opens the studio, and the repair lands on the DRAFT only. That is the right blast
// radius — the platform must never rewrite somebody's live site — but it has a
// consequence nobody was ever told about. The site improves when the owner publishes,
// and an owner who installs a design, likes it, and never goes back to the builder
// keeps the day-one chrome forever.
//
// It is worse than silent. The repair flips "your header and footer have changes" on
// in the Publish pane, so the one thing the owner IS told is that she has unsaved work
// she does not remember doing, with no way to find out what it is. She can reasonably
// read that as a fault and roll it back.
//
// DERIVED, NOT STORED, on purpose. A stored "we repaired you on Tuesday" flag would
// need a migration, a place to be cleared, and would go stale the moment somebody
// published from another device. This cannot: it is computed from what is live, and it
// disappears the instant the live site has it.
//
// HOST CORES ONLY. A core is a mount point the platform renders live, so one the live
// site does not have is a missing CAPABILITY rather than a styling difference. Ordinary
// authored edits are not listed — the existing "N pages have changes" line is the right
// home for those, and a diff of every node would be noise nobody could act on.
//
// IT CANNOT NAG ABOUT A DELETION, and that cuts both ways. Both sources are
// conservative: the repair only ever rewrites a node that is already there — it swaps a
// stamped sign-in link, it does not invent one — so an owner who deliberately removed a
// control and published that is never told she is missing it.
//
// The cost of erring that way, said out loud rather than left to be discovered: a site
// whose design NEVER had a sign-in link is equally silent, because intent is not
// recoverable from a tree and the two look identical. Measured on the 22 live sites in
// the dev database, this reports 15 of them and stays quiet on 6 that have no account
// route at all. Those six are a different question — "your site is missing something
// every shop needs" is an advisory finding for the site check, not an unpublished
// change — and answering it here would mean guessing at intent.

import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS } from './host-nodes';
import { upgradeFrameChrome } from './upgrade-frame';

/** One capability the published site does not have yet. */
export interface ChromeGap {
  /** The host core key — for grouping and for tests, never for display. */
  core: string;
  /** What a VISITOR is missing right now, in the owner's words. */
  says: string;
  /**
   * WHICH of the two ways this site is behind, because they need different sentences
   * and different remedies (issue 315).
   *
   *   · `'saved'`   — her saved copy already has it and only a publish is missing.
   *                   Publishing resolves it.
   *   · `'waiting'` — nothing has run yet: her draft is exactly as stale as her live
   *                   site, and it is the automatic repair that supplies this. PUBLISHING
   *                   RESOLVES NOTHING — it republishes the same stale tree. What
   *                   resolves it is opening the header and footer, which is the read the
   *                   repair runs on.
   *
   * Telling an owner to publish a `waiting` gap sends her to a disabled button, which is
   * exactly what issue 315 was filed on.
   */
  source: 'saved' | 'waiting';
}

/**
 * What each missing core costs the people using the site.
 *
 * Written from the VISITOR's side rather than the tree's: "customers cannot get back to
 * their account" is a thing the owner can weigh, and "the frame is missing
 * site.account-link" is not. Only cores whose absence a person would actually notice are
 * listed — a core with no sentence here is not reported, because a line an owner cannot
 * act on trains her to ignore the whole panel.
 */
const COSTS: Record<string, string> = {
  [HOST_KEYS.siteAccountLink]:
    'Your customers have no way to get back to their account, their orders or a return.',
  [HOST_KEYS.siteLegalLinks]:
    'Your footer does not link to your privacy policy or your other legal pages.',
  [HOST_KEYS.siteBrand]: 'Your logo and business name are not showing in your header.',
  [HOST_KEYS.siteSocialLinks]:
    'The social accounts you listed in Site identity are not shown anywhere on your site.',
  [HOST_KEYS.siteThemeToggle]: 'Visitors cannot switch your site between its light and dark looks.',
};

/** Every host core key in a tree. */
function coresIn(node: unknown, found = new Set<string>()): Set<string> {
  if (Array.isArray(node)) {
    for (const item of node) coresIn(item, found);
    return found;
  }
  if (node && typeof node === 'object') {
    const n = node as Record<string, unknown>;
    if (n.kind === 'host' && typeof n.component === 'string') found.add(n.component);
    for (const value of Object.values(n)) coresIn(value, found);
  }
  return found;
}

/**
 * What the LIVE header and footer are missing.
 *
 * TWO SOURCES, because there are two ways to be behind and only reporting the first
 * would miss the owners who most need telling.
 *
 *   · **The saved draft has it.** She opened the builder, the repair ran on her draft,
 *     and it is waiting on a publish.
 *   · **The repair would add it.** She has NEVER opened the builder, so nothing has run
 *     and her draft is as old as her live site. Comparing draft to published finds
 *     nothing at all here — the two agree, and they are both stale. This is the common
 *     case and the invisible one, so the published tree is run through the repair IN
 *     MEMORY to ask what it would gain. Nothing is written; this is a read.
 *
 * They are told apart by `source`, and a caller MUST honour it. Publishing resolves the
 * first and does nothing at all for the second, so a surface that offers one button for
 * both sends half its readers to a disabled control (issue 315).
 *
 * Empty when nothing has ever been published: a site nobody can see is missing
 * everything, and listing four gaps beside "your website has never been published"
 * would bury the one sentence that matters.
 */
export function liveChromeGaps(draft: Node | null, published: Node | null): ChromeGap[] {
  if (!published) return [];
  const live = coresIn(published);
  const saved = draft ? coresIn(draft) : new Set<string>();
  const wanted = new Set([...saved, ...coresIn(upgradeFrameChrome(published).root)]);
  return [...wanted]
    .filter((core) => !live.has(core) && COSTS[core] !== undefined)
    .sort()
    .map((core) => ({
      core,
      says: COSTS[core]!,
      // `saved` wins when both are true: her copy already has it, so a publish really
      // does put it live, and that is the shorter road of the two.
      source: saved.has(core) ? ('saved' as const) : ('waiting' as const),
    }));
}
