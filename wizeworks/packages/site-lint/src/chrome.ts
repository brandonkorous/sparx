// What the shared header and footer OFFER, as distinct from whether they work.
//
// `structure.ts` next door checks that the chrome still FUNCTIONS — that the page has
// somewhere to appear, that nothing points at a deleted piece. This file checks that it
// still offers a visitor the things the site can actually do. They are different
// failures: a frame with no outlet is broken and looks broken, while a frame with no way
// into an account renders perfectly and simply strands every customer the site has.
//
// WHY THIS EXISTS (issue 313). Twenty four of the platform's shipped designs carried a
// header with no account control of any kind, and six sites live in the dev database
// were built from one of them. Their customers had an order history, a returns flow and
// a saved address book, and no link to any of it from anywhere on the site.
//
// THE HALF `liveChromeGaps` CANNOT COVER. `@wizeworks/silica-catalog`'s `liveChromeGaps`
// answers the other side of the same issue — a site whose chrome the platform CAN
// repair, waiting only on a publish — and it is deliberately silent here. It reports
// what the automatic repair would add, and that repair only ever rewrites a control that
// is already there: it swaps a stamped "Sign in" for the live one, it never invents an
// account link where none exists. Which is right. Inventing controls in somebody's
// header is not the platform's to do.
//
// So the two together are the whole answer and neither overlaps the other: the repair
// speaks for the sites that HAVE the control in an old form, and this speaks for the
// sites that have nothing. Nothing can tell "never had one" from "took it out on
// purpose" by reading a tree, which is why this is a warning addressed to the owner
// rather than anything stronger, and why it stays silent unless the caller has confirmed
// there are accounts to reach at all.

import { HOST_KEYS } from '@wizeworks/silica-catalog';

import type { RawFinding } from './finding';
import { classifyHref, findLinks } from './links';
import type { SiteCapabilities } from './types';
import type { DocumentInventory, VisitedNode } from './walk';
import { FRAME_OWNER_NAME } from './walk';

const FRAME_ORIGIN: RawFinding['origin'] = {
  scope: 'frame',
  ownerId: null,
  ownerName: FRAME_OWNER_NAME,
};

/**
 * Does this href go into the signed-in area?
 *
 * `/account` itself, and everything under it: `/account/login` is the stamped link the
 * platform's own designs ship, and `/account/orders` is what an author who wired their
 * own "My orders" button typed. All of them are a route in, which is the entire question
 * — this rule asks whether a customer can GET there, never which door was used.
 *
 * Resolved against `/` rather than against the page being walked, deliberately. A header
 * link is authored once and met on every page, so resolving it per page would make the
 * answer depend on which page happened to be walked, and a relative `account` in a
 * header would read as reachable from `/` and broken from `/about`.
 */
function reachesAccount(href: string): boolean {
  const target = classifyHref(href, '/');
  if (target.kind !== 'internal') return false;
  return target.value === '/account' || target.value.startsWith('/account/');
}

/** The live account control, which the platform renders itself — "Sign in" to a
 *  visitor, their own name and a route to their orders once they are signed in. */
function isAccountCore(visited: VisitedNode): boolean {
  const { node } = visited;
  return node.kind === 'host' && node.component === HOST_KEYS.siteAccountLink;
}

/**
 * Nothing anywhere in the chrome leads to an account.
 *
 * SILENT UNLESS THE CALLER LOOKED. `capabilities.customerAccounts` follows the same
 * contract as `LinkTargets`, for the same reason: `undefined` means nobody asked whether
 * this site has accounts, and a site with no accounts to reach is not missing a link to
 * them. A photographer's portfolio, a restaurant's menu and a parish newsletter are all
 * complete without one, and telling their owners to add a sign-in button would be the
 * check inventing work.
 *
 * SILENT WHEN ANY ROUTE EXISTS. The live host core counts, a hand-written `<a
 * href="/account">` counts, a Button whose href is `/account/orders` counts, and so does
 * the stamped "Sign in" the older designs shipped — that one is a different complaint
 * (it tells a signed-in customer they are a stranger, issue 291) with its own fix and its
 * own telling, and reporting it here as well would be two rows for one edit.
 *
 * Reported once for the frame however many pages it was met on, which is what
 * `mergeFindings` does with every frame-scoped finding: the fix is one edit in one
 * place, and `seenOn` carries the fact that it costs a visitor on all of them.
 */
