// The per-record-type default template registry.
//
// WHY THIS IS A REGISTRY AND NOT A SWITCH. The storefront used to resolve a record
// type's default template through a chain of `if (recordType === …) return …` in
// `starterCollectionDto` (apps/site), ending in `return null`. `cms.blog_post` was
// missing from that chain, and the failure was completely silent: null is a legal
// answer meaning "this type has no default", so posts simply fell through to the bare
// no-template fallback. A tenant wrote a good post and got a page that looked like a
// draft, and nothing anywhere said why.
//
// A map plus a declared list of the types the platform actually ROUTES turns that into
// something a test can check: `record-templates.test.ts` asserts the two agree, so
// adding a `/whatever/[id]` route without a default template fails the suite instead of
// shipping a bare page. The registry is the contract; the routes are the proof.

import type { Node } from '@wizeworks/silicaui-html';

import { blogPostPage } from './cms';
import { categoryDetailPage, collectionDetailPage, productDetailPage } from './commerce';
import { serviceDetailPage } from './scheduling';

/** Every record type the storefront has a per-record ROUTE for — the list each entry
 *  in `RECORD_TEMPLATES` must cover.
 *
 *  Keep in step with the `getPublishedSilicaCollection(...)` call sites under
 *  `apps/site/app`: today `products/[handle]`, `collections/[handle]`,
 *  `category/[handle]`, `book/[serviceId]`, `blog/[slug]`. A route with no entry here
 *  renders its records through the bare fallback — which is exactly the bug this file
 *  exists to make impossible to reintroduce quietly. */
export const ROUTED_RECORD_TYPES = [
  'commerce.product',
  'commerce.collection',
  'commerce.category',
  'scheduling.service',
  'cms.blog_post',
] as const;

export type RoutedRecordType = (typeof ROUTED_RECORD_TYPES)[number];

/** A record type → the code-authored template that renders one of its records. Each
 *  factory returns a FRESH, id-free tree.
 *
 *  THESE ARE SEEDED PAGES NOW, NOT A PERMANENT FALLBACK. This comment used to argue the
 *  opposite — that a stored tree freezes at publish, so seeding one would only ever help
 *  tenants created after it shipped, and serving the factory forever was therefore the
 *  better trade. That reasoning was sound while these pages were UNREACHABLE: a template
 *  had no address, so it never appeared in the page switcher and no tenant could open one.
 *  Trading away editability for improvability costs nothing when there is no editability.
 *
 *  Now that a record page carries a real address (`RECORD_ADDRESSES` below) it is an
 *  ordinary page, and it behaves like every other seeded page — Home, Shop, Cart, Search
 *  all materialize once and are then the tenant's, healed forward by `upgradePageBody`
 *  when the platform needs to fix something. The factory is still the source: it seeds a
 *  new site, backfills an existing one, and remains the storefront's fallback for a
 *  property whose row has not been written yet. */
export const RECORD_TEMPLATES: Record<RoutedRecordType, () => Node> = {
  'commerce.product': productDetailPage,
  'commerce.collection': collectionDetailPage,
  'commerce.category': categoryDetailPage,
  'scheduling.service': serviceDetailPage,
  'cms.blog_post': blogPostPage,
};

/**
 * What this page is CALLED, in the page switcher and in the storefront DTO.
 *
 * These were internal DTO labels — `Product detail`, `Collection`, `Category detail` —
 * written when nothing rendered them to a person. Giving record pages an address put them
 * in the page switcher, which made them the first thing a business owner reads when
 * deciding which page to open, and at that job the old set failed twice:
 *
 *   · `Collection` sat one letter from the `Collections` index page, in the same list. A
 *     salon owner picking between them is guessing, and half the time they guess wrong and
 *     edit the layout of the other one.
 *   · `detail` is developer vocabulary, and it was on three of the five — so the list read
 *     as if `Blog post` and `Collection` were a different KIND of thing, which they are not.
 *
 * `Each …` fixes both at once. It cannot be confused with an index page (`Shop`,
 * `Collections`, `Journal` are all plainly one page; `Each product` is plainly not), it is
 * the same shape across all five, and it states the actual contract in words nobody has to
 * learn: this ONE layout is what every product uses. Non-technical owners are the audience
 * for every string in this app, and "each" is a word they already own.
 */
export const RECORD_TEMPLATE_LABELS: Record<RoutedRecordType, string> = {
  'commerce.product': 'Each product',
  'commerce.collection': 'Each collection',
  'commerce.category': 'Each category',
  'scheduling.service': 'Each service',
  'cms.blog_post': 'Each blog post',
};

/**
 * Every name the PLATFORM has ever given a record page — and therefore the only names it
 * may take back.
 *
 * Renaming the labels above fixes the switcher for sites seeded after the change and for
 * nobody else, which is close to nobody: the confusing pair (`Collection` beside
 * `Collections`) is sitting in the switcher of every tenant that already has these pages.
 * Healing them is the difference between a fix and a note.
 *
 * But a rename on READ must never touch a name a PERSON chose. So the heal is gated on
 * this list: if the row still carries a name the platform wrote, the platform may correct
 * it; if it carries anything else — `Our products`, `Treatments` — someone made that
 * decision and it stands, confusing neighbour or not. "Rename only what we named" is the
 * whole rule, and it is why this list must never be pruned: an entry removed here is a
 * legacy name that silently becomes un-healable.
 *
 * The current labels are included, which is what makes the heal idempotent — a healed row
 * matches its target and plans no further change.
 */
