// The reusable composition harness for the TEN reference-driven site-template
// blueprints (docs/templates/*). Each template is a `docs/templates/<ref>/DESIGN.md`
// study translated into one installable bundle: a DISTINCT silica site (its own home
// section sequence, its own example commerce + journal) dressed in the bespoke theme
// that DESIGN.md §6 pins. This file is the SHARED machinery every one of them runs
// through — `composeTemplateSite(spec)` builds the site, `emitBundle(spec)` writes the
// whole bundle to disk. A template's generator (`gen-template-<slug>.ts`) is then just
// its SPEC: the home beats, the brand, the commerce, the content, the assets.
//
// WHY RELATIVE IMPORTS (mirrors gen-sparx-themed.ts). This file lives under
// marketplace-catalog/, which has no node_modules, so a bare `@sparx/*` / `@wizeworks/*`
// specifier can't resolve from here. Importing each workspace package's `src` by
// relative path lets tsx compile it in place; each package's OWN deps still resolve from
// the package's own location. The silica node PRIMITIVES (`el`/`makePage`/…) are reached
// through the silica-catalog package's own copy of `@wizeworks/silicaui-html`, so the
// nodes this file mints and the nodes the catalog factories mint are the SAME module
// instance. The EMITTED blueprint.ts is the opposite discipline — pure data, sibling
// JSON only, never `@sparx/*`.

import { promises as fs } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    pageBody,
    stampTree,
    type Node,
    type Theme,
} from '../../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { starterFrame } from '../../../wizeworks/packages/silica-catalog/src/site';
import type {
    FooterVariant,
    NavbarVariant,
    SiteChromeOptions,
} from '../../../wizeworks/packages/silica-catalog/src/site-chrome';
import { shopHeader } from '../../../wizeworks/packages/silica-catalog/src/commerce';
import { blogIndexPage, blogPostGrid } from '../../../wizeworks/packages/silica-catalog/src/cms';
import { HOST_KEYS, functionalShell, hostCore } from '../../../wizeworks/packages/silica-catalog/src/host-nodes';
import { resolveSparxTheme } from '../../../wizeworks/packages/silica-catalog/src/resolve-sparx-theme';
import { TEMPLATE_THEME_BY_SLUG } from '../../../wizeworks/packages/silica-catalog/src/template-themes';
import { CONTENT_THEME_BY_SLUG } from '../../../wizeworks/packages/silica-catalog/src/content-themes';
import { colorToHex } from '../../../wizeworks/packages/site-themes/src/v2/color';
import { blueprintEmailDoc } from '../shared/blueprint-email';
import { contactSection } from '../shared/contact-section';

/** The bespoke theme for a template slug, from EITHER shelf — the ten commerce looks
 *  (`TEMPLATE_THEME_BY_SLUG`, keyed by the `docs/templates/*` slug) OR the ten content
 *  looks (`CONTENT_THEME_BY_SLUG`, keyed by the `docs/templates/content/*` slug). One
 *  lookup so a commerce and a content generator run through the identical harness; the two
 *  slug namespaces are disjoint, so a slug resolves to exactly one theme. */
function rawThemeForSlug(slug: string): Theme | undefined {
    return TEMPLATE_THEME_BY_SLUG[slug] ?? CONTENT_THEME_BY_SLUG[slug];
}

const here = dirname(fileURLToPath(import.meta.url));
const blueprintsDir = join(here, '..', '..', 'blueprints');

/** The payload version every template bundle ships. BUMP THIS whenever the emitted content
 *  changes — a marketplace artifact is IMMUTABLE per `(category, slug, version)`
 *  (`self-register.ts`: "written once and skipped forever after"), so without a bump the
 *  catalog keeps serving the OLD payload and a fresh install never sees the new pages. 1.1.0
 *  is the full 9-page sites (bespoke PDP + Collections/Cart/Search/Journal framing) over the
 *  original 1.0.0 home-only pass. Both the blueprint.ts and sparx.json versions read this, so
 *  they can't disagree (the loader cross-checks them).
 *
 *  1.5.0 carries the chrome the composite has been emitting since issue 291 — the
 *  account link in the bar and the phone panel, and the legal links in the footer —
 *  which the committed bundles had been a release behind on (issue 313). */
const BUNDLE_VERSION = '1.5.0';

// ── Types ─────────────────────────────────────────────────────────────────────

export type Vertical = 'retail' | 'b2b' | 'content' | 'services';

/** The standard pages every template composes — the keys `seo` overrides address.
 *  `product` is the PDP (a `commerce.product` collection template), present only when a
 *  template authors `spec.pdp`; the rest are singletons every bundle ships. */