export function checkChrome(
  inventory: DocumentInventory,
  capabilities: SiteCapabilities | undefined
): RawFinding[] {
  const chrome = inventory.nodes.filter((visited) => visited.origin.scope === 'frame');
  // No frame was supplied at all. A site rendering its pages bare has no header to be
  // missing a link FROM, and "add an account link to your header" would name a thing
  // that does not exist.
  if (chrome.length === 0) return [];

  return [...checkAccountLink(chrome, capabilities), ...checkCart(chrome, capabilities)];
}

function checkAccountLink(
  chrome: VisitedNode[],
  capabilities: SiteCapabilities | undefined
): RawFinding[] {
  if (capabilities?.customerAccounts !== true) return [];
  if (chrome.some(isAccountCore)) return [];
  if (findLinks(chrome).some((link) => reachesAccount(link.href))) return [];

  return [
    {
      origin: FRAME_ORIGIN,
      nodeId: null,
      nodePath: '',
      rule: 'chrome-no-account-link',
      severity: 'warning',
      title: 'Customers have no way to reach their account',
      detail:
        'Your header and footer have no link into the account area, so someone who has bought ' +
        'from you cannot sign in, look up what they ordered, start a return, or change the ' +
        'address you ship to: even though all of that is waiting for them. Open your header ' +
        'and footer and put the account link in the top bar: it says "Sign in" to a visitor and ' +
        'shows a customer their own name once they are signed in.',
    },
  ];
}

/** The live header cart, which shows a shopper's count and opens her basket. */
function isCartCore(visited: VisitedNode): boolean {
  const { node } = visited;
  return node.kind === 'host' && node.component === HOST_KEYS.siteCartButton;
}

/** Does this href go to the cart page? Resolved against `/`, as `reachesAccount` is. */
function reachesCart(href: string): boolean {
  const target = classifyHref(href, '/');
  return target.kind === 'internal' && target.value === '/cart';
}

/** Whether a node sits in the footer, by its trail of tags. */
const inFooter = (nodePath: string): boolean => nodePath.split(' › ').includes('footer');

/**
 * A shop whose header has no way back to the basket.
 *
 * MEASURED 2026-10-17 on Gillett Diesel (sparx persona issue 325): the cart drawer opens
 * once, on Add to cart, and once a shopper closed it the only route back to what she had
 * chosen was a "Cart" link at the foot of the page. No design shipped a cart in its
 * header, so every silica-framed shop on the platform was the same.
 *
 * THE FOOTER DOES NOT COUNT. Unlike the account link, where any route in is the whole
 * question, a cart is the control a shopper reaches for at the top of every page, and a
 * footer link is exactly what Gillett had. The live core counts anywhere it is placed; a
 * hand-written link to `/cart` counts when it is outside the footer.
 *
 * Silent unless the caller confirmed this site shows its shop (`capabilities.shop`).
 */
function checkCart(
  chrome: VisitedNode[],
  capabilities: SiteCapabilities | undefined
): RawFinding[] {
  if (capabilities?.shop !== true) return [];
  if (chrome.some(isCartCore)) return [];
  if (findLinks(chrome).some((link) => reachesCart(link.href) && !inFooter(link.visited.nodePath)))
    return [];

  return [
    {
      origin: FRAME_ORIGIN,
      nodeId: null,
      nodePath: '',
      rule: 'chrome-no-cart',
      severity: 'warning',
      title: 'Shoppers cannot get back to their cart',
      detail:
        'Your header has no cart. The cart opens once, when someone adds an item, and after ' +
        'they close it the only way back to what they chose is a link at the bottom of the ' +
        'page. Open your header and footer and put the cart button in the top bar: it shows ' +
        'how many items are in the cart and opens it from any page.',
    },
  ];
}
