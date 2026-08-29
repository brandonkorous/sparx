// Upgrade-on-read for a STALE stored frame (docs/122).
//
// THE PROBLEM THIS EXISTS FOR. A frame is a stamped node tree: copied at insert, frozen
// at publish. Improving the composite that produced it never reaches a tenant who has
// already published (docs/122 "Key facts"). Tenants who published before silica's
// `Wordmark` could carry a logo therefore have a TEXT-ONLY brand node in their header,
// forever — uploading a logo in Site settings changes nothing, because the stored tree
// says "render this text". There is no way for them to discover why, and the manual fix
// (find the node in the studio, drag in the brand core, delete the old one) is not
// something the non-technical business owner this platform is for will ever do.
//
// `siteNavbar()` now seeds the `site.brand` HOST core, which is immune to this by
// construction — but only for trees stamped AFTER it landed. This heals the ones before.
//
// WHY IT IS SAFE TO REWRITE SOMEONE'S TREE. It runs on the DRAFT at studio load, never
// on the published tree, so nothing changes for visitors until the tenant publishes
// themselves. The precedent is `ensureUniqueIds`, applied on the same path: "the healed
// ids persist on the next autosave, so the stored data self-corrects after one edit."
// The clobber guard (`wouldClobberSite`) compares PAGE ids and the frame lives on
// `builder_layout` — a frame heal changes no page ids, so it cannot trip it.
//
// DELIBERATELY NARROW. Each rule rewrites exactly one shape in exactly one place. These
// are dated repairs for known cohorts, not a general migration framework — they should be
// DELETED once the fleet has published through them. Before adding a rule, prefer making
// the thing LIVE (a host core) over healing it: the sorting rule is in `host-nodes.ts`.
// A heal earns its place only when the stale shape is already BROKEN on published sites,
// so making the thing live fixes the next tenant but leaves every existing one broken.
// Both rules here clear that bar:
//
//   1. The legacy text-only brand node — a logo upload that silently does nothing.
//   2. The hardcoded `/privacy-policy` + `/terms-of-service` footer links — two
//      guaranteed 404s on every site whose owner hasn't published those pages yet.