export type PageKey =
    | 'home'
    | 'shop'
    | 'collections'
    | 'cart'
    | 'search'
    | 'journal'
    | 'about'
    | 'contact'
    | 'product'
    | 'article';

/** One template's authored spec. The home/about/contact bodies are the DISTINCT part;
 *  everything else follows the shared shape so the ten bundles stay uniform. */
export interface TemplateSiteSpec {
    /** The `docs/templates/*` sparx slug — the key into `TEMPLATE_THEME_BY_SLUG`. */
    slug: string;
    /** An INLINE bespoke theme (a `defineTheme` output), used verbatim when present instead of
     *  looking the slug up in the theme registries. This is what lets a large family of
     *  generators (a retail/commerce family) each be fully SELF-CONTAINED — its own theme lives
     *  in its own file, so parallel authoring never contends on a shared `*-themes.ts` registry.
     *  Omit it and the harness resolves the slug through `TEMPLATE_THEME_BY_SLUG` /
     *  `CONTENT_THEME_BY_SLUG` exactly as the original ten reference templates do. */
    theme?: Theme;
    /** The bundle key / directory name (`sparx-<slug>`). */
    key: string;
    /** Marketplace card identity. */
    name: string;
    summary: string;
    tagline: string;
    vertical: Vertical;
    /** The industry facet + card badge label (e.g. 'Design furniture & objects'). */
    industry: string;
    /** Mirrors gen-sparx-themed — a validation-consistency list, not an install gate. */
    requiresModules: string[];
    /** Sort weight on the marketplace grid. */
    sortWeight: number;
    /** IDENTITY ONLY — the business name + tagline. Colors + fonts are derived from the
     *  bespoke theme (below), never hand-typed, so the card can never drift from the look. */
    brand: { businessName: string; tagline: string };
    /** Optional site-chrome overrides for this template — which navbar/footer shape the
     *  frame starts on and whether the bar carries a filled CTA. Merged OVER the shared
     *  `{ commerceEnabled, cmsEnabled }` default, so a template that omits it keeps the
     *  plain brand-left header + columns footer every other bundle ships. */
    chrome?: { navbar?: NavbarVariant; footer?: FooterVariant; showCta?: boolean };
    /** REAL, business-voiced search title + description per page — so the shipped starter's
     *  search results and link previews read like the real business from the first install,
     *  not a formulaic "<name> — <industry>, online." fallback. `home` (and usually `about`)
     *  should always be authored here; the transactional pages (shop/cart/search/…) fall back
     *  to the composed standard copy in `standardSeo`, which is genuine functional copy. */
    seo?: Partial<Record<PageKey, { title: string; description: string }>>;
    /** The home page's section sequence — the Kith/Gymshark/… beat order, already built. */
    home: Node[];
    /** The BESPOKE product-detail body — the template's own buy box + cross-sell, built with
     *  the `template-sites/pdp.ts` kit (`productPage(buyRegion, …)`). When present the harness
     *  ships it as a `commerce.product` collection template (`isDefault`), so the storefront
     *  renders THIS design at `/products/:handle` instead of falling back to the starter buy
     *  box. Omit and the template keeps the generic PDP. This is the point of the full-site
     *  pass — a store lives on its product page. */
    pdp?: Node;
    /** The BESPOKE article-detail body — the CONTENT analog of `pdp`, built self-scoped over a
     *  `blog_post` record (bind fields scope-relative, article body through the pinned
     *  `cms.article-body` core). When present the harness ships it as a `cms.blog_post`
     *  collection template (`isDefault`), so the storefront renders THIS design at `/blog/:slug`
     *  instead of the code-native `blogPostPage()`. Omit and the template keeps the generic
     *  article page. This is the point of a content template — a publisher lives on its article
     *  page the way a shop lives on its PDP. Author it with the shared `template-sites/article.ts`
     *  kit. */
    article?: Node;
    /** BESPOKE shop-page sections shown ABOVE the faceted PLP core. When present they replace
     *  the generic `shopHeader()` (a themed hero/intro band the brand authors); the harness
     *  ALWAYS appends the pinned `commerce.plp` core beneath them, so the shop stays genuinely
     *  shoppable (facets + sort + pagination) no matter what the template puts on top. Omit and
     *  the shop keeps the standard `shopHeader()` + core. */
    shop?: Node[];
    /** BESPOKE header/framing sections for the remaining functional pages, each shown ABOVE
     *  that page's pinned server-computed core (the collections grid, the cart, the search
     *  results) — the SAME contract as `shop`. The core is a shared, faceted, shoppable widget
     *  a blueprint FRAMES, not rebuilds; these give each its own themed masthead, empty-state
     *  encouragement and trust/cross-sell copy so the page reads as the brand's, not the
     *  platform's. Omit any and that page keeps the standard `functionalShell` heading + core. */
    collections?: Node[];
    cart?: Node[];
    search?: Node[];
    /** BESPOKE journal-index sections — a template's own editorial masthead, shown ABOVE the
     *  shared `blogPostGrid()` (the correct, linkable `cms.blog_post` repeat). Replaces the
     *  generic `blogIndexPage()` masthead; omit to keep it. */
    journal?: Node[];
    /** The About page body (defaults to a neutral two-band about if omitted). */
    about?: Node[];
    /** The Contact page body (defaults to a neutral reach-out prompt if omitted). */
    contact?: Node[];
    /** CommerceDecl — categories + collections + products (the carousels bind to these). */
    commerce: unknown;
    /** AuthorDecl[] — the byline personas the posts reference by `authorSlug`. Empty/omitted
     *  for a template whose posts carry no byline; a content template ships its masthead here
     *  so the storefront byline projection has real authors to resolve. */
    authors?: unknown[];
    /** ContentEntryDecl[] — the journal posts. */
    content: unknown[];
    /** AssetDecl[] — every image URL the bundle references, each with alt. */
    assets: unknown[];
    /** EmailDecl[] — brand-voiced MARKETING starters (UNKEYED; the platform's keyed
     *  transactional defaults — order/shipping/dunning — are separate and never duplicated
     *  here). Omit and a `retail` shop gets the default welcome + win-back (`commerceEmails`);
     *  a `content` template gets none. Pass an explicit array to override either way. */
    emails?: unknown[];
}

