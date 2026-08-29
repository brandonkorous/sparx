// The sparx site chrome — the navbar + footer the starter frame composes around
// the Outlet.
//
// BUILT ON SILICA'S OWN BLOCKS, not hand-authored primitives. This file used to
// rebuild a navbar and a footer from `el()` calls, justified by a note saying
// silica's shipped blocks "hardcode 'SilicaUI' demo branding". That reading was
// wrong, and it cost real capability. The literal is a SLOT DEFAULT:
//
//     { component: 'Wordmark', props: { text: 'SilicaUI', href: '#' },
//       slot: { name: 'brand', type: 'text', label: 'Brand' } }
//
// — placeholder content sitting in a declared fill point, exactly like the `#`
// hrefs on every link beside it. A block ships filled so it can be previewed;
// the slot index is the contract for replacing it. Reading placeholder copy as
// branding leakage and forking the component is the call-site divergence RULE #1
// exists to prevent, and the fork drifted the way forks do: its mobile menu was a
// raw `<details>` fighting the plugin's CSS in a twenty-line comment, and its
// desktop and phone link lists were two copies kept in sync by hand.
//
// What consuming the block gives back:
//   · a real `disclosure` behavior for the phone menu, with `trigger`/`panel` parts,
//     hydrated by @wizeworks/silicaui-behaviors — not a hand-fought `<details>`;
//   · ONE set of link slots feeding BOTH the desktop row and the phone panel, so
//     they cannot advertise different destinations;
//   · alternative alignments (`navbar_center_links`, `navbar_center_logo`) as a key
//     swap — see `NAVBAR_VARIANTS`.
//
// WHAT STAYS OURS — three things silica cannot do. The tenant's live identity
// (`site.brand`) and their published legal pages (`site.legal-links`) are HOST CORES
// swapped into the block's slots, so they render from the platform every request
// instead of freezing at publish. And the THEME TOGGLE stays the `site.theme-toggle`
// host core (swapped in for the block's own toggle button): the block's toggle is a
// client-only behavior that persists to `localStorage` the storefront's SSR never
// reads and shows even on a single-theme site, whereas the host core is the real
// cookie-backed, SSR-no-flash, policy-gated switch. We take the block's SHAPE and
// keep our controls.

import { bind, el, type ElementNode, type Node } from '@wizeworks/silicaui-html';
// `/blocks` is its own entry point — the composed sections live behind a subpath so
// a consumer that only needs the node primitives doesn't pull 44 block trees in.
import { getBlock } from '@wizeworks/silicaui-html/blocks';

import { HOST_KEYS, hostCore } from './host-nodes';

/** The navbar blocks whose slot set sparx's fill matches — `brand`, `link1..4`,
 *  `secondary` (bar `centerLogo`, which omits it — `ensureAccountLink` appends the core
 *  there instead, so the choice of header cannot cost a site its sign-in), and `cta`.
 *  Switching a site's header is this key and nothing else: no re-authoring, no lost
 *  content.
 *
 *  silica ships two more that are deliberately NOT offered here, because each is a
 *  different SHAPE rather than a different alignment of the same one, and the shared
 *  fill would quietly break them:
 *    · `navbar_mega_menu` — a grouped shelf of hardcoded (`#`) links with no slots,
 *      only two top-level link slots, and an unfilled `menuLabel`/column set;
 *    · `navbar_floating_pill` — three link slots, NO `cta`, and an account `avatar`
 *      slot, so a four-destination nav with a call to action loses links AND the CTA
 *      and ships an empty avatar.
 *  Either would need its own fill contract (and, for the mega menu, its shelf
 *  re-authored), so they are a future job, not a free key swap. */
export const NAVBAR_VARIANTS = {
  brandLeft: 'navbar',
  centerLinks: 'navbar_center_links',
  centerLogo: 'navbar_center_logo',
} as const;

export type NavbarVariant = keyof typeof NAVBAR_VARIANTS;

/** The footer blocks whose slot set sparx's fill matches. Both share the
 *  `brand`/`blurb`/`col1`+`link1..4`/`col2`+`link5..8`/`copyright`/`social1..3` slots the
 *  fill writes, so switching a site's footer is this key and nothing else — the same
 *  no-re-author key swap the navbar variants get.
 *
 *    · `columns`    — silica's `footer` (Footer — Columns): a brand blurb + three link
 *      columns over a legal bar. The DEFAULT, and the one that carries the `site.legal-links`
 *      host core (it has the third `link9..12` column to mount it in).
 *    · `newsletter` — silica's `footer_newsletter`: a working "join our list" subscribe form
 *      leading two link columns, over a copyright bar. The editorial (Kith-family) footer —
 *      a capture up front, small-caps columns, a `© <business name>` bottom bar. It has NO
 *      third column, so `ensureLegalLinks` APPENDS the core into the link grid rather than
 *      filling a slot. This line used to say the legal pages "stay reachable from the
 *      builder-authored body, not this block" — which read as a decision and was in fact a
 *      site with no privacy link anywhere, and stood for a while after that was fixed. */