export const PLATFORM_RECORD_PAGE_NAMES: ReadonlySet<string> = new Set([
  // The current set.
  ...Object.values(RECORD_TEMPLATE_LABELS),
  // The DTO-era labels these replaced (`recordTemplate().label`, and what
  // `ensureRecordPagesTx` wrote for every site it has already healed).
  'Product detail',
  'Collection',
  'Category detail',
  'Service detail',
  'Blog post',
  // `STARTER_PAGES` (@sparx/builder-schemas), the pre-silica seed for a fresh property.
  'Product page',
  'Blog post',
  // What sparx's own blueprints ship in `site.json` — 10 packs each carry a `Product`
  // and an `Article` record page. Missing these was not hypothetical: the dogfood tenant
  // healed four of its five pages and kept a blueprint-installed `Product`, which is the
  // single page a shop owner opens most.
  'Product',
  'Article',
  // `seed.ts`'s silica template seed passes its own, already covered above.
]);

/** Is this name one the platform wrote, and therefore one it may correct? A name a person
 *  chose is theirs — see {@link PLATFORM_RECORD_PAGE_NAMES}. */
export function isPlatformRecordPageName(name: string | null | undefined): boolean {
  return typeof name === 'string' && PLATFORM_RECORD_PAGE_NAMES.has(name.trim());
}

/** The default template for a record type, or null when the platform has none.
 *  Null stays a legal answer — an unknown type from a stale client must not throw —
 *  but the registry above plus its test is what keeps a ROUTED type from hitting it. */
export function recordTemplate(recordType: string): { label: string; root: Node } | null {
  const key = recordType as RoutedRecordType;
  const factory = RECORD_TEMPLATES[key];
  if (!factory) return null;
  return { label: RECORD_TEMPLATE_LABELS[key], root: factory() };
}

/* ── Addresses ──────────────────────────────────────────────────────────────── */

/**
 * Where a record type's detail page LIVES — the address of the page, not of a record.
 *
 * WHY THIS EXISTS. A page that renders one record used to be identified by
 * `BuilderPage.kind='collection'` + `recordType`, with no slug at all. That is a second
 * addressing system living beside slugs, and it cost more than it looks: the page
 * switcher is a list of ADDRESSED pages, so a page without one never appeared in it and
 * no tenant could ever open, edit or restyle their product page. Everything awkward
 * around the old scheme was compensation for the missing address — a `slug ?? recordType`
 * fallback serving a type name as an address, a preview that landed on the home page
 * because a template had nowhere to preview, a `pathPrefix` special case in the Pages
 * report because the row's `path` was not anywhere a visitor lands.
 *
 * A binding was never a classification. `product.title` on a node says "when something
 * called `product` is in scope, put its title here" — it never said "this page is a
 * product page", which is why one page can legitimately listen for a post, its related
 * posts and a promoted product at once, and why no single `recordType` could describe it.
 * The address is the fact; the bindings are the page's own business.
 *
 * A CLOSED SET, AND THAT IS THE LOAD-BEARING PART. These five strings are the only slugs
 * on the platform that may contain a `:`, they are authored here and nowhere else, and no
 * write path accepts one that is not in this list (`siteService.sync`). `:` is therefore
 * a reserved literal rather than a pattern language: every lookup anywhere stays an exact
 * string comparison, and nothing on the platform ever has to grow a route matcher. The
 * day that stops being true, every reader in §7 of the plan has to learn patterns at once.
 */
export interface RecordAddress {
  recordType: RoutedRecordType;
  /** Where visitors land, trailing slash included — `/products/`. The slash is
   *  load-bearing: consumers match with `startsWith`, and `/products` would also claim
   *  `/products-archive`. */
  prefix: string;
  /** The Next dynamic segment's name, verbatim from the route directory
   *  (`app/products/[handle]` → `handle`). `routes.test.ts` proves it against the real
   *  directories, which is what makes the address provable rather than asserted. */
  param: string;
  /** The literal `BuilderPage.slug`. Derived from `prefix` + `param` rather than written
   *  out, so the address and the route it names cannot drift apart. */
  slug: string;
  /** The module whose flag decides whether a site has this page at all. A CMS-only
   *  tenant gets no product page in their switcher, matching what `starterPages` already
   *  does for Shop and Cart. */
  module: 'commerce' | 'scheduling' | 'cms';
}

