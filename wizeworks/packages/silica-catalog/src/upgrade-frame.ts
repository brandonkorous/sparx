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

import { bind, type Node } from '@wizeworks/silicaui-html';

import { HOST_KEYS, hostCore } from './host-nodes';
import { headerToInsideMeasure, insideMeasure, isCapturedHeader } from './page-measure';

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

/** The social row every footer block reserves, as the SEED leaves it: an empty `<ul>`
 *  wearing the block's own row classes. `siteFooter` filled the three social slots with
 *  `null` rather than publish three dead `#` links, which collapses the row to a bare
 *  list with nothing in it.
 *
 *  Matched on `items-center` + `gap-5` LITERALLY, the way the legal pair is matched on
 *  its hrefs, and measured before it was written. The alternative — "an empty `<ul>` in
 *  the footer" — is ambiguous: the `columns` block leaves THREE, because the emptied
 *  second link column (`flex flex-col gap-2`) and the dropped copyright-row link trio
 *  (`flex flex-wrap items-center gap-x-6 gap-y-2`) collapse the same way. Those two are
 *  link lists that happen to be empty; this is the row the block reserved for marks, and
 *  the two classes are what separate them.
 *
 *  It replaced an earlier handle that looked for the empty row beside the `site.brand`
 *  core, on the argument that beside the brand mark is where every variant seeds it. It
 *  is not: the `newsletter` footer puts its social row in the BOTTOM BAR next to the
 *  copyright, so that rule reached 123 of the 191 shipped designs and structurally could
 *  not reach the other 46 — the same shape of miss the account link made by keying on a
 *  slot the older frames were written before (issue 313). */
function isSeededSocialRow(node: Node): boolean {
  if (!isElement(node) || node.tag !== 'ul') return false;
  if ((node.children ?? []).length > 0) return false;
  const classes = (node.class ?? '').split(/\s+/);
  return classes.includes('items-center') && classes.includes('gap-5');
}

/** All the core needs, in either placement: a little air above it.
 *
 *  NOT the row's own `flex items-center gap-5`. `SocialLinks` lays the marks out itself
 *  (`flex flex-wrap items-center gap-1`), so handing it a second row class puts two
 *  `gap-*` utilities on one element, and which of them wins is decided by stylesheet
 *  order rather than by anything written here. The row it replaces sits inside a column
 *  that already spaces its children, so the layout the `<ul>` was carrying is not lost —
 *  it was never the `<ul>`'s to carry once a component owns the row. */
const SOCIAL_CORE_CLASS = 'mt-2';