export const FOOTER_VARIANTS = {
  columns: 'footer',
  newsletter: 'footer_newsletter',
} as const;

export type FooterVariant = keyof typeof FOOTER_VARIANTS;

/** What a slot is filled with. `null` REMOVES the node (and prunes the `<li>` or
 *  other wrapper left empty behind it) — a block ships four link slots and a site
 *  with two destinations must not publish two dead `#` links. */
type Fill = { text: string; href: string } | Node | null;

/** Nodes carry `slot` metadata; this is the narrow view the walker needs without
 *  asserting the whole union. */
interface SlotBearing {
  slot?: { name: string };
  children?: unknown[];
  tag?: string;
}

function isNodeObject(v: unknown): v is SlotBearing {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/** A wrapper that exists ONLY to hold one slot — remove the slot, remove the
 *  wrapper. Without this, emptying a link slot leaves a bare `<li>` painting a
 *  list bullet and a gap where a link used to be. */
const isDisposableWrapper = (n: SlotBearing): boolean => n.tag === 'li';

/** Write a destination's text + href onto a link node, in place. Text lives in
 *  `children` for an element and in `props.label`/`props.text` for a component — both
 *  shapes appear across these blocks — so write whichever the node actually uses rather
 *  than guessing from the tag. */
function writeLink(node: SlotBearing, text: string, href: string): void {
  const c = node as SlotBearing & {
    attrs?: Record<string, unknown>;
    props?: Record<string, unknown>;
  };
  if (c.props && ('label' in c.props || 'text' in c.props)) {
    if ('label' in c.props) c.props.label = text;
    if ('text' in c.props) c.props.text = text;
    c.props.href = href;
  } else {
    c.children = [text];
    c.attrs = { ...(c.attrs ?? {}), href };
  }
}

/**
 * Fill a block's declared slots, in place, on an already-cloned tree.
 *
 * A slot NAME may appear more than once — `navbar` declares `link1` twice, once in
 * the desktop row and once in the phone panel, which is precisely the mechanism
 * that keeps the two lists identical. So this fills EVERY occurrence rather than
 * the first, and a fill map is written once per destination, not once per rendering.
 *
 * An unnamed slot is left exactly as the block shipped it. That is deliberate: a
 * block gaining a slot in a future version must not blank on upgrade — it renders
 * its own placeholder until we choose to fill it, which is visible and fixable,
 * where a silent hole is neither.
 */
export function fillSlots(root: Node, fills: Record<string, Fill>): Node {
  const visit = (node: unknown): unknown => {
    if (!isNodeObject(node)) return node;
    if (Array.isArray(node.children)) {
      const next: unknown[] = [];
      for (const child of node.children) {
        if (!isNodeObject(child)) {
          next.push(child);
          continue;
        }
        const name = child.slot?.name;
        if (name !== undefined && name in fills) {
          const fill = fills[name];
          if (fill === null) continue; // drop it
          if (isNodeObject(fill) && !('text' in fill && 'href' in fill)) {
            next.push(fill); // a replacement node (host core, wordmark, …)
            continue;
          }
          const { text, href } = fill as { text: string; href: string };
          writeLink(child, text, href);
          next.push(visit(child));
          continue;
        }
        const walked = visit(child);
        // Prune a wrapper whose only reason to exist just went away.
        if (
          isNodeObject(walked) &&
          isDisposableWrapper(walked) &&
          (walked.children?.length ?? 0) === 0
        ) {
          continue;
        }
        next.push(walked);
      }
      node.children = next;
    }
    return node;
  };
  return visit(root) as Node;
}

/** A block, cloned so filling it never mutates the shared module-level template.
 *  `structuredClone` rather than a spread: these trees nest several levels and a
 *  shallow copy would let one site's fill reach every other site's chrome. */
function cloneBlock(key: string): Node {
  const template = getBlock(key);
  if (!template) throw new Error(`silica block "${key}" not found — is silicaui current?`);
  return structuredClone(template.root);
}

/** Nodes may carry an interactive `behavior`; this narrows the view for the walk that
 *  swaps the theme toggle, without asserting the whole node union. */
interface BehaviorBearing extends SlotBearing {
  behavior?: { type?: string };
}

interface ClassBearing extends SlotBearing {
  class?: string;
}

/**
 * Swap silica's client-only `theme-toggle` control for the LIVE `site.theme-toggle`
 * host core, keeping the block's layout and position.
 *
 * The block declares a theme-toggle BEHAVIOR — a button hydrated by
 * @wizeworks/silicaui-behaviors that flips `data-theme` and persists to
 * `localStorage['silica-theme']`. But the storefront's theme is COOKIE-backed
 * (`sparx_theme`, read by the layout's SSR no-flash script) and POLICY-gated (a toggle
 * only where the site actually offers both light and dark). So the block behavior would
 * NOT survive a reload — SSR keeps rendering the cookie's theme, and nothing reads that
 * `localStorage` — and it would show a toggle on a single-theme site. The host core is
 * the real switch: `silica-host-cores.tsx` mounts the cookie-backed `ModeToggle`, or
 * NOTHING when the policy isn't `toggle`. So we take the block's SHAPE and keep our
 * control — find the theme-toggle behavior node and replace it with the host core.
 */
function withHostThemeToggle(root: Node): Node {
  const visit = (node: unknown): unknown => {
    if (!isNodeObject(node)) return node;
    const n = node as BehaviorBearing;
    if (Array.isArray(n.children)) {
      n.children = n.children.map((child) =>
        isNodeObject(child) && (child as BehaviorBearing).behavior?.type === 'theme-toggle'
          ? hostCore(HOST_KEYS.siteThemeToggle)
          : visit(child)
      );
    }
    return node;
  };
  return visit(root) as Node;
}

/**
 * Swap the navbar's stamped secondary link for the LIVE `site.account-link` host core,
 * keeping each placement's own styling.
 *
 * A stamped `Sign in` cannot know who is reading it, so it said that to signed-in
 * customers above their own name and offered them no route back to the account holding
 * their orders (issue 291). Only something rendered per request can get this right.
 *
 * Unlike `withHostThemeToggle` this CARRIES THE BLOCK'S CLASS onto the core. The
 * `secondary` slot is declared twice with deliberately different styling — an inline
 * text link in the bar (`hidden … @sm:inline`) and a full-width `btn btn-ghost` in the
 * phone panel — so discarding the class the way the toggle does would flatten the phone
 * menu's button into a bare link. The core renders whatever class it is handed.
 */
function withHostAccountLink(root: Node): Node {
  const visit = (node: unknown): unknown => {
    if (!isNodeObject(node)) return node;
    if (Array.isArray(node.children)) {
      node.children = node.children.map((child) =>
        isNodeObject(child) && child.slot?.name === 'secondary'
          ? hostCore(HOST_KEYS.siteAccountLink, (child as ClassBearing).class ?? undefined)
          : visit(child)
      );
    }
    return node;
  };
  return visit(root) as Node;
}

const LINK_SLOT = /^link(\d+)$/;

/** The numeric index of a `link{n}` slot node, or null for anything that isn't one. */
function linkSlotIndex(node: unknown): number | null {
  if (!isNodeObject(node)) return null;
  const name = node.slot?.name;
  const m = typeof name === 'string' ? LINK_SLOT.exec(name) : null;
  return m ? Number(m[1]) : null;
}

/**
 * A link "unit" in a container's child list — either a BARE link-slot node (the navbar's
 * `<a slot=link1>` sitting straight in its `<nav>`) or a single-purpose WRAPPER around
 * one (the footer's `<li><a slot=link1></li>`). Returns the slot index and the inner link
 * node to write; the CHILD itself is the unit kept or cloned, so a wrapped link grows by
 * cloning the whole `<li>`, never by cramming siblings inside it.
 */
function linkUnit(child: unknown): { index: number; link: SlotBearing } | null {
  const direct = linkSlotIndex(child);
  if (direct !== null) return { index: direct, link: child as SlotBearing };
  if (isNodeObject(child) && Array.isArray(child.children) && child.children.length === 1) {
    const innerIndex = linkSlotIndex(child.children[0]);
    if (innerIndex !== null) return { index: innerIndex, link: child.children[0] as SlotBearing };
  }
  return null;
}

/**
 * Fill the navbar's numbered link slots with EVERY destination, GROWING past the
 * block's declared count instead of truncating at it. A site shows exactly the links
 * it has — the block's four slots are a starting shape, never a ceiling.
 *
 * Each declared `link{i}` slot takes `destinations[i-1]`; a slot with no destination is
 * dropped (so a short nav publishes no dead `#`), and every destination BEYOND the
 * highest declared index is appended as a clone of that last slot, in the same container
 * it sits in. That container placement is what respects a split layout: `centerLogo`
 * puts `link1..2` on the left of the wordmark and `link3..4` on the right, so `link4` is
 * the tail and the overflow lands on the right — the editorial split holds for any
 * number of links. The slots repeat across the desktop row and the phone panel, and both
 * are grown identically (each has its own `link{max}`), so the two renderings can never
 * differ. Handles bare links (the navbar) and `<li>`-wrapped ones (the footer columns)
 * alike, via `linkUnit`.
 */
function fillNavLinks(root: Node, destinations: [string, string][]): Node {
  // The highest declared slot index anywhere — the point past which extras append.
  let maxIndex = 0;
  const scan = (n: unknown): void => {
    const i = linkSlotIndex(n);
    if (i !== null && i > maxIndex) maxIndex = i;
    if (isNodeObject(n) && Array.isArray(n.children)) n.children.forEach(scan);
  };
  scan(root);

  const visit = (node: unknown): unknown => {
    if (!isNodeObject(node) || !Array.isArray(node.children)) return node;
    const next: unknown[] = [];
    for (const child of node.children) {
      const unit = linkUnit(child);
      if (unit === null) {
        next.push(visit(child));
        continue;
      }
      const { index, link } = unit;
      // A declared link slot: fill the inner link (keeping any wrapper) if a destination
      // maps to it, else drop the whole unit.
      if (index <= destinations.length) {
        const [text, href] = destinations[index - 1]!;
        writeLink(link, text, href);
        next.push(child);
      }
      // Overflow — every destination past the last declared slot, appended as a clone of
      // this whole unit (wrapper included) so it trails the block's last link here.
      if (index === maxIndex && destinations.length > maxIndex) {
        for (let j = maxIndex; j < destinations.length; j += 1) {
          const clone = structuredClone(child);
          const cloneLink = linkUnit(clone)!.link as SlotBearing & { slot?: unknown };
          delete cloneLink.slot; // a concrete link now, not a template slot
          const [text, href] = destinations[j]!;
          writeLink(cloneLink, text, href);
          next.push(clone);
        }
      }
    }
    node.children = next;
    return node;
  };
  return visit(root) as Node;
}

/** The container whose direct children hold the link unit with this slot index — the
 *  `<ul>`/`<nav>` a column's links live in. Lets a multi-column block (the footer) grow
 *  ONE column to fit without the global fill reaching the others. */
function findLinkListContainer(root: Node, index: number): Node | null {
  let found: Node | null = null;
  const visit = (node: unknown): void => {
    if (found || !isNodeObject(node) || !Array.isArray(node.children)) return;
    if (node.children.some((c) => linkUnit(c)?.index === index)) {
      found = node as Node;
      return;
    }
    node.children.forEach(visit);
  };
  visit(root);
  return found;
}

export interface SiteChromeOptions {
  /** Whether to show Shop/Cart/Orders links — omit for a tenant with no Commerce
   *  module active, so the chrome never invites a visitor into a store that
   *  doesn't exist (content and/or commerce — never assumed). Defaults to `true`
   *  so existing callers (the MCP catalog block, tests) are unaffected. */
  commerceEnabled?: boolean;
  /** Whether to show the Book link + seed a `/book` page — on only for a tenant with
   *  the Scheduling module active. Defaults to `false` (opt-in, unlike Commerce's
   *  legacy unconditional Shop): a content/commerce tenant with no bookings never gets
   *  a Book link or an orphan booking page. */
  schedulingEnabled?: boolean;
  /** Whether to show the Journal link + seed a `/blog` index — on only for a tenant
   *  with the CMS module active. Defaults to `false`, matching Scheduling's opt-in.
   *
   *  This flag was MISSING while Commerce and Scheduling had one, which made a
   *  publisher-only tenant a second-class citizen in their own chrome: they could
   *  write posts, each post got a real detail page, and there was no index and no
   *  link to reach any of it. Content and/or commerce is the product's premise —
   *  the chrome has to mean it. */
  cmsEnabled?: boolean;
  /** Which navbar shape to start on. Defaults to `brandLeft` — the plainest of the
   *  three, and the one a tenant is least likely to have to undo. */
  navbar?: NavbarVariant;
  /** Which footer shape to start on. Defaults to `columns` — the block that carries the
   *  live legal-links host core. `newsletter` is the editorial "join our list" footer. */
  footer?: FooterVariant;
  /** Whether the navbar carries a filled call-to-action button. Defaults to `true`, so
   *  existing sites keep their "Get in touch" button. Set `false` for an editorial header
   *  that leads with the wordmark and nav alone (the Kith-family bar has no filled CTA) —
   *  the `cta` slot is pruned on both the desktop bar and the phone panel. */
  showCta?: boolean;
  /** Override the navbar CTA button's label + destination. Defaults to "Get in touch" →
   *  `/contact`. A B2B/wholesale site says "Open a trade account", a booking site "Book now",
   *  etc. Ignored when `showCta` is false (the slot is pruned). Backward-compatible: unset =
   *  the original "Get in touch" button. */
  ctaLabel?: string;
  ctaHref?: string;
  /** EXPLICIT primary destinations, overriding the module-derived Shop/Book/Journal/About/
   *  Contact set. When provided, the navbar AND the footer's Explore column show EXACTLY
   *  these — for a site whose page set isn't the content/commerce shape (a personal
   *  portfolio: Work/About/Contact). The footer's trailing `/search` link is dropped too,
   *  because a custom-nav site defines its own pages and has no commerce search route.
   *  Unset (the default) leaves the module-gated behaviour every existing caller relies on
   *  untouched. */
  navLinks?: [string, string][];
}

/** The site's primary destinations, in one place so the desktop row and the phone
 *  menu can never drift into offering different links.
 *
 *  Takes the OPTIONS OBJECT rather than positional booleans: with three module flags
 *  of the same type, a call site that transposes two arguments type-checks perfectly
 *  and silently ships the wrong nav. */
function navDestinations(opts: SiteChromeOptions): [string, string][] {
  // An explicit list wins outright — a site whose pages aren't the module-shaped set names
  // its own destinations, and gets exactly them (no invented Shop/Journal into empty routes).
  if (opts.navLinks) return opts.navLinks;
  const { commerceEnabled = true, schedulingEnabled = false, cmsEnabled = false } = opts;
  const link = (label: string, href: string): [string, string][] => [[label, href]];
  return [
    ...(commerceEnabled ? link('Shop', '/shop') : []),
    ...(schedulingEnabled ? link('Book', '/book') : []),
    // The blog index. Gated on CMS for the same reason Shop is gated on Commerce: a
    // link into a section with nothing behind it is worse than no link.
    ...(cmsEnabled ? link('Journal', '/blog') : []),
    ['About', '/about'],
    ['Contact', '/contact'],
  ];
}

/** Map an ordered destination list onto a block's numbered link slots, emptying
 *  the ones the site doesn't need. The block fixes the CEILING (four in the navbar);
 *  the module flags decide how many of them are real. */
function linkFills(
  destinations: [string, string][],
  slotCount: number,
  offset = 0
): Record<string, Fill> {
  const out: Record<string, Fill> = {};
  for (let i = 0; i < slotCount; i += 1) {
    const d = destinations[i];
    out[`link${i + 1 + offset}`] = d ? { text: d[0], href: d[1] } : null;
  }
  return out;
}

/**
 * The site navbar — silica's `navbar` block (or a chosen variant) with the tenant's
 * own identity, destinations and calls to action filled in.
 *
 * The brand slot takes the LIVE `site.brand` host core rather than a stamped
 * wordmark: the platform renders the tenant's current logo and name on every
 * request, so uploading a logo in Site settings reaches the header with no builder
 * trip and no re-publish. A stamped node would freeze at publish. The theme toggle is
 * likewise swapped for the `site.theme-toggle` host core (see `withHostThemeToggle`).
 */
export function siteNavbar(opts: SiteChromeOptions = {}): Node {
  const destinations = navDestinations(opts);
  const root = cloneBlock(NAVBAR_VARIANTS[opts.navbar ?? 'brandLeft']);
  const filled = fillSlots(root, {
    brand: hostCore(HOST_KEYS.siteBrand),
    // Every site has shopper sign-in (Layer-2 auth), so the secondary link is real
    // on a content-only site too — it reaches the account, not a store. Filled as a
    // plain link here and swapped for the live core below (see `withHostAccountLink`).
    secondary: { text: 'Sign in', href: '/account/login' },
    // `null` prunes the CTA slot (both the desktop bar and the phone panel declare it), for
    // an editorial header that leads with the wordmark + nav and no filled button. The label +
    // destination are overridable (`ctaLabel`/`ctaHref`) — a trade site says "Open a trade
    // account", a booking site "Book now" — defaulting to the original "Get in touch".
    cta:
      (opts.showCta ?? true)
        ? { text: opts.ctaLabel ?? 'Get in touch', href: opts.ctaHref ?? '/contact' }
        : null,
  });
  // The nav renders EXACTLY the site's destinations — the block's link slots GROW to fit
  // however many there are, never truncating at the block's default count.
  const linked = fillNavLinks(filled, destinations);
  // Keep the cookie-backed, SSR-integrated, policy-gated theme toggle rather than the
  // block's client-only behavior, and the live account link rather than a stamped one.
  // `ensureAccountLink` then covers the variant that has no `secondary` slot to swap.
  return ensureAccountLink(withHostThemeToggle(withHostAccountLink(linked)));
}

/** The two shapes the account link takes, which are the classes the block's own
 *  `secondary` fill produces: an inline text link in the bar, and a full-width ghost
 *  button in the phone panel. Spelled here so a variant that grows the slot later and
 *  one that never had it look identical. */
const ACCOUNT_BAR_CLASS =
  'hidden text-sm font-medium text-base-content hover:text-primary @sm:inline';
const ACCOUNT_PANEL_CLASS = 'btn btn-ghost btn-sm mt-2 w-full';

/**
 * Guarantee the header can reach the shopper's account.
 *
 * The twin of `ensureLegalLinks`, missing until issue 313, and it exists for exactly
 * the same reason. `fillSlots` fills only the slots a block HAS; `centerLogo` declares
 * no `secondary`, so `withHostAccountLink` found nothing to swap and that variant
 * shipped a header with no way in to an account at all. Forty six of the 191 designs
 * were on it: a shop with an order history, a wishlist and a self-service returns flow,
 * and no link to any of them anywhere in the chrome. A shopper had to guess the address.
 *
 * Sign-in is not decorative chrome a variant may opt out of. The same sentence is
 * already written above `ensureLegalLinks` about privacy and terms, and the reason it
 * had to be written twice is that the fix went in on the footer and the identical hole
 * in the navbar was left open.
 *
 * A no-op when the fill already placed the core, so every `brandLeft` / `centerLinks`
 * header is unchanged byte for byte.
 */
function ensureAccountLink(navbar: Node): Node {
  if (typeof navbar === 'string' || navbar.kind !== 'element') return navbar;
  if (containsHostCore(navbar, HOST_KEYS.siteAccountLink)) return navbar;
  const withBar = addAt(
    navbar,
    barEnd(navbar),
    hostCore(HOST_KEYS.siteAccountLink, ACCOUNT_BAR_CLASS)
  );
  // Re-found rather than captured before the first insert: `addAt` rebuilds every
  // element it walks, so a node identity taken from the old tree matches nothing in
  // the new one and the panel copy would silently not be placed.
  const panel = phonePanel(withBar);
  return panel
    ? addAt(withBar, panel, hostCore(HOST_KEYS.siteAccountLink, ACCOUNT_PANEL_CLASS))
    : withBar;
}

/** The BAR itself — the navbar's first element child, which is the row holding the
 *  brand, the links and the controls. Searching from here rather than from the header
 *  keeps the phone panel (its sibling) out of the walk below. */
function bar(navbar: ElementNode): ElementNode {
  return (
    (navbar.children ?? []).find(
      (child): child is ElementNode => typeof child !== 'string' && child.kind === 'element'
    ) ?? navbar
  );
}

/** Where the bar puts its controls: the end zone, which every shipped variant marks
 *  with `ml-auto` or `justify-end` (`brandLeft` the first, `centerLogo` the second).
 *  Falls back to the bar, so a future variant with neither still gets a reachable link
 *  rather than none. */
function barEnd(navbar: ElementNode): ElementNode {
  const row = bar(navbar);
  let end: ElementNode | null = null;
  const walk = (node: Node | string): void => {
    if (typeof node === 'string' || node.kind !== 'element') return;
    const cls = ` ${node.class ?? ''} `;
    if (cls.includes(' ml-auto ') || cls.includes(' justify-end ')) end = node;
    (node.children ?? []).forEach(walk);
  };
  (row.children ?? []).forEach(walk);
  return end ?? row;
}

/** The disclosure panel the phone menu opens — the navbar's own `nav` child laid out
 *  as a column. Null when a variant has no phone panel, in which case the bar copy is
 *  the whole of it. */
function phonePanel(navbar: ElementNode): ElementNode | null {
  return (
    (navbar.children ?? []).find(
      (child): child is ElementNode =>
        typeof child !== 'string' &&
        child.kind === 'element' &&
        child.tag === 'nav' &&
        ` ${child.class ?? ''} `.includes(' flex-col ')
    ) ?? null
  );
}

/**
 * Guarantee the footer can show the tenant's published legal pages.
 *
 * `fillSlots` fills only the slots a block actually has, so a variant with no
 * `link9` quietly went out with no legal column at all — and nothing downstream
 * noticed, because the Legal pages checklist decides "linked in your footer" from
 * a placement row rather than from the frame. This closes that gap at the source:
 * whatever the variant, the core is in the footer.
 *
 * A no-op when the fill already placed it, so the `columns` footer is unchanged
 * byte for byte. The appended copy carries its own heading, because there it IS
 * the column rather than joining one that already has a title.
 */
function ensureLegalLinks(footer: Node): Node {
  if (typeof footer === 'string' || footer.kind !== 'element') return footer;
  if (containsHostCore(footer, HOST_KEYS.siteLegalLinks)) return footer;
  return addAt(
    footer,
    columnHome(footer),
    hostCore(HOST_KEYS.siteLegalLinks, 'flex flex-col gap-3')
  );
}

/**
 * WHERE the appended column goes — beside the other columns, not after the footer.
 *
 * Appending to the FOOTER's own children put it outside the container that carries
 * the band's background and padding, so on the newsletter variant the legal links
 * rendered as a bare strip below the footer, on the page's own background, in a
 * different type size to the columns they belong with (issue 218). The safety net
 * worked and the result did not look like part of the site.
 *
 * The last grid inside the footer is the one holding the link columns in every
 * variant that ships. Falling back to the first container keeps a future variant
 * with no grid at all inside the band, which is the property that actually matters.
 */
function columnHome(footer: ElementNode): ElementNode {
  let home: ElementNode | null = null;
  const walk = (node: Node | string): void => {
    if (typeof node === 'string' || node.kind !== 'element') return;
    if (` ${node.class ?? ''} `.includes(' grid ')) home = node;
    (node.children ?? []).forEach(walk);
  };
  (footer.children ?? []).forEach(walk);
  const container = (footer.children ?? []).find(
    (child): child is ElementNode => typeof child !== 'string' && child.kind === 'element'
  );
  return home ?? container ?? footer;
}

/** Put `child` inside `target`, wherever `target` sits in `root`. */
function addAt(root: ElementNode, target: ElementNode, child: Node): ElementNode {
  if (root === target) return { ...root, children: [...(root.children ?? []), child] };
  return {
    ...root,
    children: (root.children ?? []).map((node) =>
      typeof node === 'string' || node.kind !== 'element' ? node : addAt(node, target, child)
    ),
  };
}

function containsHostCore(node: Node | string, key: string): boolean {
  if (typeof node === 'string') return false;
  if (node.kind === 'host' && node.component === key) return true;
  if (node.kind !== 'element') return false;
  return (node.children ?? []).some((child) => containsHostCore(child, key));
}

/**
 * The site footer — silica's `footer` block by default, or a chosen `FOOTER_VARIANTS`
 * key, filled the same way.
 *
 * The `columns` block ships three link columns; a starter site has one column's worth of
 * real destinations, so the second and third are emptied rather than filled with
 * invented pages. The legal column is the LIVE `site.legal-links` host core: it
 * lists the documents the tenant has ACTUALLY published and renders nothing until
 * there are any, replacing a hardcoded Privacy/Terms pair that shipped every new
 * site two footer links to pages that did not exist.
 *
 * The `newsletter` variant shares the `brand`/`blurb`/`col1`/`col2` slots, so the same
 * by-name fill drives it — but it has no `link9` slot, and `fillSlots` fills only slots
 * it finds. That silently dropped the legal column: a tenant on the newsletter footer got
 * a live site with NO privacy, terms or cookie link, while the Legal pages checklist told
 * them every required page was "published, up to date, and linked in your footer" and
 * counted it as done. The claim was read off a placement row rather than off anything
 * that renders.
 *
 * So the core is APPENDED after the fill (`ensureLegalLinks`) rather than left to a slot
 * that may not exist. Legal links are not decorative chrome a variant may opt out of, and
 * a footer that cannot show them must not be reachable by choosing a different look.
 */
export function siteFooter(opts: SiteChromeOptions = {}): Node {
  const { commerceEnabled = true } = opts;
  const destinations = navDestinations(opts);
  const variant = opts.footer ?? 'columns';
  const root = cloneBlock(FOOTER_VARIANTS[variant]);
  const filled = fillSlots(root, {
    brand: hostCore(HOST_KEYS.siteBrand),
    // The `newsletter` block leads with a subscribe form, so its blurb is the invitation to
    // join the list; the `columns` block's blurb is a plain brand line. The block keeps its
    // shipped `cta` ("Subscribe") + `note` reassurance — both are real, neither is a leak.
    blurb: {
      text:
        variant === 'newsletter'
          ? // Was 'new work, journal notes, and studio news, about once a month' —
            // copy for a design studio, seeded onto a bakery, a pet shop and a
            // wine merchant, and the only sentence on the site its owner never
            // wrote. It also promised a frequency nobody had agreed to.
            //
            // Deliberately NOT split on `commerceEnabled` like the line below:
            // "new arrivals" is a shop's word and "new writing" is a publisher's,
            // and a café that neither sells nor publishes gets a wrong one either
            // way. This says what a mailing list is actually for, and promises
            // nothing about how often or about what kind of business this is.
            'Join the list — we’ll email when there’s something worth knowing.'
          : commerceEnabled
            ? 'Everything you publish and sell, in one place.'
            : 'Everything you publish, in one place.',
      href: '/',
    },
    // Socials are a tenant setting, not something a starter can invent. The block's
    // X/GitHub/LinkedIn placeholders would publish three dead `#` links on day one,
    // so they go — but emptying them was only half of it, and for a long time it was
    // the only half: Site identity promised "add one and it appears in your footer"
    // and nothing ever drew what she added (issue 326). The live core is the other
    // half. It renders NOTHING until she lists an account, so it costs a brand-new
    // site exactly what three nulls did, and starts working the moment she fills it in.
    // No class: this fills the block's FIRST social slot, so the core lands inside the row
    // the block already spaces (`mt-2 flex items-center gap-5`), and `SocialLinks` lays the
    // marks out itself. Anything here would be a third opinion about the same row.
    social1: hostCore(HOST_KEYS.siteSocialLinks),
    social2: null,
    social3: null,
    col1: { text: 'Explore', href: '/' },
    // The Explore column (link1-4) is GROWN below to fit every destination + Search, so
    // it is deliberately left OUT of this by-name fill and handled after.
    ...(commerceEnabled
      ? {
          col2: { text: 'Account', href: '/account' },
          ...linkFills(
            [
              // Not "Sign in": `/account` bounces a stranger to the login form and takes
              // a customer to her account, so the label has to be true in both states.
              ['Your account', '/account'],
              ['Orders', '/account/orders'],
              // Seeded, not left for the tenant to think of. Self-service returns
              // ship with the account area, and a shop that does not advertise them
              // gets the emails instead.
              ['Returns', '/account/returns'],
              ['Cart', '/cart'],
            ],
            4,
            4
          ),
        }
      : { col2: null, ...linkFills([], 4, 4) }),
    // The third column is where legal lives — a host core, so it is the tenant's
    // real published set or nothing at all.
    col3: null,
    link9: hostCore(HOST_KEYS.siteLegalLinks),
    link10: null,
    link11: null,
    link12: null,
    // The copyright line is the tenant's OWN name, bound live — never the block's shipped
    // "© 2026 SilicaUI, Inc." placeholder, which an unfilled slot would publish verbatim.
    copyright: el('p', 'text-sm text-base-content', {
      children: [
        '© ',
        bind(el('span', 'font-medium', { text: 'Your site' }), 'site.identity.name'),
      ],
    }),
    // The copyright row's own link trio duplicates the columns above; dropped.
    link13: null,
    link14: null,
    link15: null,
  });
  // Explore grows to fit EXACTLY the site's destinations + the footer-only Search — the
  // same no-cap rule as the navbar, scoped to that one column (via its `link1`) so the
  // Account and legal columns are never touched.
  const explore = findLinkListContainer(filled, 1);
  if (explore) {
    // A custom-nav site defines its own pages — no forced `/search` (there's no commerce
    // search route behind it). The module-shaped default keeps the footer-only Search link.
    const extras: [string, string][] = opts.navLinks ? [] : [['Search', '/search']];
    fillNavLinks(explore, [...destinations, ...extras]);
  }
  return ensureLegalLinks(filled);
}