// ── Site composition ────────────────────────────────────────────────────────────

/** One singleton page, projected to the SiteDecl shape the loader validates
 *  (`{ name, kind, slug?, root, seoTitle?, seoDescription? }`, no runtime id — the installer
 *  mints it). Home is the one page with no slug. Every root is fully STAMPED so the studio
 *  opens live, editable trees the moment the site installs. `seo` gives the page a search
 *  title + description so the shipped starter passes the same SEO lint a tenant's Check panel
 *  runs (site-lint `blueprint-sweep`) — an untitled page is a warning an owner inherits. */
function singleton(
    name: string,
    slug: string,
    root: Node,
    seo?: { title: string; description: string }
): Record<string, unknown> {
    return {
        name,
        kind: 'singleton',
        ...(slug ? { slug } : {}),
        ...(seo ? { seoTitle: seo.title, seoDescription: seo.description } : {}),
        root: stampTree(root),
    };
}

/** One record-template page, projected to the SiteDecl shape the loader validates for a
 *  collection page (`{ name, kind:'collection', recordType, isDefault, root, seo? }`, NO
 *  slug — `siteService.installSite` derives the record address `/products/:handle` from the
 *  `recordType`, per `recordAddressFor` in the sync layer, so authoring a slug here would
 *  only risk drifting from the route). `isDefault` makes it the default template for its
 *  recordType, which is what makes a PUBLISHED bespoke PDP win over the starter fallback. */
function collectionPage(
    name: string,
    recordType: string,
    root: Node,
    seo?: { title: string; description: string }
): Record<string, unknown> {
    return {
        name,
        kind: 'collection',
        recordType,
        isDefault: true,
        ...(seo ? { seoTitle: seo.title, seoDescription: seo.description } : {}),
        root: stampTree(root),
    };
}

/** Per-page search title + description for the eight standard pages. The template's own
 *  `spec.seo` — REAL, business-voiced copy — wins for any page it names (always `home`,
 *  usually `about`); the rest fall back to the composed standard below, which is genuine
 *  functional copy naming the business, not a "barely non-empty" placeholder. Each entry is
 *  DISTINCT within the site (the SEO lint flags two pages sharing a title/description). */