/** Put the live core where the block reserved the row. */
function placeInReservedRow(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  const index = children.findIndex((c) => typeof c !== 'string' && isSeededSocialRow(c));
  if (index !== -1) {
    const swapped = [...children];
    swapped[index] = hostCore(HOST_KEYS.siteSocialLinks, SOCIAL_CORE_CLASS);
    return { ...node, children: swapped };
  }

  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string' || changed) return child;
    const upgraded = placeInReservedRow(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

function containsTag(node: Node, tag: string): boolean {
  if (!isElement(node)) return false;
  if (node.tag === tag) return true;
  return (node.children ?? []).some((c) => typeof c !== 'string' && containsTag(c, tag));
}

function containsAnyHostCore(node: Node): boolean {
  if (node.kind === 'host') return true;
  const children = isElement(node) ? (node.children ?? []) : [];
  return children.some((c) => typeof c !== 'string' && containsAnyHostCore(c));
}

/** The footer's own column grid — the same handle `siteFooter`'s `columnHome` uses, so
 *  the two agree about what a footer's columns are. */
function isColumnGrid(node: Node): boolean {
  return isElement(node) && ` ${node.class ?? ''} `.includes(' grid ');
}

/** The cohort with NO reserved row: put the core at the foot of the identity column.
 *
 *  Twenty two shipped designs are clones of the golden `sparx` bundle, whose site half is
 *  CAPTURED from the live Template property rather than generated — so its footer predates
 *  the social slots entirely and predates the `site.brand` core with them. Its first column
 *  is a stamped name and blurb: no link, no live core, nothing the platform can key on
 *  except that absence, which is exactly what dates it.
 *
 *  So the column is identified by what a brand column has and a link column does not: no
 *  anchors and no host cores anywhere inside it. A column carrying a live core is from the
 *  era that HAD the row, and an author who deleted it there gets no replacement invented
 *  for them — this places a row only where there was never one to delete.
 *
 *  Appended last, under the blurb, which is where the composite's own row sits. */
function placeInIdentityColumn(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];

  if (isColumnGrid(node)) {
    const index = children.findIndex((c) => typeof c !== 'string' && isElement(c));
    if (index === -1) return null;
    const column = children[index] as Element;
    if (containsTag(column, 'a') || containsAnyHostCore(column)) return null;
    const swapped = [...children];
    swapped[index] = {
      ...column,
      children: [
        ...(column.children ?? []),
        hostCore(HOST_KEYS.siteSocialLinks, SOCIAL_CORE_CLASS),
      ],
    };
    return { ...node, children: swapped };
  }

  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string' || changed) return child;
    const upgraded = placeInIdentityColumn(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** Give a published footer somewhere to draw the tenant's own social accounts.
 *
 *  Clears this file's bar for a heal: the seed emptied the block's placeholder links and
 *  put nothing in their place, so EVERY published frame carries a dead slot. Site
 *  identity says "add one and it appears in your footer", the resolver puts the links on
 *  `site.social` every render, and no node asks for them — so a shop owner who fills the
 *  field in sees exactly nothing, forever (issue 326). Seeding the core fixes the next
 *  tenant and leaves all of those broken, which is the whole test.
 *
 *  The reserved row first, because that is the position the footer was designed around.
 *  The identity column only when there is no row anywhere in the footer — the captured
 *  cohort, which never had one. Anything else declines: a repair that invents a placement
 *  in somebody's footer is worse than one that leaves it alone, and the core is not
 *  pinned, so she can drag it in wherever she likes. */
function upgradeSocialLinks(node: Node): Node | null {
  return placeInReservedRow(node) ?? placeInIdentityColumn(node);
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

/** The lines the PLATFORM wrote under the business name in a footer. The first is the
 *  platform's own pitch, captured into the golden `sparx` design and cloned into every
 *  design made from it, so a diesel shop's footer told its customers "Everything you
 *  publish and sell, in one place" (issue 851 fixed the generated starter; sparx persona
 *  issue 046 found the shipped designs still carrying it). The second is what replaced
 *  it in the starter. Matched LITERALLY: a line the owner wrote is theirs. */
const SEEDED_FOOTER_BLURBS = new Set([
  'Everything you publish and sell, in one place.',
  'Glad you found us. Get in touch any time.',
]);

/** What a footer blurb shows while the owner has no tagline. */
export const FOOTER_BLURB_FALLBACK = 'Glad you found us. Get in touch any time.';

/** Bind the platform-written footer blurb to the owner's tagline.
 *
 *  Site identity has a Tagline field, and the footer sat one line under the business
 *  name saying something the platform wrote instead. Bound, it shows his tagline
 *  ("Diesel Done Right Since 1986!") on every page, and follows it when he changes it.
 *  A site with no tagline keeps the fallback: the site resolves an unset tagline as
 *  `null`, which leaves the authored text in place rather than blanking it. */
function upgradeFooterBlurb(node: Node): Node | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];
  const only = children.length === 1 ? children[0] : undefined;
  if (!node.data && typeof only === 'string' && SEEDED_FOOTER_BLURBS.has(only.trim())) {
    return bind({ ...node, children: [FOOTER_BLURB_FALLBACK] }, 'site.identity.tagline');
  }
  let changed = false;
  const next = children.map((child) => {
    if (typeof child === 'string') return child;
    const upgraded = upgradeFooterBlurb(child);
    if (!upgraded) return child;
    changed = true;
    return upgraded;
  });
  return changed ? { ...node, children: next } : null;
}

/** The same binding for a footer being BUILT, so the starter's own footer ships bound
 *  and a fresh frame never needs healing (`siteFooter`). */
export function bindFooterBlurb(footer: Node): Node {
  return upgradeFooterBlurb(footer) ?? footer;
}

/** The class lists below are read as WORDS, never as substrings: `btn-primary` must not
 *  match `btn-primary-content`, and `hidden` must not match `@sm:hidden`. */
const classWords = (node: Node): string[] =>
  isElement(node) || node.kind === 'host' ? (node.class ?? '').split(/\s+/).filter(Boolean) : [];

const hasClass = (node: Node, word: string): boolean => classWords(node).includes(word);

/** The phone menu, as the captured header shipped it: a `<details>` disclosure shown
 *  only below `@sm`. Once repaired it reads `@5xl:hidden`, which is what keeps the repair
 *  from running twice. */
const isPhoneMenu = (node: Node): node is Element =>
  isElement(node) && node.tag === 'details' && hasClass(node, '@sm:hidden');

/** The header's primary call to action, still showing on a phone: a filled primary
 *  button link in the bar. One the author already hid is not ours to move. */
const isPhoneVisibleCta = (node: Node): node is Element =>
  isElement(node) &&
  node.tag === 'a' &&
  hasClass(node, 'btn') &&
  hasClass(node, 'btn-primary') &&
  !hasClass(node, 'hidden');

/** The bar's light/dark switch, still taking a place in the bar on a phone. Its host
 *  wrapper is a flex item even when the site offers one look and the switch draws
 *  nothing, so it costs the bar a gap whether or not anyone can see it. */
const isPhoneVisibleToggle = (node: Node): boolean =>
  node.kind === 'host' && node.component === HOST_KEYS.siteThemeToggle && !hasClass(node, 'hidden');

/** The display words a toggle wrapper may carry, swapped for the phone pair below. */
const DISPLAY_WORDS = new Set(['flex', 'inline-flex', 'block', 'inline-block', 'inline']);

/** The switch as it sits in the phone menu: a row of its own under the links. */
const MENU_TOGGLE_CLASS = 'inline-flex items-center';

/** The width at which the bar trades its Menu for its full set of links, button and
 *  switch. It was `@sm` (384px), and the full set needs about 715px with five links,
 *  about 800px with six (Gillett's), and 760px to 860px once the switch and a longer
 *  name join them. So from 384px up the links came back into a bar too narrow for them,
 *  and the header ran off the side of the screen with the logo squeezed out of it: the
 *  phone defect again, on every tablet. `@3xl` (768px) still left six links short, so
 *  it is `@5xl` (1024px), the first step of the container set that holds a bar of up
 *  to seven links with the switch, or eight without it. */
const SWITCH_FROM = '@sm:';
const SWITCH_TO = '@5xl:';

/** How the bar's light/dark switch hides on a phone and comes back at the bar's switch,
 *  so it and the Menu trade places at exactly the same width. */
const BAR_PHONE_HIDDEN_CLASSES = ['hidden', '@5xl:inline-flex'];

/** The same for the bar's CTA, which comes back as the box silicaui's `.btn` is drawn
 *  as. The button centers its words with `align-content`, which works in a block box
 *  and does nothing in a single-line flex box, so a CTA shown again as `inline-flex`
 *  drew "Get in touch" against the top of its own fill on every wide screen (sparx
 *  persona issue 328). A button that holds an icon is centered by silicaui's own
 *  `.btn:has(svg)` flex rule, and the CTA here holds words. */
const BAR_CTA_SHOWN = '@5xl:inline-block';
const BAR_CTA_HIDDEN_CLASSES = ['hidden', BAR_CTA_SHOWN];

/** A bar button this file once showed again as `inline-flex`, with words and no icon:
 *  the shape issue 328 is about. */
const isFlexShownCta = (node: Element): boolean =>
  hasClass(node, 'btn') &&
  hasClass(node, 'hidden') &&
  hasClass(node, '@5xl:inline-flex') &&
  (node.children ?? []).every((c) => typeof c === 'string');

/** Show every such button again as a block box, so silicaui centers its words. Runs on
 *  headers the phone repair already rewrote, which that repair no longer matches. */
export function centerBarButtons(node: Node): Node | null {
  if (!isElement(node)) return null;
  if (isFlexShownCta(node)) {
    return {
      ...node,
      class: classWords(node)
        .map((w) => (w === '@5xl:inline-flex' ? BAR_CTA_SHOWN : w))
        .join(' '),
    };
  }
  const children = node.children ?? [];
  let changed = false;
  const rebuilt = children.map((child) => {
    if (typeof child === 'string') return child;
    const next = centerBarButtons(child);
    if (!next) return child;
    changed = true;
    return next;
  });
  return changed ? { ...node, children: rebuilt } : null;
}

/** Move every `@sm:` word in the bar's group to the switch width, so the links, the
 *  Menu, the group's spacing and the moved controls all change at the same place. */
function atSwitch(node: Node): Node {
  if (typeof node === 'string') return node;
  if (!isElement(node) && node.kind !== 'host') return node;
  const words = classWords(node);
  const moved = words.map((w) =>
    w.startsWith(SWITCH_FROM) ? SWITCH_TO + w.slice(SWITCH_FROM.length) : w
  );
  const withClass = moved.some((w, i) => w !== words[i])
    ? { ...node, class: moved.join(' ') }
    : node;
  if (!isElement(withClass)) return withClass;
  const children = withClass.children ?? [];
  const rebuilt = children.map((c) => (typeof c === 'string' ? c : atSwitch(c)));
  return rebuilt.some((c, i) => c !== children[i])
    ? { ...withClass, children: rebuilt }
    : withClass;
}

/** The CTA as it sits in the phone menu: the same filled primary button, full width at
 *  the foot of the list, so it is still the one thing on the menu that is the point. */
const MENU_CTA_CLASS = 'btn btn-primary btn-sm btn-block mt-1';

/** The element in the menu that holds its links — the first one with a link (or a live
 *  account core) as a direct child. */
function menuList(menu: Element): Element | null {
  const children = menu.children ?? [];
  if (
    children.some(
      (c) => typeof c !== 'string' && (isElement(c) ? c.tag === 'a' : c.kind === 'host')
    )
  ) {
    return menu;
  }
  for (const child of children) {
    if (typeof child === 'string' || !isElement(child)) continue;
    const hit = menuList(child);
    if (hit) return hit;
  }
  return null;
}

/** Rebuild `node` with `target` (found by identity) replaced, or null when it is not in
 *  this subtree. Only the branch that holds it is rebuilt. */
function replaceNode(node: Node, target: Node, next: Node): Node | null {
  if (node === target) return next;
  if (!isElement(node)) return null;
  const children = node.children ?? [];
  let hit = false;
  const rebuilt = children.map((child) => {
    if (typeof child === 'string' || hit) return child;
    const replaced = replaceNode(child, target, next);
    if (!replaced) return child;
    hit = true;
    return replaced;
  });
  return hit ? { ...node, children: rebuilt } : null;
}

/** The first `site.brand` core in a subtree. */
function findBrandCore(node: Node): Extract<Node, { kind: 'host' }> | null {
  if (node.kind === 'host' && node.component === HOST_KEYS.siteBrand) return node;
  if (!isElement(node)) return null;
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const hit = findBrandCore(child);
    if (hit) return hit;
  }
  return null;
}

/** The first phone menu in a subtree, with the element that holds it. */
function findPhoneMenu(node: Node): { menu: Element; group: Element } | null {
  if (!isElement(node)) return null;
  const children = node.children ?? [];
  const menu = children.find((c): c is Element => typeof c !== 'string' && isPhoneMenu(c));
  if (menu) return { menu, group: node };
  for (const child of children) {
    if (typeof child === 'string') continue;
    const hit = findPhoneMenu(child);
    if (hit) return hit;
  }
  return null;
}

/** Make the header fit a phone without losing the logo (sparx persona issue 291).
 *
 *  THE SHAPE IT REPAIRS. The captured golden header, which twenty two shipped designs are
 *  built from: a bar of `[brand, group]` where the group holds the desktop links (hidden
 *  below `@sm`), a `<details>` Menu (shown below `@sm`), the account link and a filled
 *  primary button. At 360px the group needed about 296px of a 295px bar, and the brand
 *  was the only flex item allowed to shrink, so the logo collapsed to 0px and the page
 *  still scrolled 2px sideways. Every phone visitor saw a header with no business in it.
 *
 *  THE REPAIR, in one place:
 *   1. the brand core gets `shrink-0`, so the logo is drawn at its own size whatever
 *      else is in the bar;
 *   2. the bar's primary button is hidden below the switch (`hidden @5xl:inline-block`),
 *      the width at which the bar's links hide and the Menu appears;
 *   3. a copy of that button becomes the menu's last item, a full-width primary button,
 *      so the call to action is one tap away on a phone and nothing is lost;
 *   4. the light/dark switch does the same, into its own row of the menu. Its wrapper
 *      took a place (and a gap) in the bar even on a site with one look, where it draws
 *      nothing, and at 320px with a switch and a seven-letter name the bar was 31px over;
 *   5. the switch itself moves from `@sm` to `@5xl` (see `SWITCH_TO`): the full bar needs
 *      715px to 860px, so from 384px up the links came back into a bar too narrow for them.
 *  The account link stays on the bar: a signed-in customer's own name is how she knows
 *  she is signed in.
 *
 *  Matched on the menu's own `@sm:hidden` and the visible button or switch beside it,
 *  the way the legal pair is matched on its hrefs: an author who already hid them or
 *  built a different phone header is left alone. It clears this file's bar for a heal
 *  because the stale shape is broken on every published site built from it, and fixing
 *  the bundles reaches only the next install. */
export function fitHeaderOnPhone(nav: Node): Node | null {
  if (!isElement(nav)) return null;
  const found = findPhoneMenu(nav);
  if (!found) return null;

  let next: Node = nav;
  let changed = false;

  const ctas = (found.group.children ?? []).filter(
    (c): c is Element => typeof c !== 'string' && isPhoneVisibleCta(c)
  );
  const toggles = (found.group.children ?? []).filter(
    (c): c is Node => typeof c !== 'string' && isPhoneVisibleToggle(c)
  );
  const moving: Node[] = [...toggles, ...ctas];
  const list = menuList(found.menu);
  let group: Node = found.group;
  if (moving.length > 0 && list) {
    const copies: Node[] = [
      // The switch first, then the button: the button stays the last thing on the menu.
      ...toggles.map(() => hostCore(HOST_KEYS.siteThemeToggle, MENU_TOGGLE_CLASS)),
      ...ctas.map((cta): Node => ({
        kind: 'element',
        tag: 'a',
        ...(cta.attrs ? { attrs: { ...cta.attrs } } : {}),
        class: MENU_CTA_CLASS,
        children: [...(cta.children ?? [])],
      })),
    ];
    // The list first, inside the group as it stands (the menu is one of its children),
    // then the CTAs in that rebuilt group, then the group in the header.
    const withList = replaceNode(found.group, list, {
      ...list,
      children: [...(list.children ?? []), ...copies],
    });
    if (withList && isElement(withList)) {
      group = {
        ...withList,
        children: (withList.children ?? []).map((c) => {
          if (typeof c === 'string' || !moving.includes(c)) return c;
          // The toggle's own display word goes: `hidden` and `inline-flex` side by side
          // would leave which one wins to stylesheet order.
          const isToggle = toggles.includes(c);
          const kept = isToggle
            ? classWords(c).filter((w) => !DISPLAY_WORDS.has(w))
            : classWords(c);
          const hiding = isToggle ? BAR_PHONE_HIDDEN_CLASSES : BAR_CTA_HIDDEN_CLASSES;
          return { ...c, class: [...kept, ...hiding].join(' ') } as Node;
        }),
      };
    }
  }
  group = atSwitch(group);
  if (group !== found.group) {
    const replaced = replaceNode(next, found.group, group);
    if (replaced) {
      next = replaced;
      changed = true;
    }
  }

  // Found again in the tree as it now stands: the step above rebuilds every element on
  // the path it walked, and a node taken from the old tree would match nothing here.
  // A brand core with no class of its own wears the component's default, which already
  // carries `shrink-0`; writing a class here would REPLACE that default, not add to it.
  const brand = findBrandCore(next);
  if (brand?.class && !hasClass(brand, 'shrink-0')) {
    const replaced = replaceNode(next, brand, {
      ...brand,
      class: [...classWords(brand), 'shrink-0'].join(' '),
    });
    if (replaced) {
      next = replaced;
      changed = true;
    }
  }

  return changed ? next : null;
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
 *   4. **Social links** — put the live `site.social-links` core in the row the footer
 *      block reserved for marks and the seed left empty, or — for the captured cohort,
 *      whose footer predates the slots — at the foot of the identity column. Same bar
 *      again: Site identity promises the links appear in the footer, the resolver supplies
 *      them on every render, and no published frame has a node that asks for them
 *      (issue 326). Measured against all 191 shipped designs rather than argued: the first
 *      handle read "the empty row beside the brand core" and reached 122 of them.
 *   5. **Footer blurb** — the line the platform wrote under the business name becomes
 *      the owner's tagline, bound, with a plain fallback (sparx persona issue 046).
 *   6. **Page measure**: the header and footer start their content on the same left
 *      edge as every band between them (piggles persona issue 950). The captured golden
 *      header was a full-width bar with no measure, and the captured golden footer put
 *      its gutter outside its 6xl box, so on a wide screen the 22 designs built from
 *      that capture drew a name at the far left, a page 24px in from the house edge and
 *      a footer 24px out from it. Both move into `mx-auto max-w-6xl px-6`, the measure
 *      silica's own navbar and footer already use. Runs LAST: the brand repair above
 *      reads the header's direct children, and this one moves them into a box.
 *   7. **Phone header** (sparx persona issue 291): the captured header's logo keeps its
 *      size, its button and light/dark switch move into the Menu, and the bar keeps the
 *      Menu up to 1024px, so it fits from 320px up with no sideways scroll. See
 *      `fitHeaderOnPhone`. It finds its nodes at any depth, so it does not care whether
 *      the measure repair has boxed the bar yet.
 *   8. **Bar button centering** (sparx persona issue 328): a CTA step 7 once showed
 *      again as `@5xl:inline-flex` is shown as `@5xl:inline-block`, the box silicaui's
 *      button centers its words in. See `centerBarButtons`. */
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
  healRegion('footer', upgradeFooterBlurb);
  healRegion('nav', fitHeaderOnPhone);
  healRegion('nav', centerBarButtons);

  // The header first: the captured bar is the frame's first `<nav>`. Any band in the
  // frame drawn the outside way follows, the footer among them, through the same rule
  // the page heal and the marketplace generators run.
  healRegion('nav', (nav) => (isCapturedHeader(nav) ? headerToInsideMeasure(nav) : null));
  const measured = insideMeasure(next);
  if (measured.changed && isElement(measured.root)) {
    next = measured.root;
    changed = true;
  }

  return { root: next, changed };
}
