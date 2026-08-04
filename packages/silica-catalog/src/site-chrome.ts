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

import { type Node } from '@wizeworks/silicaui-html';
// `/blocks` is its own entry point — the composed sections live behind a subpath so
// a consumer that only needs the node primitives doesn't pull 44 block trees in.
import { getBlock } from '@wizeworks/silicaui-html/blocks';

import { HOST_KEYS, hostCore } from './host-nodes';

/** The navbar blocks whose slot set sparx's fill matches — `brand`, `link1..4`,
 *  `secondary` (bar `centerLogo`, which omits it), and `cta`. Switching a site's
 *  header is this key and nothing else: no re-authoring, no lost content.
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
          // Text lives in `children` for an element and in `props.label`/`props.text`
          // for a component — both shapes appear across these blocks, so write
          // whichever the node actually uses rather than guessing from the tag.
          const c = child as SlotBearing & {
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
}

/** The site's primary destinations, in one place so the desktop row and the phone
 *  menu can never drift into offering different links.
 *
 *  Takes the OPTIONS OBJECT rather than positional booleans: with three module flags
 *  of the same type, a call site that transposes two arguments type-checks perfectly
 *  and silently ships the wrong nav. */
function navDestinations(opts: SiteChromeOptions): [string, string][] {
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
    ...linkFills(destinations, 4),
    // Every site has shopper sign-in (Layer-2 auth), so the secondary link is real
    // on a content-only site too — it reaches the account, not a store.
    secondary: { text: 'Sign in', href: '/account/login' },
    cta: { text: 'Get in touch', href: '/contact' },
  });
  // Keep the cookie-backed, SSR-integrated, policy-gated theme toggle rather than the
  // block's client-only behavior.
  return withHostThemeToggle(filled);
}

/**
 * The site footer — silica's `footer` block, filled the same way.
 *
 * The block ships three link columns; a starter site has one column's worth of
 * real destinations, so the second and third are emptied rather than filled with
 * invented pages. The legal column is the LIVE `site.legal-links` host core: it
 * lists the documents the tenant has ACTUALLY published and renders nothing until
 * there are any, replacing a hardcoded Privacy/Terms pair that shipped every new
 * site two footer links to pages that did not exist.
 */
export function siteFooter(opts: SiteChromeOptions = {}): Node {
  const { commerceEnabled = true } = opts;
  const destinations = navDestinations(opts);
  const root = cloneBlock('footer');
  return fillSlots(root, {
    brand: hostCore(HOST_KEYS.siteBrand),
    blurb: {
      text: commerceEnabled
        ? 'Everything you publish and sell, in one place.'
        : 'Everything you publish, in one place.',
      href: '/',
    },
    // Socials are a tenant setting, not something a starter can invent. Emptied
    // rather than left as the block's X/GitHub/LinkedIn placeholders, which would
    // publish three dead `#` links on day one.
    social1: null,
    social2: null,
    social3: null,
    col1: { text: 'Explore', href: '/' },
    // Search is footer-only: a utility destination the header has no slot for.
    ...linkFills([...destinations, ['Search', '/search']], 4),
    ...(commerceEnabled
      ? {
          col2: { text: 'Account', href: '/account' },
          ...linkFills(
            [
              ['Sign in', '/account'],
              ['Orders', '/account/orders'],
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
    // The copyright row's own link trio duplicates the columns above on a starter
    // site; the bound copyright line carries the identity on its own.
    link13: null,
    link14: null,
    link15: null,
  });
}
