// The host cores (docs/122 Phase 2/3) — sparx's registry of live, host-owned regions
// the platform renders at request time rather than stamping into a tenant's tree.
//
// silicaui 0.22 shipped the `HostNode` primitive (`kind: "host"`): `toHtml` lowers it
// to an EMPTY mount point (`<div data-sui-host="<key>">`) and the real component is
// mounted at render time — on the storefront by the React walk (apps/site), on the
// studio canvas by the host's `renderHostNode` (apps/dashboard).
//
// A host node buys TWO independent things. Don't conflate them:
//
//   1. `kind:"host"` ⇒ IMPROVABILITY. The tree stores a mount point, not markup, so
//      the platform can keep improving what renders there — forever, for every
//      tenant, with no migration. A STAMPED node is the opposite: it is copied at
//      insert and frozen at publish, so improving the composite that produced it
//      never reaches a tenant who already published (docs/122 "Key facts").
//   2. `locked:"host"` ⇒ PROTECTION. The engine refuses to remove or move the node
//      and the author UI offers no unlock, so a transaction can't be deleted.
//
// Most cores want both. The brand mark (`site.brand`) wants only the first: it is
// live-rendered so a logo uploaded in Site settings appears without a builder trip,
// but the tenant owns where it sits, so it is `pinned: false`.
//
// The sorting rule, for the next thing that goes stale: if the PLATFORM must be able
// to improve it forever, it is a host core. If the TENANT owns it, leave it stamped —
// freezing is the correct semantics for tenant content.
//
// This module is the ONE source of truth for the key vocabulary + the palette/inspector
// METADATA (plain data — React-free, like the rest of this package) + the authoring
// composites that wrap a core in a default editable shell. The two React ends map the
// SAME keys to their own components:
//   · apps/dashboard  key → a non-interactive canvas skeleton (`renderHostNode`)
//   · apps/site       key → the real functional component (the storefront walk)
// A key with no live mapping on either end is a half-built surface, so an entry is
// added here only once its full vertical (skeleton + real component + route) lands.

import { el, host, type HostNode, type Node } from '@wizeworks/silicaui-html';

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
  /** The collection DETAIL — one collection's header + its members as a faceted, sortable,
   *  paginated grid (the same browser the PLP + category detail use, scoped to this
   *  collection). A per-record functional template (`commerce.collection` record type);
   *  the route passes the collection handle + search params via context. Read-only. */
  commerceCollectionDetail: 'commerce.collection-detail',
  /** The bookable-service DETAIL — one service's header + its LIVE time-picker (availability,
   *  slot selection, booking). A per-record functional template (`scheduling.service` record
   *  type); the route passes the service id via context. Interactive (client widget). */
  schedulingServiceDetail: 'scheduling.service-detail',
  /** The shopper account AUTH form — sign-in / create-account / forgot / reset. ONE core
   *  parameterized by a `mode` host prop (the route/composite sets it; not author-tunable),
   *  so every public /account entry page is one editable shell around this pinned form.
   *  Interactive (client widget); reads its own URL params (redirect / token). */
  commerceAuth: 'commerce.auth',
  /** The site BRAND MARK — the tenant's logo and/or site name, linked home. The one
   *  core that is NOT pinned (`pinned: false`): the tenant may move, restyle, or
   *  delete it like any other node.
   *
   *  It is a host core for a different reason than the others — not to protect a
   *  transaction, but so the platform can keep improving it. A STAMPED brand node
   *  freezes at publish: the tenant who published before `Wordmark` could hold a
   *  logo has a text-only mark forever, and no amount of fixing the composite
   *  reaches them (docs/122 §"Key facts": a composite change never re-authors a
   *  stored tree). A host node stores only a mount point, so the mark renders LIVE
   *  from Site settings on every request — upload a logo, it appears, no builder
   *  trip. `show` picks logo / name / both, which a bound tree cannot express (it
   *  has no conditional — the open "silicaui ask" in docs/122's logo-on-wordmark
   *  note). Staleness-immunity comes from `kind:"host"`; `locked` is orthogonal. */
  siteBrand: 'site.brand',
  /** The ARTICLE BODY of the in-scope CMS entry — the post's rich text, serialized.
   *
   *  A host core rather than a bound node because the body is not a string: it is a
   *  rich-text DOCUMENT (`{type:'doc',content:[…]}`) that only means anything once
   *  `renderDocToHtml` walks it into sanitized markup with its headings, lists,
   *  quotes, callouts, code and embeds intact. A value bind would stringify the
   *  object; there is no binding kind that renders a document. So the one thing a
   *  blog-post template exists to show had no way to appear on the canvas at all,
   *  and every tenant fell through to the bare no-template fallback.
   *
   *  Per-record: the route hands the entry's doc to the storefront renderer, so the
   *  core needs no props — the author places it, and the routed post fills it. */
  cmsArticleBody: 'cms.article-body',
  /** A light/dark theme toggle — a button that flips the site between its light and dark
   *  palettes. A host core, not an authored button, for two reasons a static silica tree
   *  cannot meet: it is INTERACTIVE (client state + the `sparx_theme` cookie the SSR
   *  no-flash script reads), and it must AUTO-HIDE unless the tenant's appearance policy
   *  actually offers both themes (`toggle`) — under any single-theme / device-follow
   *  policy it renders nothing. Place it in the frame's navbar; the storefront mounts the
   *  real cookie-backed control (the same one the default header uses), so a silica-framed
   *  site gets a working toggle the shipped `theme-toggle` behavior can't provide (that one
   *  persists to localStorage, not the cookie the storefront reads). Not pinned. */
  siteThemeToggle: 'site.theme-toggle',
  /** The site's LEGAL LINKS — privacy / terms / cookie-policy / returns / shipping /
   *  refund, exactly the documents the tenant has actually published, read live from
   *  their doc placements.
   *
   *  A host core rather than authored anchors because the links are DATA the tenant
   *  owns elsewhere, and a static tree gets them wrong in both directions. The starter
   *  footer used to HARDCODE `/privacy-policy` + `/terms-of-service`, so every silica
   *  site promised two legal pages the tenant may never have created — a guaranteed
   *  404 in the footer of a brand-new site. The inverse is just as bad: a tenant who
   *  publishes a cookie policy and a returns policy gets no link to either, because the
   *  frame was stamped before those pages existed.
   *
   *  It also needs a conditional a bound tree cannot express (the same reason
   *  `site.brand` has `show`): with nothing published it must render NOTHING — heading
   *  included — rather than an empty "Legal" column. Mirrors the default storefront
   *  footer, which appends its Legal column only when `getLegalFooterLinks` is
   *  non-empty. Not pinned: the tenant owns where the links sit (a footer column, a
   *  bottom bar, beside the copyright). */
  siteLegalLinks: 'site.legal-links',
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

