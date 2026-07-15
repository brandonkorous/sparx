// The pinned functional cores (docs/122 Phase 2/3) — sparx's registry of live,
// host-owned functional regions a tenant can drop into an editable page but never
// delete or break.
//
// silicaui 0.22 shipped the `HostNode` primitive (`kind: "host"`): an author places
// it from the Insert palette, styles its wrapper and repositions everything around
// it, but the node itself is `locked: "host"` — the engine refuses to remove or move
// it and the author UI offers no unlock. `toHtml` lowers a host node to an EMPTY
// mount point (`<div data-sui-host="<key>">`); the real interactive component is
// mounted at render time — on the storefront by the React walk (apps/site), on the
// studio canvas by the host's `renderHostNode` skeleton (apps/dashboard).
//
// This module is the ONE source of truth for the key vocabulary + the palette/inspector
// METADATA (plain data — React-free, like the rest of this package) + the authoring
// composites that wrap a core in a default editable shell. The two React ends map the
// SAME keys to their own components:
//   · apps/dashboard  key → a non-interactive canvas skeleton (`renderHostNode`)
//   · apps/site       key → the real functional component (the storefront walk)
// A key with no live mapping on either end is a half-built surface, so an entry is
// added here only once its full vertical (skeleton + real component + route) lands.

import { el, host, type Node } from '@wizeworks/silicaui-html';

/** The host-component keys, namespaced by owning module. Matched verbatim against a
 *  `HostNode.component`; every key in `HOST_COMPONENTS` has a live mapping on BOTH
 *  React ends. Add a key here the moment its vertical is complete, never before. */
export const HOST_KEYS = {
  /** The shopping cart — line items, quantity edits, totals, checkout CTA. A
   *  self-contained client component (cart state lives in the browser); no auth,
   *  no money movement (that is `commerce.checkout`). */
  commerceCart: 'commerce.cart',
  /** The search experience — query field, Typesense-faceted sidebar, sort, result
   *  grid + pagination, and a pages/collections strip. Read-only; reads the URL's
   *  search params (the route passes them in — a host core can't read the URL). */
  commerceSearch: 'commerce.search',
  /** The product listing (PLP) — the faceted, sortable, paginated catalog grid with a
   *  fitment/price/availability facet panel. Read-only; reads the URL's search params. */
  commercePlp: 'commerce.plp',
  /** The collection index — a card grid of every published collection (featured first).
   *  Read-only; needs only the resolved site (no URL state). */
  commerceCollections: 'commerce.collections',
  /** The category index — a card grid of the root browse categories (featured first),
   *  each drilling into /category/[handle]. Read-only; needs only the resolved site. */
  commerceCategories: 'commerce.categories',
  /** The bookable-services index — a card list of every service open for online booking,
   *  each drilling into /book/[serviceId]. Read-only; self-contained (resolves the tenant
   *  from the request host), so it needs nothing from route context. */
  schedulingServices: 'scheduling.services',
  /** The category DETAIL — one browse node's header + subcategories + a paginated ROLLUP
   *  of every product beneath it (self + descendants). A per-record functional template
   *  (`commerce.category` record type); the route passes the category handle + page via
   *  context. Read-only. */
  commerceCategoryDetail: 'commerce.category-detail',
  /** The bookable-service DETAIL — one service's header + its LIVE time-picker (availability,
   *  slot selection, booking). A per-record functional template (`scheduling.service` record
   *  type); the route passes the service id via context. Interactive (client widget). */
  schedulingServiceDetail: 'scheduling.service-detail',
  /** The shopper account AUTH form — sign-in / create-account / forgot / reset. ONE core
   *  parameterized by a `mode` host prop (the route/composite sets it; not author-tunable),
   *  so every public /account entry page is one editable shell around this pinned form.
   *  Interactive (client widget); reads its own URL params (redirect / token). */
  commerceAuth: 'commerce.auth',
} as const;

export type HostComponentKey = (typeof HOST_KEYS)[keyof typeof HOST_KEYS];

/** A minimal prop descriptor for a core's Inspector controls — a React-free mirror
 *  of the builder's `HostPropDef`, mapped 1:1 by the dashboard host. */
export interface HostComponentProp {
  name: string;
  label?: string;
  type: 'text' | 'number' | 'boolean' | 'select' | 'color' | 'binding';
  options?: { value: string; label: string }[];
  default?: unknown;
}

/** Palette + inspector metadata for one pinned core — a React-free mirror of the
 *  builder's `HostComponentDef` (`apps/dashboard` maps this onto the real type). Every
 *  core is `pinned` (inserted `locked: "host"`), so the tenant styles + repositions
 *  the shell around it but can never delete the transaction. */