import type { Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';

/** silica's legacy brand primitive — a text-only `Wordmark` component node. */
const LEGACY_BRAND_COMPONENT = 'Wordmark';

/** The one `Node` member with children — every repair here walks or rebuilds one. */
type Element = Extract<Node, { kind: 'element' }>;

function isElement(node: Node): node is Element {
  return node.kind === 'element';
}

/** The legacy brand node: a `Wordmark` COMPONENT node, whatever it is bound to.
 *
 *  Matched on the component alone rather than on its binding or props: the shape drifted
 *  across versions (a bare bound span; later a `Wordmark` wrapping a bound Image + name),
 *  and every variant is equally stale — they are all stamped markup pretending to be the
 *  tenant's live identity. */
function isLegacyBrand(node: Node): boolean {
  return node.kind === 'component' && node.component === LEGACY_BRAND_COMPONENT;
}

function alreadyHasBrandCore(node: Node): boolean {
  if (node.kind === 'host' && node.component === HOST_KEYS.siteBrand) return true;
  const children = isElement(node) ? (node.children ?? []) : [];
  return children.some((c) => typeof c !== 'string' && alreadyHasBrandCore(c));
}

/** Replace the legacy brand node inside the frame's FIRST `<nav>`, preserving the
 *  author's wrapper class so a restyled mark keeps its styling. Returns null when there
 *  is nothing to do, so the caller can leave the tree byte-identical. */
function upgradeNav(nav: Extract<Node, { kind: 'element' }>): Node | null {
  const children = nav.children ?? [];
  const index = children.findIndex((c) => typeof c !== 'string' && isLegacyBrand(c));
  if (index === -1) return null;

  const legacy = children[index] as Extract<Node, { kind: 'component' }>;
  // Keep the author's classes: they may have restyled the mark (size, spacing,
  // alignment), and healing must not read as "the platform reset my header".
  const next = hostCore(HOST_KEYS.siteBrand, legacy.class);
  const upgraded = [...children];
  upgraded[index] = next;
  return { ...nav, children: upgraded };
}

/** The exact hrefs the starter footer used to author. Matched LITERALLY: an author who
 *  repointed "Privacy" at a page of their own keeps their link — only the platform's own
 *  seeded pair is stale, and only the platform's own pair is the one that 404s. */
const SEEDED_LEGAL_HREFS = new Set(['/privacy-policy', '/terms-of-service']);

function isSeededLegalLink(node: Node): boolean {
  return (
    isElement(node) &&
    node.tag === 'a' &&
    typeof node.attrs?.href === 'string' &&
    SEEDED_LEGAL_HREFS.has(node.attrs.href)
  );
}

function hasHostCore(node: Node, key: string): boolean {
  if (node.kind === 'host' && node.component === key) return true;
  const children = isElement(node) ? (node.children ?? []) : [];
  return children.some((c) => typeof c !== 'string' && hasHostCore(c, key));
}

/** Swap the seeded legal anchors for the live `site.legal-links` core, wherever in the
 *  footer they sit.
 *
 *  The core takes the position of the FIRST one and the rest are dropped, so the links
 *  stay exactly where the author put them — inside whatever column already held them,
 *  in the same order relative to its other links. That is why it is authored with an
 *  EMPTY heading: it is joining a column that already has a title ("More"), and a second
 *  "Legal" heading nested inside it would be wrong. A fresh frame gets the headed
 *  version, because there it IS the column (`siteFooter`).
 *
 *  Recursive rather than scoped to a fixed depth: the pair was seeded inside a footer
 *  link column, but an author may have moved or re-nested that column, and the links are
 *  equally broken wherever they ended up. */
function upgradeLegalLinks(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  const hasSeeded = children.some((c) => typeof c !== 'string' && isSeededLegalLink(c));
  if (hasSeeded) {
    const next: Node[] = [];
    let placed = false;
    for (const child of children) {
      if (typeof child !== 'string' && isSeededLegalLink(child)) {
        if (!placed) {
          placed = true;
          // Its own column so the links stack; `heading: ''` because the column it is
          // joining already has one.
          next.push(hostCore(HOST_KEYS.siteLegalLinks, 'flex flex-col gap-3', { heading: '' }));
        }
        continue;
      }
      next.push(child as Node);
    }
    return { ...node, children: next };
  }

  // Not at this level — recurse, rebuilding only the branch that actually changed so the
  // rest of the tree stays byte-identical.
  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string' || changed) return child;
    const upgraded = upgradeLegalLinks(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** The seeded socials slot: an EMPTY `<ul>`. `siteFooter` filled the footer block's three
 *  social slots with `null`, which collapses the row to a bare list with nothing in it. */
function isEmptySocialSlot(node: Node): boolean {
  return isElement(node) && node.tag === 'ul' && (node.children ?? []).length === 0;
}

/** The BRAND column of a footer — the element holding the `site.brand` core directly.
 *  Scoping to it is what keeps this repair from putting a business's Instagram somewhere
 *  arbitrary: the empty `<ul>` only means "socials" beside the brand mark, which is where
 *  every footer variant seeds it. */
function isBrandColumn(node: Node): boolean {
  if (!isElement(node)) return false;
  return (node.children ?? []).some(
    (c) => typeof c !== 'string' && c.kind === 'host' && c.component === HOST_KEYS.siteBrand
  );
}

/** Put the live `site.social-links` core where the seeded empty row sits.
 *
 *  Clears this file's bar for a heal: the seed emptied the block's placeholder links and
 *  put nothing in their place, so EVERY published frame carries a dead slot. Site
 *  identity says "add one and it appears in your footer", the resolver puts the links on
 *  `site.social` every render, and no node asks for them — so a shop owner who fills the
 *  field in sees exactly nothing, forever (issue 326). Seeding the core fixes the next
 *  tenant and leaves all of those broken, which is the whole test.
 *
 *  Takes the empty row's POSITION so the marks land where the footer already reserved
 *  space for them. When the author deleted the row, this does nothing at all rather than
 *  guess a new home — a repair that invents a placement is worse than one that declines. */
function upgradeSocialLinks(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  if (isBrandColumn(node)) {
    const index = children.findIndex((c) => typeof c !== 'string' && isEmptySocialSlot(c));
    if (index !== -1) {
      const swapped = [...children];
      swapped[index] = hostCore(HOST_KEYS.siteSocialLinks, 'mt-2 flex items-center gap-1');
      return { ...node, children: swapped };
    }
    return null;
  }

  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string' || changed) return child;
    const upgraded = upgradeSocialLinks(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** The exact href the starter navbar used to author for its secondary link. Matched
 *  LITERALLY, like the legal pair: an author who repointed it keeps their own link. */
const SEEDED_ACCOUNT_HREF = '/account/login';

/** Matched on the seeded DESTINATION, not on the tag.
 *
 *  Read from `attrs.href` OR `props.href`, because the navbar declares this link twice in
 *  two different node kinds: an `<a>` element in the bar and a `Button` COMPONENT in the
 *  phone panel, whose destination lives in `props`. A tag-based matcher finds the first
 *  and silently misses the second, which would leave a signed-in customer still told to
 *  sign in on her phone.
 *
 *  IT ALSO REQUIRED `slot.name === 'secondary'`, on the argument that the slot is written
 *  by the platform's own fill and by nothing else, so it is the precise handle. It is —
 *  for a frame the CURRENT composite built. The frames that most need this repair are
 *  older than the slot: the golden `sparx` bundle is a capture of a hand-authored navbar
 *  whose sign-in links carry no slot at all, and twenty one shipped designs are clones of
 *  it. The rule matched none of them, and so did nothing for the fifteen live sites still
 *  telling their signed-in customers to sign in (issues 291, 313).
 *
 *  So the href alone is the handle now, and it is a safe one for the same reason the legal
 *  pair is: it is matched LITERALLY, and swapping it is strictly better in both directions.
 *  A visitor who is a stranger still gets "Sign in" pointing at the sign-in form; a visitor
 *  who is signed in gets their own account instead of an invitation to sign in again. An
 *  author who repointed the link somewhere else keeps their own link untouched. */
function isSeededAccountLink(node: Node): boolean {
  const n = node as {
    attrs?: Record<string, unknown>;
    props?: Record<string, unknown>;
  };
  return (n.attrs?.href ?? n.props?.href) === SEEDED_ACCOUNT_HREF;
}

/** Swap the seeded "Sign in" anchor for the live `site.account-link` core, wherever in
 *  the header it sits.
 *
 *  EVERY occurrence, not the first: the navbar declares the secondary slot twice, once
 *  as an inline link in the bar and once as a full-width button in the phone panel, and
 *  healing only one would leave a signed-in customer still told to sign in on her phone.
 *  Each keeps its OWN class for the same reason the brand heal keeps the author's — the
 *  two placements are deliberately styled differently, and flattening them would read as
 *  the platform resetting their header.
 *
 *  Applied to the WHOLE frame rather than scoped to a region. The other two repairs are
 *  scoped (`<nav>`, `<footer>`) because a `Wordmark` or a privacy link elsewhere is
 *  plausibly the author's own content. This one is keyed to one literal destination that
 *  only ever means one thing, so wherever it sits the swap is right. It also genuinely
 *  moves — the bar's copy is in the header's end zone, a sibling of `<nav>` rather than
 *  inside it, which is why a nav-scoped version of this rule matched nothing. */
function upgradeAccountLink(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string') return child;
    if (isSeededAccountLink(child)) {
      changed = true;
      return hostCore(HOST_KEYS.siteAccountLink, (child as Element).class);
    }
    const upgraded = upgradeAccountLink(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** A footer anchor pointing at `href`, whatever its wrapper or styling. */
const isFooterLinkTo = (node: Node, href: string): node is Element =>
  isElement(node) && node.tag === 'a' && node.attrs?.href === href;

/** Two repairs to the footer's Account column, both narrow.
 *
 *  **The label.** It said "Sign in", pointing at `/account`. Unlike the header's, this
 *  link's destination was always right — `/account` sends a stranger to the sign-in form
 *  and a customer to her account — so only the word was false. "Your account" is true in
 *  both states, which is why the footer needs no live core (and should not show her name
 *  a second time). Matched on href AND the exact seeded label, so an author who renamed
 *  it keeps theirs.
 *
 *  **Returns.** Self-service returns ship with the account area, but a shop whose footer
 *  never mentions them still gets the emails. Seeded beside Orders for new sites, and
 *  inserted here for everyone already published — cloned from the Orders LINK UNIT so it
 *  arrives wearing whatever that column's links are wearing, rather than as a bare
 *  unstyled link in somebody's restyled footer. The unit, not the anchor: these blocks
 *  wrap each footer link in its own `<li>`, and pushing a second `<a>` inside that `<li>`
 *  puts two links in one list item. The clone drops `id` and `slot` — ids are re-minted
 *  by `ensureUniqueIds` on the write, and a duplicated fill point is not something to
 *  leave lying in a stored tree.
 *
 *  `addReturns` is decided ONCE for the whole footer and passed down. Asking "is Returns
 *  already here" at the current recursion level answers about one `<li>`, which is never
 *  the question — and a frame straight out of `siteFooter()`, which now seeds the link,
 *  got a second copy of it. */
function upgradeFooterAccountColumn(node: Node, addReturns: boolean): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  let changed = false;
  const next: NonNullable<Element['children']> = [];
  for (const child of children) {
    if (typeof child === 'string') {
      next.push(child);
      continue;
    }

    if (
      isFooterLinkTo(child, '/account') &&
      (child.children ?? []).length === 1 &&
      child.children?.[0] === 'Sign in'
    ) {
      changed = true;
      next.push({ ...child, children: ['Your account'] });
      continue;
    }

    const ordersUnit = addReturns ? asOrdersUnit(child) : null;
    if (ordersUnit) {
      changed = true;
      next.push(child);
      next.push(ordersUnit);
      continue;
    }

    const upgraded = upgradeFooterAccountColumn(child, addReturns);
    if (upgraded) {
      changed = true;
      next.push(upgraded);
      continue;
    }
    next.push(child);
  }
  return changed ? { ...node, children: next } : null;
}

/** A Returns copy of the Orders link unit, or null when this child is not one.
 *
 *  Handles both shapes these footers use: the anchor sitting straight in its column, and
 *  the anchor wrapped in its own `<li>`. The wrapper is cloned WITH its child so the new
 *  link is a sibling list item rather than a second link inside an existing one. */
function asOrdersUnit(child: Node): Node | null {
  // `isElement` FIRST: a type predicate that fails narrows its argument to the other
  // members of the union, and a later `isElement` on the same value is then `never`.
  if (!isElement(child)) return null;
  if (child.tag === 'a' && child.attrs?.href === '/account/orders') {
    const { id: _id, slot: _slot, ...rest } = child;
    return { ...rest, attrs: { href: '/account/returns' }, children: ['Returns'] };
  }
  const inner = child.children ?? [];
  if (inner.length !== 1) return null;
  const only = inner[0];
  if (only === undefined || typeof only === 'string') return null;
  if (!isFooterLinkTo(only, '/account/orders')) return null;
  const { id: _wid, slot: _wslot, ...wrapper } = child;
  const { id: _lid, slot: _lslot, ...link } = only;
  return {
    ...wrapper,
    children: [{ ...link, attrs: { href: '/account/returns' }, children: ['Returns'] }],
  };
}

/** Whether this subtree already links somewhere — so a repair that ADDS a link can be
 *  idempotent, and never doubles up on a tenant who added it themselves. */
function hasLinkTo(node: Node, href: string): boolean {
  if (!isElement(node)) return false;
  if (node.tag === 'a' && node.attrs?.href === href) return true;
  return (node.children ?? []).some((c) => typeof c !== 'string' && hasLinkTo(c, href));
}

/** Heal a stale frame. Pure — no DB, no IO — so it is safe to run on every studio load
 *  and trivial to test. `changed` lets the caller skip a pointless autosave.
 *
 *  Two independent repairs, each applied only if its own stale shape is present:
 *
 *   1. **Brand** — swap a legacy text-only brand node for the live `site.brand` core.
 *      Scoped to the frame's first `<nav>` on purpose: a `Wordmark` an author deliberately
 *      placed in the footer or mid-page is THEIR content, and rewriting it would be the
 *      platform overreaching. The header mark is the one the platform seeded and the one
 *      that is broken.
 *   2. **Legal links** — swap the seeded `/privacy-policy` + `/terms-of-service` anchors
 *      for the live `site.legal-links` core, scoped to the `<footer>` where they were
 *      seeded. Strictly better in both directions: a tenant who published those pages now
 *      gets EVERY legal document they published (cookie policy, returns…), and one who
 *      hasn't gets nothing instead of two 404s.
 *   3. **Account link** — swap the seeded `/account/login` nodes for the live
 *      `site.account-link` core, relabel the footer's "Sign in" to "Your account", and
 *      add the footer's missing **Returns** link.
 *      Clears the same bar as the other two: a stamped "Sign in" is already wrong on
 *      every published site the moment a customer signs in, so seeding the core fixes the
 *      next tenant and leaves every existing one telling their own customers they are
 *      strangers (issue 291).
 *   4. **Social links** — put the live `site.social-links` core in the empty `<ul>` the
 *      seed left beside the brand mark. Same bar again: Site identity promises the links
 *      appear in the footer, the resolver supplies them on every render, and no published
 *      frame has a node that asks for them (issue 326). */
export function upgradeFrameChrome(root: Node): { root: Node; changed: boolean } {
  if (!isElement(root)) return { root, changed: false };

  let next: Element = root;
  let changed = false;

  /** Rewrite the frame's first `<tag>` DESCENDANT through `repair`, or leave `next` alone
   *  (same object identity) when there is nothing to repair.
   *
   *  Descendant, not child. This searched the root's direct children only, and a real
   *  frame is `div > [header, main, footer]` with the navbar inside the `<header>` — so
   *  the nav repairs matched nothing on any actual tenant while the unit tests passed
   *  against a fixture that hoists `<nav>` to the top level (issue 296). "First `<nav>`"
   *  is still the scope the brand repair's blast radius is argued from; only the depth
   *  it is allowed to sit at has changed. */
  const healRegion = (tag: string, repair: (region: Element) => Node | null): void => {
    const walk = (node: Element): Node | null => {
      const children = node.children ?? [];
      const index = children.findIndex(
        (c) => typeof c !== 'string' && isElement(c) && c.tag === tag
      );
      if (index !== -1) {
        const repaired = repair(children[index] as Element);
        if (!repaired) return null;
        const swapped = [...children];
        swapped[index] = repaired;
        return { ...node, children: swapped };
      }
      // Not at this level — recurse, rebuilding only the branch that actually changed.
      let hit = false;
      const rebuilt = children.map((child) => {
        if (typeof child === 'string' || hit || !isElement(child)) return child;
        const repaired = walk(child);
        if (!repaired) return child;
        hit = true;
        return repaired;
      });
      return hit ? { ...node, children: rebuilt } : null;
    };
    const repaired = walk(next);
    if (!repaired || !isElement(repaired)) return;
    next = repaired;
    changed = true;
  };

  // Idempotent, and a no-op for anyone who already dragged the core in by hand.
  if (!alreadyHasBrandCore(next)) healRegion('nav', upgradeNav);
  if (!hasHostCore(next, HOST_KEYS.siteLegalLinks)) healRegion('footer', upgradeLegalLinks);
  if (!hasHostCore(next, HOST_KEYS.siteSocialLinks)) healRegion('footer', upgradeSocialLinks);
  if (!hasHostCore(next, HOST_KEYS.siteAccountLink)) {
    const healed = upgradeAccountLink(next);
    if (healed && isElement(healed)) {
      next = healed;
      changed = true;
    }
  }
  healRegion('footer', (footer) =>
    upgradeFooterAccountColumn(footer, !hasLinkTo(footer, '/account/returns'))
  );

  return { root: next, changed };
}