function standardSeo(
    spec: TemplateSiteSpec
): Record<PageKey, { title: string; description: string }> {
    const bn = spec.brand.businessName;
    const tag = spec.brand.tagline;
    const ind = spec.industry;
    const composed: Record<PageKey, { title: string; description: string }> = {
        home: { title: bn, description: `${tag} ${bn} — ${ind.toLowerCase()}, online.` },
        shop: {
            title: `Shop — ${bn}`,
            description: `Browse everything ${bn} makes, with prices and options at a glance. ${ind}.`,
        },
        collections: {
            title: `Collections — ${bn}`,
            description: `Explore the collections at ${bn}, grouped to help you find what you are after.`,
        },
        cart: {
            title: `Your cart — ${bn}`,
            description: `Review what is in your cart and check out securely at ${bn}.`,
        },
        search: {
            title: `Search — ${bn}`,
            description: `Search ${bn} for a product, a collection or a page.`,
        },
        journal: {
            title: `Journal — ${bn}`,
            description: `Stories, guides and notes from ${bn}.`,
        },
        about: {
            title: `About — ${bn}`,
            description: `Who ${bn} is, what we make and why — the people behind the work.`,
        },
        contact: {
            title: `Contact — ${bn}`,
            description: `Get in touch with ${bn} — questions, orders and anything else you need.`,
        },
        // The PDP is a record template: its title/description are per-PRODUCT at runtime (the
        // product's own `seoTitle`/`seoDescription`). This page-level pair is only the fallback
        // the studio shows for the template itself, so it names the business, not one product.
        product: {
            title: `Product — ${bn}`,
            description: `Product details at ${bn} — ${ind.toLowerCase()}, with options and pricing.`,
        },
        // The article template is likewise a record template — per-POST title/description at
        // runtime. This page-level pair is only the studio fallback for the template itself.
        article: {
            title: `Article — ${bn}`,
            description: `A story from ${bn} — the writing, the reporting and the notes behind it.`,
        },
    };
    // The template's own real copy wins per page; the composed default fills the rest.
    const out = { ...composed };
    for (const [key, value] of Object.entries(spec.seo ?? {})) {
        if (value) out[key as PageKey] = value;
    }
    return out;
}

/** The shared chrome frame with the Journal destination retargeted from `/blog` to
 *  `/journal`.
 *
 *  WHY. The journal INDEX is a singleton page, and `/blog` is owned by the storefront's
 *  hard `blog/[slug]` route (there is no `blog/page.tsx`), so a singleton at `/blog`
 *  404s — the marketplace bundle rule. The starter chrome's nav + footer link the
 *  Journal at `/blog` (correct for the code-native starter, which is served
 *  differently); a bundle must point them at the `/journal` index it actually ships.
 *  An exact quoted-string swap only touches the standalone `"/blog"` href, never a
 *  `"/blog/<slug>"` post link (of which the frame has none). */
function frameForBundle(chromeOpts: SiteChromeOptions): {
    root: Node;
} {
    const root = starterFrame(chromeOpts).root as Node;
    const retargeted = JSON.parse(JSON.stringify(root).split('"/blog"').join('"/journal"')) as Node;
    return { root: retargeted };
}

/** A neutral default About body — used when a spec doesn't author its own. */
function defaultAbout(spec: TemplateSiteSpec): Node[] {
    return [aboutBand(spec.brand.businessName)];
}
function defaultContact(): Node[] {
    return [contactBand()];
}

/** Compose ONE template's distinct silica site as a SiteDecl (`{ frame, pages, theme }`,
 *  the projection the golden bundle's site.json is in). The bespoke theme comes from
 *  `TEMPLATE_THEME_BY_SLUG[slug]`, resolved to the flat ship-ready token bag. */