export interface HostComponentMeta {
  /** The allowlist key an author's placed `HostNode.component` carries. */
  key: HostComponentKey;
  /** Insert-palette + Navigator label, e.g. "Shopping cart". */
  label: string;
  /** Palette grouping — the owning module, so cores sit beside that module's blocks. */
  category: string;
  /** A registered icon name (silica `IconName`) for the palette row. */
  icon: string;
  /** One-line palette hint. */
  hint: string;
  /** Default wrapper classes stamped onto a freshly-inserted node (LITERAL strings so
   *  the Tailwind `@source` harness safelists them — same rule as every composite). */
  defaultClass: string;
  /** Author-tunable props surfaced in the Inspector's Host panel. */
  props?: HostComponentProp[];
}

/** Every pinned functional core the studio offers, module-grouped. The dashboard turns
 *  this into `hostComponents(): HostComponentDef[]` (all `pinned: true`) and the site
 *  turns each `key` into the real component the storefront mounts. */
export const HOST_COMPONENTS: HostComponentMeta[] = [
  {
    key: HOST_KEYS.commerceCart,
    label: 'Shopping cart',
    category: 'commerce',
    // The curated silica icon set (LUCIDE_ICONS) is UI-oriented — no cart glyph;
    // `box` (a package) is the closest registered name. An unregistered name renders
    // empty (the curated-set footgun), so cores pick only from the shipped keys.
    icon: 'box',
    hint: 'The live cart — line items, quantities, totals, and the checkout button. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-4xl px-6 py-10',
  },
  {
    key: HOST_KEYS.commerceSearch,
    label: 'Search results',
    category: 'commerce',
    icon: 'search',
    hint: 'The live search — query field, filters, sort, and the result grid. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-6xl px-6 py-6',
  },
  {
    key: HOST_KEYS.commercePlp,
    label: 'Product listing',
    category: 'commerce',
    icon: 'grid',
    hint: 'The live catalog grid with filters, sort, and pagination. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-6xl px-6 py-6',
  },
  {
    key: HOST_KEYS.commerceCollections,
    label: 'Collection index',
    category: 'commerce',
    icon: 'gallery',
    hint: 'The live grid of all collections. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-6xl px-6 py-6',
  },
  {
    key: HOST_KEYS.commerceCategories,
    label: 'Category index',
    category: 'commerce',
    icon: 'grid',
    hint: 'The live grid of top-level browse categories. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-6xl px-6 py-6',
  },
  {
    key: HOST_KEYS.schedulingServices,
    label: 'Booking services',
    category: 'scheduling',
    // `calendar` is a registered curated-set icon; the scheduling module's glyph.
    icon: 'calendar',
    hint: 'The live list of services open for booking, each linking to its time-picker. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-4xl px-6 py-10',
  },
  {
    key: HOST_KEYS.commerceCategoryDetail,
    label: 'Category detail',
    category: 'commerce',
    icon: 'grid',
    hint: 'One category: its header, subcategories, and the full product rollup beneath it. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-6xl px-6 py-6',
  },
  {
    key: HOST_KEYS.schedulingServiceDetail,
    label: 'Booking widget',
    category: 'scheduling',
    icon: 'calendar',
    hint: 'One service: its details and the live time-picker to book it. Pinned: style and surround it, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-4xl px-6 py-10',
  },
  {
    key: HOST_KEYS.commerceAuth,
    label: 'Account form',
    category: 'commerce',
    icon: 'avatar',
    hint: 'The shopper sign-in / create-account form. Pinned: style and surround it with your own copy, but it can’t be removed.',
    defaultClass: 'mx-auto w-full max-w-xl px-6 py-12',
  },
];

/** Author a pinned functional core as a `HostNode` — the kit's `host()` with the core's
 *  registered default wrapper classes, stamped `locked: "host"`. The palette-insert path
 *  gets the lock from the `pinned` `HostComponentDef`, but a core embedded DIRECTLY in a
 *  code composite / starter page (not inserted) must carry the lock itself, or the studio
 *  would let the author delete the seeded core. `locked: "host"` = the engine refuses
 *  remove/move and shows no unlock (only the host clears it). */
export function hostCore(
  key: HostComponentKey,
  cls?: string,
  props?: Record<string, unknown>
): Node {
  const meta = HOST_COMPONENTS.find((c) => c.key === key);
  return { ...host(key, cls ?? meta?.defaultClass ?? '', props), locked: 'host' };
}

/** A default editable SHELL wrapping a pinned core — the fallback page body the
 *  storefront renders (and the seed the studio opens) for a functional route with no
 *  stored template yet. A titled section header (fully editable/removable) above the
 *  pinned core; the tenant restyles the heading, adds trust badges / upsells around
 *  it, and repositions everything — the core alone stays put. */
export function functionalShell(
  key: HostComponentKey,
  opts: { heading?: string; coreClass?: string; props?: Record<string, unknown> } = {}
): Node {
  const children: Node[] = [];
  if (opts.heading) {
    children.push(
      el('h1', 'mb-6 px-6 pt-10 text-3xl font-semibold text-base-content', { text: opts.heading })
    );
  }
  children.push(hostCore(key, opts.coreClass, opts.props));
  return el('section', 'bg-base-100', { children });
}