/** Palette + inspector metadata for one core — a React-free mirror of the builder's
 *  `HostComponentDef` (`apps/dashboard` maps this onto the real type).
 *
 *  A core is `pinned` by DEFAULT (inserted `locked: "host"`), so the tenant styles +
 *  repositions the shell around it but can never delete the transaction. `pinned:
 *  false` opts out for a core that is live-rendered for IMPROVABILITY rather than to
 *  protect a transaction — see `HOST_KEYS.siteBrand`. The two properties are
 *  orthogonal: `kind:"host"` is what makes a node immune to going stale; `locked` is
 *  only about whether the editing spine may move or remove it. */
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
  /** Whether inserting this core stamps `locked: "host"` (the engine then refuses to
   *  move or remove it, and the author UI offers no unlock). Defaults TRUE — a
   *  functional core must never be deletable. Set `false` only for a core the tenant
   *  legitimately owns the placement of (the brand mark). */
  pinned?: boolean;
}

/** Every host core the studio offers, module-grouped. The dashboard turns this into
 *  `hostComponents(): HostComponentDef[]` (carrying each entry's `pinned`, default
 *  true) and the site turns each `key` into the real component the storefront mounts. */
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
    key: HOST_KEYS.commerceCollectionDetail,
    label: 'Collection detail',
    category: 'commerce',
    icon: 'gallery',
    hint: 'One collection: its header and members as a filterable, sortable, paginated grid. Pinned: style and surround it, but it can’t be removed.',
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
  {
    key: HOST_KEYS.siteBrand,
    label: 'Brand (logo + name)',
    category: 'brand',
    icon: 'image',
    hint: 'Your logo and site name, linked to your home page. Set them once in Site settings — this always shows what’s there.',
    // The `wordmark` class is load-bearing, not decoration: silicaui's own
    // `.wordmark & :is(svg,img)` rule sizes the mark, so keeping it makes this a real
    // Wordmark rather than a lookalike lockup.
    // `gap-2`, not the half-step `gap-2.5` this used to carry: the declared authoring
    // vocabulary has no half steps, so that class only ever compiled because this
    // source file happens to be @source-scanned. Copied into a tenant's tree it is a
    // class that emits nothing the moment this line changes — which is precisely the
    // failure `checkClassString` exists to catch, and it caught this one.
    defaultClass: 'wordmark inline-flex items-center gap-2',
    // The conditional a BOUND tree cannot express: two bound children always both
    // render, which is why the composite had to tell authors to "delete the part you
    // don't want". The host renders in React, so it can simply choose.
    props: [
      {
        name: 'show',
        label: 'Show',
        type: 'select',
        default: 'both',
        options: [
          { value: 'both', label: 'Logo and name' },
          { value: 'logo', label: 'Logo only' },
          { value: 'name', label: 'Name only' },
        ],
      },
    ],
    // NOT pinned — the tenant owns where their own brand sits. See HOST_KEYS.siteBrand
    // for why it is a host core anyway.
    pinned: false,
  },
  {
    key: HOST_KEYS.siteThemeToggle,
    label: 'Theme toggle (light / dark)',
    category: 'brand',
    icon: 'settings',
    hint: 'A light/dark switch for visitors. Appears only when your site offers both themes (Appearance: toggle) — otherwise it stays hidden. Place it in your header.',
    defaultClass: 'inline-flex items-center',
    // Not pinned: the tenant owns whether and where a theme switch sits in their chrome.
    pinned: false,
  },
  {
    key: HOST_KEYS.siteLegalLinks,
    label: 'Legal links',
    category: 'brand',
    icon: 'article',
    hint: 'Links to the legal pages you have published — privacy, terms, cookies, returns. Always current, and hidden entirely until you publish one. Put it in your footer.',
    // A footer link column: the heading + its links stacked, matching the hand-authored
    // columns beside it.
    defaultClass: 'flex flex-col gap-3',
    props: [
      {
        name: 'heading',
        label: 'Heading',
        type: 'text',
        // Blank renders the links with no heading — for a bottom bar or a copyright row,
        // where a column title would be wrong.
        default: 'Legal',
      },
    ],
    // Not pinned: the tenant owns their footer layout. Pinning would leave an
    // undeletable empty box on a site with no legal pages published yet.
    pinned: false,
  },
  {
    key: HOST_KEYS.cmsArticleBody,
    label: 'Article body',
    category: 'cms',
    icon: 'article',
    hint: 'The written body of the post being shown — headings, lists, quotes, and images exactly as they were typed. Pinned: style and surround it, but it can’t be removed.',
    // Prose measure, not the 6xl page measure the commerce cores use: a line of body
    // text past ~75 characters is measurably harder to read, and this core is nothing
    // but body text.
    defaultClass: 'mx-auto w-full max-w-3xl px-6 py-10',
  },
];