export function composeTemplateSite(spec: TemplateSiteSpec): Record<string, unknown> {
    const rawTheme = spec.theme ?? rawThemeForSlug(spec.slug);
    if (!rawTheme) throw new Error(`harness: no template theme for slug "${spec.slug}"`);
    const theme = resolveSparxTheme(rawTheme);

    // Commerce + CMS on, scheduling off — the Kith-family archetype is shop + journal. A
    // template's own `chrome` (navbar/footer shape, CTA visibility) merges OVER that default.
    const chromeOpts: SiteChromeOptions = {
        commerceEnabled: true,
        cmsEnabled: true,
        // A wholesale/trade site's nav CTA opens an account, not a chat — unless the template's
        // own chrome overrides it. (Retail keeps the default "Get in touch".)
        ...(spec.vertical === 'b2b' ? { ctaLabel: 'Open a trade account' } : {}),
        ...(spec.chrome ?? {}),
    };
    const frame = frameForBundle(chromeOpts);

    const seo = standardSeo(spec);
    // The Shop page: a template's own `spec.shop` intro sections sit ABOVE the pinned faceted
    // PLP core (so the shop stays genuinely shoppable no matter what the brand puts on top);
    // absent a bespoke intro it keeps the standard `shopHeader()`. The core is ALWAYS present.
    // Each functional page: a template's own bespoke header sections ABOVE the pinned core
    // (the shoppable/searchable widget the harness always keeps), or the standard
    // `functionalShell` heading + core when the template authors none.
    const shopBody = [...(spec.shop ?? [shopHeader()]), hostCore(HOST_KEYS.commercePlp)];
    const collectionsBody = spec.collections
        ? [...spec.collections, hostCore(HOST_KEYS.commerceCollections)]
        : // `heading` passed, like Cart and Search below. Without it `functionalShell` emits
        // the bare core and nothing else, so ten shipped bundles had a Collections page
        // with NO heading of any level on it — a page a screen reader announces as
        // untitled, and a search result with nothing to title it.
        [functionalShell(HOST_KEYS.commerceCollections, { heading: 'Collections' })];
    const cartBody = spec.cart
        ? [...spec.cart, hostCore(HOST_KEYS.commerceCart)]
        : [functionalShell(HOST_KEYS.commerceCart, { heading: 'Your cart' })];
    const searchBody = spec.search
        ? [...spec.search, hostCore(HOST_KEYS.commerceSearch)]
        : [functionalShell(HOST_KEYS.commerceSearch, { heading: 'Search' })];
    // Journal: the template's editorial masthead over the shared linkable post grid, else the
    // standard index.
    const journalBody = spec.journal ? pageBody([...spec.journal, blogPostGrid()]) : blogIndexPage();
    const pages = [
        // The DISTINCT home — the template's own section sequence.
        singleton('Home', '', pageBody(spec.home), seo.home),
        // Standard commerce surfaces (the faceted PLP under an editable header + the
        // functional cores a shop needs), the same shells the code-native starter seeds.
        singleton('Shop', 'shop', pageBody(shopBody), seo.shop),
        singleton('Collections', 'collections', pageBody(collectionsBody), seo.collections),
        singleton('Cart', 'cart', pageBody(cartBody), seo.cart),
        singleton('Search', 'search', pageBody(searchBody), seo.search),
        // The journal INDEX at `/journal` (not `/blog` — see `frameForBundle`).
        singleton('Journal', 'journal', journalBody, seo.journal),
        singleton('About', 'about', pageBody(spec.about ?? defaultAbout(spec)), seo.about),
        // Each template authors its own Contact copy (its heading and its voice) as a
        // `contactSection(…)` call — the SHAPE (bound channels + working form) is shared,
        // only the words are per-template. `defaultContact` is the same section with neutral
        // wording, for a spec that authors none.
        singleton('Contact', 'contact', pageBody(spec.contact ?? defaultContact()), seo.contact),
        // The BESPOKE product-detail template, when the template authors one. A collection page
        // (`kind:'collection'`, `recordType:'commerce.product'`, `isDefault`) the installer lands
        // at `/products/:handle` — published, it wins over the starter buy box, so every product
        // wears the template's own PDP. Appended last so the ordinary pages keep their positions.
        ...(spec.pdp ? [collectionPage('Product', 'commerce.product', spec.pdp, seo.product)] : []),
        // The BESPOKE article-detail template — the content analog. A `cms.blog_post` collection
        // page (`isDefault`) the installer lands at `/blog/:slug` (RECORD_ADDRESSES), so every
        // post wears the template's own article design instead of the generic `blogPostPage()`.
        ...(spec.article ? [collectionPage('Article', 'cms.blog_post', spec.article, seo.article)] : []),
    ];

    return { frame, pages, theme };
}

// ── Bundle emission ──────────────────────────────────────────────────────────────

/** colorToHex, fail-fast — a theme role that won't resolve is a generator bug worth
 *  stopping on, not a silent `#000000` (mirrors gen-sparx-themed). */
function hex(value: string | undefined, ctx: string): string {
    const out = colorToHex(value ?? null);
    if (!out) throw new Error(`harness: ${ctx} did not resolve to hex (got ${value})`);
    return out;
}

