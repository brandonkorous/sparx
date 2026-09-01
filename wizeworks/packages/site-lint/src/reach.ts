// A page nobody can click their way to.
//
// THE MISSING DIRECTION. `links.ts` proves every link points at a page that exists.
// This proves the reverse: that every page has a link pointing at it. They sound like
// one check and they are not, and only one of them was written — so a site could be
// entirely green while holding a page no visitor will ever reach.
//
// It is the same asymmetry the platform keeps producing: the outward direction gets
// checked because something visibly breaks, and the inward one does not because
// nothing does. An unreachable page renders perfectly. It is in the sitemap. Open it
// by address and it is exactly right. The only thing wrong with it is that the road
// to it was never built, and there is no screen anywhere that shows a page's roads.
//
// WHAT IT COSTS, in the case it was written for: an apparel maker wrote a size guide
// and a shipping-and-returns page, published both, and linked neither. Her product
// pages discuss fit at length. The one page that would have answered the question and
// prevented the return was reachable only by typing its address.
//
// CONSERVATIVE, like everything else here. Telling an owner a working page is broken
// costs more than missing one that is, so a page is only reported when nothing could
// plausibly be reaching it. Three whole classes are exempt on principle:
//
//   · The home page. It is the root; the address bar reaches it.
//   · Record templates. `/products/:handle` is a pattern, not a place — visitors
//     arrive from a listing, one record at a time.
//   · The storefront's own routes. `/cart`, `/search`, `/account/orders` and the rest
//     are reached by things the PLATFORM renders — a cart core, a search box, the
//     account area's own navigation — none of which is an authored link this can see.
//     A tenant page sitting at one of those addresses is reached the same way.
//
// What is left is exactly the authored page at an authored address: the kind an owner
// makes on purpose, and the only kind whose roads are hers to build.
//
// MEASURED before it was trusted, because a rule that fires on working sites is a rule
// people switch off. Across all 191 shipped blueprints (1,173 pages) it reports NOTHING
// — every starter site links every page it ships. On the apparel site above, 21 pages
// published, it reports exactly two, and they are the two.

import type { DocumentInventory } from './walk';
import type { PageAddress } from './types';
import type { RawFinding } from './finding';
import { addressOf, isTemplate } from './addresses';
import { classifyHref, findLinks } from './links';
import { inOpenSubtree, normalizePath } from './routes';
import { isRecordAddress } from '@wizeworks/silica-catalog';

/**
 * Addresses the storefront reaches by itself, with no authored link involved.
 *
 * ITS OWN LIST, NOT `BUILTIN_PATHS`, and the difference is the whole reason this rule
 * went blind. `BUILTIN_PATHS` answers the OUTWARD question `links.ts` asks — does this
 * address exist, so a link to it is not broken. This rule asks the INWARD one: does
 * anything actually GET a visitor there. Those sets overlap and are not the same, and
 * borrowing the first to answer the second exempted three pages that nothing reaches.
 *
 * Everything below is reached by something the PLATFORM renders on every page: the
 * navbar's cart core opens `/cart`, the cart opens `/checkout`, the header's search
 * field opens `/search`, the account core opens `/account` and its subtree. Point at any
 * of them and you can name the control.
 *
 * `/products`, `/collections` and `/category` were in the borrowed list and are NOT here,
 * because no such control exists for them. They are browse indexes — a page of every
 * product, a page of every collection, a page of every category — seeded into every
 * commerce site by `starterPages` and reached only by an authored link. Exempting them
 * told this rule that something was reaching them, which is how an apparel maker's seven
 * curated collections, each with its own photograph and description, sat behind an
 * address no visitor could ever click (issue 340). Same failure shape as the size guide
 * this rule was written for; the rule was already here and had been talked out of it.
 *
 * `/book` stays: scheduling sites carry it in the nav by default, and the booking cores
 * link into it, so reporting one would be the false positive this file is careful about.
 */
const PLATFORM_REACHED: readonly string[] = [
  '/cart',
  '/checkout',
  '/checkout/save-card',
  '/search',
  '/book',
  '/account',
  // Not pages at all — no page row will ever sit at one. Listed so the set stays a
  // readable answer to "what does the platform reach" rather than a filtered subset.
  '/sitemap.xml',
  '/robots.txt',
  '/llms.txt',
];

function servedByPlatform(address: string): boolean {
  return PLATFORM_REACHED.includes(address) || inOpenSubtree(address);
}

/**
 * Every internal address any link on the site points at.
 *
 * Read from the SAME composed documents the link rules walk, which is what makes the
 * two directions agree: a link in the header counts for every page, a link inside a
 * saved component counts wherever that component is placed, and a destination filled
 * in by a data binding is skipped here exactly as it is skipped there.
 *
 * Relative hrefs are resolved against the page they were authored on, the way a
 * browser resolves them and the way `checkLinks` judges them. On a record template
 * there is no single page to resolve against, so they are left alone rather than
 * guessed at — the same call `checkLinks` makes, for the same reason.
 */
export function linkedPaths(inventories: readonly DocumentInventory[]): Set<string> {
  const reached = new Set<string>();
  for (const inventory of inventories) {
    const perRecord = isRecordAddress(inventory.page.slug) || inventory.page.kind === 'collection';
    const fromPath = perRecord ? null : normalizePath(inventory.page.slug);
    for (const link of findLinks(inventory.nodes)) {
      const classified = classifyHref(link.href, fromPath);
      if (classified.kind === 'internal') reached.add(classified.value);
    }
  }
  return reached;
}

/**
 * Pages with no way in.
 *
 * `pages` is every page the site HAS — the same roster `checkAddresses` reads, for the
 * same reason: a page nobody has opened yet is still a page nobody can reach.
 *
 * `reached` must come from a real walk. An empty set is ambiguous between "nothing
 * links anywhere" and "nothing was walked", and reporting every page on a site because
 * the caller passed no inventories is the worst false positive this package could
 * produce — so the caller is required to have walked something, and `lintSite` skips
 * this rule entirely when it has not.
 */
export function checkReach(
  pages: readonly PageAddress[],
  reached: ReadonlySet<string>
): RawFinding[] {
  const findings: RawFinding[] = [];
  for (const page of pages) {
    if (isTemplate(page)) continue;
    // Normalized, because the link side is: `addressOf` keeps a slug as authored, so a
    // page saved as `/size-guide/` would never match the `/size-guide` its own menu
    // link resolves to, and would report as unreachable from the link that reaches it.
    const address = normalizePath(addressOf(page));
    if (address === '/') continue;
    if (servedByPlatform(address)) continue;
    if (reached.has(address)) continue;

    findings.push({
      origin: { scope: 'page', ownerId: page.id, ownerName: page.name },
      nodeId: null,
      nodePath: '',
      rule: 'page-unreachable',
      severity: 'warning',
      title: `Nothing on your site links to ${page.name}`,
      detail:
        `${page.name} is part of your site and works perfectly if you already know its web ` +
        `address, but no link anywhere on your site points at ${address}. Nobody browsing ` +
        `your site can get to it by clicking, so the only visitors who will ever see it are ` +
        `the ones who find it through a search engine. Add a link to it from your menu, ` +
        `from your footer, or from a page where someone would go looking for it.`,
      evidence: address,
    });
  }
  return findings;
}