/** One row per routed record type. `slug` is computed, never authored. */
export const RECORD_ADDRESSES: readonly RecordAddress[] = (
  [
    { recordType: 'commerce.product', prefix: '/products/', param: 'handle', module: 'commerce' },
    {
      recordType: 'commerce.collection',
      prefix: '/collections/',
      param: 'handle',
      module: 'commerce',
    },
    { recordType: 'commerce.category', prefix: '/category/', param: 'handle', module: 'commerce' },
    { recordType: 'cms.blog_post', prefix: '/blog/', param: 'slug', module: 'cms' },
    {
      recordType: 'scheduling.service',
      prefix: '/book/',
      param: 'serviceId',
      module: 'scheduling',
    },
  ] as const satisfies readonly Omit<RecordAddress, 'slug'>[]
).map((a) => ({ ...a, slug: `${a.prefix}:${a.param}` }));

/** The closed set, as bare strings — for the tests and error messages that need to name
 *  every legal `:` slug at once. */
export const RECORD_ADDRESS_SLUGS: readonly string[] = RECORD_ADDRESSES.map((a) => a.slug);

/** Strip the leading slashes a stored slug may or may not carry. Slugs are written both
 *  ways depending on vintage (see `getPublishedPageBySlug`), so every comparison here
 *  goes through this rather than trusting one spelling. */
function bare(slug: string): string {
  return slug.replace(/^\/+/, '');
}

/** The address for a record type, or null for a type the platform does not route. */
export function recordAddressFor(recordType: string): RecordAddress | null {
  return RECORD_ADDRESSES.find((a) => a.recordType === recordType) ?? null;
}

/** The address a stored slug IS, or null. An EXACT match once leading slashes are
 *  stripped — `/products/brake-kit` is a visitor's path, not an address, and must not
 *  resolve here. */
export function recordAddressAt(slug: string | null | undefined): RecordAddress | null {
  if (!slug) return null;
  const target = bare(slug);
  return RECORD_ADDRESSES.find((a) => bare(a.slug) === target) ?? null;
}

/** Is this slug one of the five platform addresses? The predicate every consumer that
 *  must SKIP a record page asks — the sitemap, the SEO audit, the link roster. */
export function isRecordAddress(slug: string | null | undefined): boolean {
  return recordAddressAt(slug) !== null;
}

/** Where a record page's own Preview should go, since its address is not a URL a browser
 *  can fetch: the route's INDEX (`/products`, `/blog`). Opening the index is the honest
 *  answer for "show me this page" when the page needs a record the editor has not
 *  picked — a 404 on `/products/:handle` is not. */
export function recordIndexPath(address: RecordAddress): string {
  return address.prefix.replace(/\/+$/, '');
}

/**
 * Where Preview should actually open a record page: a REAL record when one is known,
 * the route index when none is.
 *
 * `samples` is `recordType → live storefront path`, resolved server-side against the
 * catalog under the storefront's own visibility rules (`recordSampleService`). It is
 * partial by nature — a tenant with no published post has nothing for `cms.blog_post` —
 * and a missing entry is NOT an error: the index is a real page listing the records this
 * template renders, and it is where Preview landed before samples existed.
 *
 * A sample is trusted only if it is a path UNDER this address's prefix. The map is
 * server-supplied and the check is cheap, but the failure it prevents is not: a stale or
 * mismatched entry would send an author previewing their product page to a blog post, and
 * they would read the wrong template as broken rather than the link as wrong.
 */
export function recordPreviewPath(
  address: RecordAddress,
  samples?: Readonly<Record<string, string>> | null
): string {
  const sample = samples?.[address.recordType];
  if (sample && sample.startsWith(address.prefix) && sample.length > address.prefix.length) {
    return sample;
  }
  return recordIndexPath(address);
}

/**
 * Every stored slug that could own `path`, in precedence order.
 *
 * THE ONE MATCHER. `getPublishedPageBySlug` and `findPageFrameId` must agree about which
 * page owns a path or a page renders its body from one row and its chrome from another —
 * the bug `findPageFrameId`'s comment has warned about since it was written. It used to
 * be enough for the two to query the same slug; now a visitor path like
 * `/products/brake-kit` is owned by the RECORD PAGE at `/products/:handle`, which no
 * literal slug match would ever find. So the mapping lives here once and both callers ask.
 *
 * A record address is only offered for `prefix` + EXACTLY ONE segment: `/products/a/b` is
 * not a product, and neither is `/products` (that is the index page, an ordinary page
 * with its own row and possibly its own frame).
 */
export function slugCandidatesForPath(path: string): string[] {
  const target = bare(path).replace(/\/+$/, '');
  if (target === '') return [];
  const candidates = [target, `/${target}`];

  // A path that IS an address spelled literally is not a location — answering it would
  // serve a template with nothing bound into it. The readers reject it too; not offering
  // it here keeps the two from disagreeing.
  if (isRecordAddress(target)) return candidates;

  const address = RECORD_ADDRESSES.find((a) => {
    const prefix = bare(a.prefix);
    if (!target.startsWith(prefix)) return false;
    const rest = target.slice(prefix.length);
    // Exactly one non-empty segment. `/products/a/b` is not a product, and `/products`
    // is the index page — an ordinary page with its own row and its own frame.
    return rest !== '' && !rest.includes('/');
  });
  if (address) candidates.push(bare(address.slug), address.slug);
  return candidates;
}