/** First family name in a silica font stack (`"Fraunces", serif` → `Fraunces`). */
function firstFamily(stack: string | undefined): string | undefined {
    const first = stack?.split(',')[0]?.trim().replace(/^['"]|['"]$/g, '');
    return first || undefined;
}

/** The `heading`/`body` font families a theme states, reading the raw `.fonts` object
 *  when present (a `defineTheme` theme) OR the resolved `--font-head`/`--font-sans` tokens
 *  (a `resolveSparxTheme` output has no `.fonts`), and falling back to silica's own default
 *  face names when a theme declares no type. Exported so the preview module derives the
 *  same Google-Font families the bundle ships. */
export function faces(theme: Theme): { heading: string; body: string } {
    const fonts = (theme as { fonts?: { sans?: { family?: string }; head?: { family?: string } } })
        .fonts;
    const tokens = (theme as { tokens?: Record<string, string> }).tokens ?? {};
    const body = fonts?.sans?.family ?? firstFamily(tokens['--font-sans']) ?? 'Inter';
    const heading =
        fonts?.head?.family ?? firstFamily(tokens['--font-head']) ?? firstFamily(tokens['--font-heading']) ?? body;
    return { heading, body };
}

const json = (value: unknown): string => JSON.stringify(value, null, 2) + '\n';

/** The emitted, PURE-DATA blueprint.ts (sibling-JSON imports only — never `@sparx/*`;
 *  the loader `import()`s this with no workspace resolution). Prettier reformats the
 *  inlined literals after generation, so this only has to be valid TS. */
function blueprintTs(opts: {
    key: string;
    name: string;
    summary: string;
    vertical: Vertical;
    requiresModules: string[];
    brand: unknown;
    theme: unknown;
}): string {
    return `// ${opts.name}: a reference-driven SITE TEMPLATE (docs/templates/*),
// composed distinct — its own home section sequence, example commerce, and journal —
// and dressed in the bespoke theme its DESIGN.md pins.
//
// GENERATED by marketplace-catalog/_gen/gen-template-${opts.key.replace(/^sparx-/, '')}.ts
// via the shared _gen/template-sites/harness.ts — do NOT hand-edit; edit the generator
// and regenerate. A blueprint is PURE DATA: the loader \`import()\`s this module with no
// workspace resolution, so it imports ONLY sibling JSON, never \`@sparx/*\`.
import site from './site.json' with { type: 'json' };
import content from './content.json' with { type: 'json' };
import authors from './authors.json' with { type: 'json' };
import commerce from './commerce.json' with { type: 'json' };
import assets from './assets.json' with { type: 'json' };
import emails from './emails.json' with { type: 'json' };

const blueprint = {
  key: ${JSON.stringify(opts.key)},
  version: '${BUNDLE_VERSION}',
  name: ${JSON.stringify(opts.name)},
  summary: ${JSON.stringify(opts.summary)},
  vertical: ${JSON.stringify(opts.vertical)},
  preview: 'media/preview.png',
  requiresModules: ${JSON.stringify(opts.requiresModules)},

  // Identity only (business name + tagline + fonts + the theme's hex colors). The look
  // itself rides site.theme + the theme decl below; the installing tenant rebrands the name.
  brand: ${JSON.stringify(opts.brand, null, 2)},

  // The provisioned SiteTheme the installer creates + applies — the bespoke template
  // look as a tenant-editable saved theme (base preset = the template's own theme key,
  // plus its brand snapshot).
  theme: ${JSON.stringify(opts.theme, null, 2)},

  assets,
  contentTypes: [],
  authors,
  content,
  commerce,

  // A shop's brand-voiced MARKETING starters (a welcome + a win-back), tokenized so a fork
  // re-themes to the tenant and installed as DRAFTS — the platform's keyed transactional
  // defaults (order/shipping/dunning) are separate and never duplicated here. Content
  // templates ship an empty set.
  emails,
  sequences: [],

  // The composed distinct site (frame + a template-specific home + standard commerce/
  // cms/about/contact pages + the /journal index), in the bespoke theme, fully stamped.
  site,
};

export default blueprint;
`;
}

/** The hand-maintained-shaped manifest (sparx.json). Emitted here for the first build;
 *  it survives regens afterward (like media/), per marketplace-catalog/CLAUDE.md. */
function manifestJson(opts: {
    key: string;
    name: string;
    summary: string;
    tagline: string;
    vertical: Vertical;
    industry: string;
    accent: string;
    sortWeight: number;
}): unknown {
    return {
        schemaVersion: 1,
        category: 'blueprint',
        slug: opts.key,
        name: opts.name,
        version: BUNDLE_VERSION,
        tagline: opts.tagline,
        description: opts.summary,
        payload: 'blueprint.ts',
        facets: {
            vertical: opts.vertical,
            industry: opts.industry,
        },
        pricing: { model: 'free', priceCents: 0 },
        // A validation-consistency list, not an install gate (see gen-sparx-themed): the
        // template's content is independent of a tenant's active modules.
        requires: { modules: ['builder', 'commerce', 'cms', 'crm', 'email'] },
        media: [
            { file: 'media/icon.png', kind: 'icon', alt: `${opts.name} icon` },
            { file: 'media/preview.png', kind: 'preview', alt: `${opts.name} — home page preview` },
        ],
        author: { displayName: 'WizeWorks' },
        accent: opts.accent,
        sortWeight: opts.sortWeight,
    };
}

/** Build every part of one template bundle and write it to
 *  `blueprints/<key>/`. Returns the resolved theme (light tokens) so a caller can
 *  render a preview against the exact same look the bundle ships. */
export async function emitBundle(spec: TemplateSiteSpec): Promise<{ dir: string; theme: Theme }> {
    const rawTheme = spec.theme ?? rawThemeForSlug(spec.slug);
    if (!rawTheme) throw new Error(`harness: no template theme for slug "${spec.slug}"`);
    const resolved = resolveSparxTheme(rawTheme);
    const light = resolved.tokens ?? {};
    const { heading, body } = faces(rawTheme);

    const primary = hex(light['--color-primary'], `${spec.key} primary`);
    const primaryForeground = hex(light['--color-primary-content'], `${spec.key} primary-content`);
    const accent = hex(light['--color-accent'], `${spec.key} accent`);
    const secondary = hex(light['--color-secondary'], `${spec.key} secondary`);

    const brand = {
        businessName: spec.brand.businessName,
        tagline: spec.brand.tagline,
        colors: { primary, primaryForeground, accent, secondary },
        fonts: { heading, body },
    };

    const themeDecl = {
        name: spec.slug,
        // The base is the bespoke theme itself — a saved theme carries a presentation
        // overlay + a brand snapshot, never a palette, so the base is where the colors
        // come from.
        basePresetKey: spec.slug,
        presentation: { v: 2, containerWidth: '1152px' },
        brand: {
            colorPrimary: primary,
            colorAccent: accent,
            colorSecondary: secondary,
            fontHeading: heading,
            fontBody: body,
            tokens: {},
        },
        apply: true,
    };

    const site = composeTemplateSite(spec);

    const dir = join(blueprintsDir, spec.key);
    await fs.mkdir(join(dir, 'media'), { recursive: true });

    // The default marketing starters unless the spec authors its own — a COMMERCE vertical
    // (retail OR b2b/wholesale) gets the shop welcome + win-back; a CONTENT template gets the
    // publisher welcome. Both installed as drafts.
    const emails =
        spec.emails ??
        (spec.vertical === 'content' ? contentEmails(spec) : commerceEmails(spec));

    await fs.writeFile(join(dir, 'site.json'), json(site));
    await fs.writeFile(join(dir, 'commerce.json'), json(spec.commerce));
    await fs.writeFile(join(dir, 'authors.json'), json(spec.authors ?? []));
    await fs.writeFile(join(dir, 'content.json'), json(spec.content));
    await fs.writeFile(join(dir, 'assets.json'), json(spec.assets));
    await fs.writeFile(join(dir, 'emails.json'), json(emails));
    await fs.writeFile(
        join(dir, 'blueprint.ts'),
        blueprintTs({
            key: spec.key,
            name: spec.name,
            summary: spec.summary,
            vertical: spec.vertical,
            requiresModules: spec.requiresModules,
            brand,
            theme: themeDecl,
        })
    );
    await fs.writeFile(
        join(dir, 'sparx.json'),
        json(
            manifestJson({
                key: spec.key,
                name: spec.name,
                summary: spec.summary,
                tagline: spec.tagline,
                vertical: spec.vertical,
                industry: spec.industry,
                accent: primary,
                sortWeight: spec.sortWeight,
            })
        )
    );

    return { dir, theme: resolved };
}

// ── Neutral default About / Contact bodies (reusable across templates) ──────────

// Imported lazily to keep the shell helpers a private detail of the harness. These are
// authored directly from the node primitive so a template that doesn't override them
// still ships a real, editable About/Contact rather than an empty page.
import { el } from '../../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

function aboutBand(businessName: string): Node {
    return el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
                        text: `About ${businessName}`,
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'This is your story — who you are, what you make, and why it matters. Replace this with a few honest sentences about your work; the people who find you here want to know the human behind it.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Add sections, images, and links from the builder. This page grows with you.',
                    }),
                ],
            }),
        ],
    });
}