/** Author a functional core as a `HostNode` — the kit's `host()` with the core's
 *  registered default wrapper classes, stamped `locked: "host"` unless the core opts
 *  out (`pinned: false`). The palette-insert path gets the lock from the `pinned`
 *  `HostComponentDef`, but a core embedded DIRECTLY in a code composite / starter page
 *  (not inserted) must carry the lock itself, or the studio would let the author delete
 *  the seeded core. `locked: "host"` = the engine refuses remove/move and shows no
 *  unlock (only the host clears it).
 *
 *  An UNPINNED core is a plain, movable node that merely happens to render live — the
 *  brand mark. Defaulting to locked keeps every functional core safe by omission: a new
 *  core is protected unless someone deliberately says otherwise. */
export function hostCore(
  key: HostComponentKey,
  cls?: string,
  props?: Record<string, unknown>
): HostNode {
  const meta = HOST_COMPONENTS.find((c) => c.key === key);
  const node = host(key, cls ?? meta?.defaultClass ?? '', props ?? defaultHostProps(key));
  return meta?.pinned === false ? node : { ...node, locked: 'host' };
}

/** A core's registered prop defaults, so a seeded core behaves identically to one
 *  inserted from the palette (the Inspector applies defaults on insert; a composite
 *  would otherwise emit a propless node and rely on the renderer's own fallback). */
function defaultHostProps(key: HostComponentKey): Record<string, unknown> | undefined {
  const props = HOST_COMPONENTS.find((c) => c.key === key)?.props;
  if (!props?.length) return undefined;
  const out: Record<string, unknown> = {};
  for (const p of props) if (p.default !== undefined) out[p.name] = p.default;
  return Object.keys(out).length > 0 ? out : undefined;
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
  // `@container`, like every other seeded section: the tenant is expected to add
  // their own content around the pinned core, and a responsive class they write
  // there needs an ancestor container to measure or it does nothing at all.
  return el('section', 'bg-base-100 @container', { children });
}