/** The Contact page. The business's own channels (each hidden until set in Site settings)
 *  over a working enquiry form that reaches the tenant's Form submissions inbox.
 *
 *  It used to be a heading, a paragraph telling the OWNER to add a contact method, and a
 *  button pointing at `mailto:hello@example.com` — a placeholder domain that shipped live
 *  on 66 storefronts as the single way to reach the business, next to a form pipeline the
 *  platform already had. See shared/contact-section.ts for the full finding. */
function contactBand(): Node {
    return contactSection({
        heading: 'Get in touch',
        intro: 'Questions about an order, a wholesale enquiry, or something you would like us to make? Send a note and a real person will reply.',
        submitLabel: 'Send message',
    });
}

// ── Marketing-email starters ──────────────────────────────────────────────────────
//
// A shop should greet a new subscriber and win a lapsed one back. These are the two
// brand-voiced MARKETING starters every retail template ships (drafts on install),
// tokenized with the canonical merge tags (`{{site.name}}`, `{{customer.firstName}}`,
// `{{site.url}}`) so a fork re-themes to the tenant. MARKETING ONLY — order confirmation /
// shipping / dunning are platform KEYED transactional defaults and are never duplicated here.

/** Build ONE silica `EmailDocument` in the shape the email editor saves + `renderSilicaEmail`
 *  sends (body → section → heading / paragraphs / button). Colors carry the `*Auto` flags so
 *  the mail re-themes light/dark per tenant, exactly like the core blueprints' emails. Node
 *  ids are namespaced per email so a doc's nodes stay unique. */
/** The default MARKETING starters for a shop — a welcome and a win-back, both installed as
 *  drafts (`publish: false`, like every blueprint email). The copy is shop-voiced but
 *  vertical-neutral (it reads right for a coffee roaster, a boutique, or a plant shop alike)
 *  and the CTAs point at the site's live `/shop`. */
function commerceEmails(_spec: TemplateSiteSpec): Record<string, unknown>[] {
    return [
        {
            name: 'Welcome',
            publish: false,
            doc: blueprintEmailDoc({
                subject: 'Welcome to {{site.name}}',
                preheader: 'So glad you found us — here’s where to start.',
                heading: 'Welcome, {{customer.firstName}}',
                paragraphs: [
                    'Thanks for joining {{site.name}}. We put a lot of care into what we make and sell, and we’re glad you’re here to see it.',
                ],
                features: [
                    {
                        title: 'Everything in one place',
                        body: 'Your cart, orders, and favourites live in your account — sign in any time to pick up where you left off.',
                    },
                    {
                        title: 'Here to help',
                        body: 'Reply to any email from us and you’ll reach a real person — not a bot.',
                    },
                ],
                button: { label: 'Shop now', href: '{{site.url}}/shop' },
            }),
        },
        {
            name: 'We saved your spot',
            publish: false,
            doc: blueprintEmailDoc({
                subject: 'Still thinking it over, {{customer.firstName}}?',
                preheader: 'Your favourites are waiting at {{site.name}}.',
                heading: 'We’d love to see you again',
                paragraphs: [
                    'It’s been a little while, {{customer.firstName}}. Whenever you’re ready, {{site.name}} is right where you left it.',
                ],
                highlight: {
                    title: 'New since your last visit',
                    body: 'A few fresh arrivals and returning favourites have landed — come take a look and see what’s caught our eye lately.',
                },
                button: { label: 'See what’s new', href: '{{site.url}}/shop' },
            }),
        },
    ];
}

/** The default MARKETING starter for a CONTENT template — a publisher's welcome to a new
 *  subscriber, installed as a draft (`publish: false`). Voiced for a publication (a
 *  newsroom, a magazine, a journal) rather than a shop, and its CTA points at the site's
 *  live `/journal` index instead of `/shop`. Tokenized with the same canonical merge tags
 *  so a fork re-themes to the tenant. A content template ships this one starter; a shop
 *  ships `commerceEmails` (welcome + win-back) instead. */
function contentEmails(_spec: TemplateSiteSpec): Record<string, unknown>[] {
    return [
        {
            name: 'Welcome',
            publish: false,
            doc: blueprintEmailDoc({
                subject: 'Welcome to {{site.name}}',
                preheader: 'Thanks for subscribing — here’s where to begin.',
                heading: 'Welcome, {{customer.firstName}}',
                paragraphs: [
                    'Thanks for subscribing to {{site.name}}. You’ll be first to read what we publish — the stories, the reporting, and the ideas we think are worth your time.',
                ],
                features: [
                    {
                        title: 'Straight to your inbox',
                        body: 'New pieces land here first — no noise, just the work we think is worth your time.',
                    },
                    {
                        title: 'Start with the latest',
                        body: 'Catch up on what we’ve been working on — our newest stories are waiting in the journal.',
                    },
                ],
                button: { label: 'Read the latest', href: '{{site.url}}/journal' },
            }),
        },
    ];
}
