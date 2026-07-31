// The commerce/domain composites silica's shipped block library doesn't cover.
//
// silica already ships every primitive + marketing block (navbar, hero, feature
// grid, pricing, FAQ, testimonials, footer, tabs, carousel, forms…) and the whole
// interactive behavior runtime, so sparx's `host.catalog()` only ADDS the
// commerce-domain composites here — merged over silica's defaults via
// `mergeCatalog`, never replacing them.
//
// AUTHORING CONTRACT (builder-contract §5):
//   · every factory returns a FRESH, id-free `Node` (the engine stamps ids on
//     insert), so a factory is called once per insert.
//   · every class is a LITERAL string, so the Tailwind `@source` harness safelists
//     the utilities a freshly-inserted node wears.
//   · data refs are SCOPE-RELATIVE short field keys (`title`, `price`, `image`) —
//     they resolve against the product in scope (a `commerce.product` repeat, a
//     `product` object scope, or an entity pin). The sparx resolver prefixes
//     `item.` when a scope is active; a top-level collection ref (`commerce.product`)
//     names the source directly. See @sparx/builder-schemas `silica-resolve`.
//   · `price` binds the raw number; the host resolver's `format` hook renders it as
//     currency — formatting is host territory, never baked into the tree.
//   · a bound image binds a SCALAR `image` ref (the product's primary-image URL);
//     silica's `fillValue` sets `<img src>` / an `Image` atom's `src` prop from a
//     string value (an array ref would fill text, not a src).
//   · a bound ATTRIBUTE (a card's `href`) uses `bindAttr(el, 'href', 'url')`, which
//     sets silica's native `{ kind:'value', ref, attr }`. Binding an `<a>` with a
//     plain `bind()` would replace its children with the URL string and destroy the
//     card. Until silicaui 0.36.0 this needed a hidden carrier input, because the
//     engine stopped resolving children once it filled an attribute binding; it
//     recurses now. See `attr-binding.ts`.

import {
  action,
  atom,
  behave,
  bind,
  el,
  part,
  repeat,
  type ElementNode,
  type Node,
} from '@wizeworks/silicaui-html';

import { bindAttr } from './attr-binding';
import { visibleWhen } from './conditional';
import { HOST_KEYS, functionalShell, hostCore } from './host-nodes';
import { PLACEHOLDER_IMAGE } from './placeholder';

// The unbound-image placeholder now lives in `placeholder.ts` — record templates in
// other modules (a blog post's featured image) need the same tile, and a second copy
// would drift.

/** The shared product card body — image, title, price. Used standalone (pin it to
 *  one product) and as the repeated item in `product_grid` / `featured_products`.
 *  `extraClass` lets a caller add layout affordances (a fixed width for the
 *  horizontal featured rail) without a second card definition.
 *
 *  The card IS the link: an `<a>` whose `href` is bound to the product's `url`
 *  through `bindAttr` (silica cannot bind an attribute natively — see
 *  `attr-binding.ts`). The whole tile is the hit target, which is what a shopper
 *  expects, and a product with no url degrades to a plain, un-clickable card. */
// Returns the concrete `ElementNode`, not the `Node` union: the card is an `<a>` and
// always will be, and `part()` (like every marker helper) needs a node that can CARRY a
// marker — the union includes `OutletNode`, which cannot. Widening here would force a
// cast at every marker call site for no gain.
function productCardNode(extraClass = ''): ElementNode {
  const base =
    'card bg-base-100 border border-base-300 rounded-box overflow-hidden block hover:border-primary';
  return bindAttr(
    el('a', extraClass ? `${base} ${extraClass}` : base, {
      children: [
        bind(
          atom('Image', 'aspect-square w-full object-cover', {
            src: PLACEHOLDER_IMAGE,
            alt: 'Product image',
          }),
          'image'
        ),
        // `gap-2`, not the half-step `gap-1.5`: the declared vocabulary has no half
        // steps, so `gap-1.5` compiles only while this file is @source-scanned and
        // emits nothing once the class is living in a tenant's stored tree.
        el('div', 'flex flex-col gap-2 p-4', {
          children: [
            bind(el('h3', 'font-semibold text-base-content', { text: 'Product name' }), 'title'),
            // INK, not the brand role. `text-primary` here was pale-on-pale on three
            // shipped themes — `petal` (1.6:1), `workshop` (2.0:1), `salon` (1.5:1) —
            // because those themes deliberately carry a BRIGHT primary that holds dark
            // ink ("a pale rose primary carrying DARK ink", says petal's own comment).
            // Primary is a FILL colour on them, and the price is the one number on this
            // card a shopper has to be able to read. Weight and scale carry the emphasis;
            // the card's brand identity rides its Add-to-cart button, which is a
            // `btn-primary` fill and therefore legible by construction.
            bind(el('p', 'text-lg font-bold text-base-content', { text: '$0.00' }), 'price'),
          ],
        }),
      ],
    }),
    'href',
    'url'
  );
}

/** A single product card — image, name, price. Bind it to one product (an entity
 *  pin) or let it inherit an ancestor product scope. This IS the reusable card the
 *  Products block repeats; select it in the editor and "Save as component" to fork a
 *  custom card, then swap it into the block. */
export function productCard(): Node {
  return productCardNode();
}

/** Which product source a Products block binds. `commerce.product` is the whole
 *  catalog (a shop-all grid); the rest are BOUNDED rails the storefront caps —
 *  featured (merchant-tagged), new (newest), related (same collection as the viewed
 *  product), or a specific category (`commerce.category.<collectionHandle>`). The
 *  editor's data-source picker repoints this per instance (docs/122). */
export type ProductsSource =
  | 'commerce.product'
  | 'commerce.featured'
  | 'commerce.new'
  | 'commerce.related'
  | `commerce.category.${string}`;

/** grid = a responsive multi-column grid (a shop/catalog page); rail = a horizontal
 *  snap-scrolling strip (a featured/cross-sell rail); carousel = that same strip with
 *  real Previous/Next controls and a per-view card width. grid and rail differ only in
 *  the repeat container's classes; carousel additionally carries silica's `carousel`
 *  behavior, so it is the one layout that is not purely a class swap. */
export type ProductsLayout = 'grid' | 'rail' | 'carousel';

export interface ProductsBlockOptions {
  source?: ProductsSource;
  layout?: ProductsLayout;
  heading?: string;
}

// Literal container trees per layout — the authoring contract (§5) requires every
// class to be a LITERAL string so the Tailwind `@source` harness safelists it; a
// computed/concatenated class string would ship un-generated utilities. So each
// layout is its own literal node rather than a templated class.
function gridContainer() {
  return el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4', {
    children: [productCardNode()],
  });
}
function railContainer() {
  return el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
    children: [productCardNode('w-64 shrink-0 snap-start')],
  });
}

/**
 * The carousel's TRACK — the repeat container, marked as silica's `track` part so the
 * `carousel` behavior knows what to scroll, with each card marked `slide`.
 *
 * HOW MANY ARE VISIBLE IS THIS, and nothing else. `limit` on the binding decides how
 * many records LOAD; the card's basis decides how many you can see at once, and the two
 * are deliberately different numbers — "4 at a time out of 12" is one repeat with
 * `limit: 12` and a quarter-width slide. silicaui's own schema note says the same thing,
 * which is reassuring given we asked for the field.
 *
 * The basis is a CONTAINER variant ladder — one card on a phone, three at `@2xl`, four
 * at `@4xl` — because a fixed `w-64` rail (the plain `rail` layout) shows the same card
 * size at every width and simply runs off the screen on a phone. Container, not viewport:
 * the block measures the column it was dropped into, so it works in a narrow sidebar as
 * well as full-bleed. That is also the only kind that reflows correctly on the canvas.
 *
 * With `gap-6` between quarter-width cards the fourth is clipped by the gaps rather than
 * landing flush. That is left alone on purpose: the sliver of a fifth card is the
 * affordance that says "there is more, scroll" — a carousel whose contents end exactly at
 * the edge looks like a grid that happens not to fit.
 */
function carouselTrack() {
  return part(
    // `carousel` / `carousel-item` are the PLUGIN'S OWN component classes, not utilities.
    // This started as `flex snap-x snap-mandatory overflow-x-auto scroll-smooth`, which is
    // `.carousel` re-implemented by hand — the exact thing RULE #1 exists to stop. The real
    // class also hides the scrollbar chrome (`scrollbar-width: none` + the webkit
    // pseudo-element), which no combination of sanctioned utilities can express, and which
    // a carousel needs: a raw scrollbar under a strip that already has Previous and Next is
    // two competing controls for one job. Touch and trackpad swipe still work — only the
    // chrome goes.
    //
    // `carousel-item` carries `flex-shrink: 0` + `scroll-snap-align: start`, so the slide
    // only needs its per-view WIDTH. `pb-4` is gone with the scrollbar it was reserving
    // room for.
    el('div', 'carousel gap-6', {
      children: [
        part(productCardNode('carousel-item basis-full @2xl:basis-1/3 @4xl:basis-1/4'), 'slide'),
      ],
    }),
    'track'
  );
}

/**
 * One carousel control — a raw `<button>` wearing the plugin's real `btn` classes, with
 * an `Icon` atom inside it.
 *
 * NOT `atom('Button', …)`, and the reason is worth stating because it looks like a
 * RULE #1 violation and isn't. A `ComponentNode` has no `attrs`: it carries only the
 * props its component declares, and `Button` declares no `aria-label`. Built that way
 * these render as `<button class="btn btn-circle"></button>` — two empty circles with
 * nothing inside and nothing for a screen reader to announce. A test below pins that,
 * because it is invisible in review and obvious to anyone using the site.
 *
 * The button is still a silica button: `btn btn-circle btn-sm btn-neutral btn-outline`
 * are the plugin's own emitted classes, so it wears the theme and responds to it. The
 * icon carries `aria-hidden` itself, so the label is the only thing announced.
 *
 * `type="button"` because a carousel can legitimately sit inside a form (a filtered
 * PLP), where the HTML default of `submit` would navigate away on the first Next click.
 */
function carouselControl(role: 'prev' | 'next', label: string, icon: 'arrow-left' | 'arrow-right') {
  return part(
    el('button', 'btn btn-circle btn-sm btn-neutral btn-outline', {
      attrs: { type: 'button', 'aria-label': label },
      children: [atom('Icon', 'size-4', { name: icon })],
    }),
    role
  );
}

/** THE configurable product listing — one block, prop-driven. It repeats the reusable
 *  product card over the chosen `source`, laid out as a `grid` or a `rail`. The editor
 *  surfaces `source` through the data-source picker (every option is registered in
 *  `COMMERCE_SOURCES`) and `layout` through the normal layout controls; `productGrid`
 *  and `featuredProducts` below are just this block with preset literal options, kept
 *  so existing pages and the starter/blueprints resolve unchanged. */
export function productsBlock(opts: ProductsBlockOptions = {}): Node {
  const { source = 'commerce.product', layout = 'grid', heading = 'Products' } = opts;

  // A carousel is a different SHAPE, not a different container class: the heading shares
  // a row with the controls, and the whole section carries the behavior. Handled first so
  // the grid/rail path below stays the simple thing it was.
  if (layout === 'carousel') {
    return behave(
      el('section', 'bg-base-100 @container px-6 py-12', {
        children: [
          // Controls sit BESIDE the heading rather than floating over the cards. Overlaying
          // them would need absolute positioning and a scrim to stay legible against
          // whatever product photo happens to be underneath — a shadow by another name, and
          // a control whose contrast depends on the tenant's imagery is one that will be
          // unreadable on someone's site. In the header row it is legible by construction.
          el('div', 'mb-8 flex items-center justify-between gap-6', {
            children: [
              el('h2', 'text-2xl font-semibold text-base-content', { text: heading }),
              el('div', 'flex gap-2', {
                children: [
                  carouselControl('prev', 'Previous products', 'arrow-left'),
                  carouselControl('next', 'Next products', 'arrow-right'),
                ],
              }),
            ],
          }),
          repeat(carouselTrack(), source),
        ],
      }),
      { type: 'carousel' }
    );
  }

  const children: Node[] = [
    el('h2', 'mb-8 text-2xl font-semibold text-base-content', { text: heading }),
    repeat(layout === 'rail' ? railContainer() : gridContainer(), source),
  ];
  // A GRID over the whole catalog gets page links under it, because that grid is the
  // one that runs out of room: it shows 24 records and the catalog has more. A RAIL is
  // a curation — "Featured", "New in" — and a Next button under a curated strip is a
  // curation that forgot it was one, so it gets nothing.
  //
  // Safe to include unconditionally on a grid: the core renders NOTHING unless the
  // route actually paginated something and there is more than one page. An author who
  // repoints this block at `commerce.featured` is left with an invisible node, not a
  // broken pager. And it has to be added HERE rather than retrofitted, because a
  // stamped tree freezes at publish (docs/122) — a block inserted today is the only
  // one this can ever reach.
  if (layout === 'grid' && source === 'commerce.product') {
    children.push(hostCore(HOST_KEYS.sitePagination, 'pt-4'));
  }
  return el('section', 'bg-base-100 @container px-6 py-12', { children });
}

/** A responsive grid over the whole catalog — the shop-all page. A preset of
 *  `productsBlock`. */
export function productGrid(): Node {
  return productsBlock({
    source: 'commerce.product',
    layout: 'grid',
    heading: 'Shop our products',
  });
}

/** A horizontal, snap-scrolling rail of FEATURED products — a preset of
 *  `productsBlock` bound to the BOUNDED `commerce.featured` source (merchant-tagged,
 *  capped to a handful, newest-few fallback, current product excluded on a PDP). A
 *  curated few, never the entire catalog. */
export function featuredProducts(): Node {
  return productsBlock({ source: 'commerce.featured', layout: 'rail', heading: 'Featured' });
}

/** A CAROUSEL of featured products — the same bounded source as `featuredProducts`, shown
 *  a few at a time with Previous/Next controls instead of a bare scroll strip. The
 *  separate preset exists because a rail and a carousel are different promises to a
 *  shopper: a rail says "swipe if you like", a carousel says "there is more, here is how
 *  to reach it". An author who wants a different count sets `limit` on the repeat in the
 *  editor — the block deliberately hard-codes neither. */
export function featuredCarousel(): Node {
  return productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Featured' });
}

/** The Add-to-cart FORM — the buy box's interactive half.
 *
 *  It is a real `<form>` because silica's `form` behavior is the ONLY thing that
 *  calls the host's `onAction`: on a valid submit it gathers the form's controls
 *  via FormData and dispatches `{kind:'submit', values}`. So the cart line's
 *  identity has to ride in actual form fields, not in the node tree.
 *
 *  Two markers, two jobs, both on the `<form>` itself:
 *    · `behave(…, {type:'form'})` → `data-sui-behavior="form"`, which is what
 *      `hydrate()` looks for when deciding to wire the submit handler.
 *    · `action(…, 'add-to-cart')` → `data-sui-action`, the opaque `ref` handed to
 *      `onAction` so the host knows WHICH action fired.
 *  They live in different node fields (`behavior` vs `data`), so one node carries both.
 *
 *  `variantId` is a bound hidden input: silica's `fillValue` writes a bound value
 *  into an `<input>`'s `value` attribute (silicaui ≥ 0.12 — before that it wrote
 *  children, which a void element drops, so the id vanished silently). It resolves
 *  to '' for a product with no live variant. No `required` guard here, because the
 *  attribute is inert on a hidden input and `checkValidity()` would pass anyway —
 *  the storefront's `onAction` is what refuses to add an empty variant. */
function addToCartForm(): Node {
  return action(
    behave(
      el('form', 'mt-2 flex flex-col gap-3', {
        children: [
          bind(el('input', '', { attrs: { type: 'hidden', name: 'variantId' } }), 'variantId'),
          // The quantity control nests INSIDE its label, so the pair needs no `id`
          // — a page with two buy boxes would otherwise emit a duplicate id.
          el('label', 'flex items-center gap-3 text-base text-base-content', {
            children: [
              el('span', 'font-medium', { text: 'Quantity' }),
              el('input', 'input w-24', {
                attrs: { type: 'number', name: 'quantity', value: '1', min: '1', step: '1' },
              }),
            ],
          }),
          atom('Button', 'btn btn-primary btn-lg', { type: 'submit' }, ['Add to cart']),
        ],
      }),
      { type: 'form' }
    ),
    'add-to-cart'
  );
}

/** The product-detail buy box — gallery, title, price (+ compare-at strikethrough),
 *  description, and an Add-to-cart form. Self-scoping: its root repeats over the
 *  `product` object source (a collection-of-one), so dropping it on any page and
 *  pinning the product scopes every descendant to `item.*`. */
export function buyBox(): Node {
  return repeat(
    // TWO elements, not one — and this is the trap the whole container-query
    // vocabulary has to get right. `@container` marks an element as a query container
    // for its DESCENDANTS; a `@2xl:` class on that SAME element resolves against the
    // nearest ANCESTOR container instead. The previous single div
    // (`grid gap-8 @2xl:grid-cols-2 @container`) therefore never measured itself: on
    // the PDP it happened to work, because `productDetailPage`'s section is a
    // container — but that section is full-bleed while the buy box is capped at
    // `max-w-6xl` inside it, so the split was keyed to the WINDOW width wearing a
    // container query's clothes. Drop the same block standalone into a page column and
    // it splits on the page's width, not its own. Splitting the div makes the box
    // measure the space it was actually given, which is the entire point.
    el('div', '@container', {
      children: [
        el('div', 'grid gap-8 @2xl:grid-cols-2', {
          children: [
            bind(
              atom('Image', 'aspect-square w-full rounded-box object-cover', {
                src: PLACEHOLDER_IMAGE,
                alt: 'Product image',
              }),
              'image'
            ),
            el('div', 'flex flex-col gap-4', {
              children: [
                bind(
                  el('h1', 'text-3xl font-bold text-base-content', { text: 'Product name' }),
                  'title'
                ),
                el('div', 'flex items-baseline gap-3', {
                  children: [
                    // Ink, not the brand role — same reason as the card price above, and
                    // the same three themes failed here too. This is the price a shopper
                    // commits money against.
                    bind(
                      el('span', 'text-2xl font-bold text-base-content', { text: '$0.00' }),
                      'price'
                    ),
                    // The was-price strikethrough, shown ONLY on an actual sale. It used
                    // to be a bare value bind, which meant a product with no
                    // `compareAtPrice` still rendered `<span class="line-through">` —
                    // empty, but a real flex item, so every non-sale product page carried
                    // a stray `gap-3` after the price. The wrapper is what carries the
                    // condition (one `data` per node), so the inner span still fills.
                    visibleWhen(
                      el('span', 'text-lg text-base-content line-through', {
                        children: [bind(el('span', '', { text: '' }), 'compareAtPrice')],
                      }),
                      'compareAtPrice'
                    ),
                  ],
                }),
                bind(
                  el('div', 'text-base-content', { text: 'Product description.' }),
                  'description'
                ),
                addToCartForm(),
              ],
            }),
          ],
        }),
      ],
    }),
    'product'
  );
}

/** The full product-detail PAGE body — the buy box above a "related" rail. This is
 *  the composed tree a `commerce.product` collection template renders: the storefront
 *  injects the routed product as the `product` object scope (a collection-of-one), so
 *  the buy box resolves `item.*` for THIS product while the rail below repeats the
 *  catalog's `commerce.product` source. Dropping it as a page needs no pinning — the
 *  page's record scope drives it. The container section gives the buy box page margins;
 *  `featuredProducts` (a `commerce.product` repeat) is the cross-sell strip. */
export function productDetailPage(): Node {
  return el('div', 'flex flex-col', {
    children: [
      // The buy box is capped at the same `max-w-6xl` reading width every other page
      // uses (shopHeader, the featured rail, the silica pages) and centered — without
      // this the PDP alone spanned full-bleed while the rest of the site stayed
      // contained, which read as a broken width.
      el('section', 'bg-base-100 @container px-6 py-12', {
        children: [el('div', 'mx-auto w-full max-w-6xl', { children: [buyBox()] })],
      }),
      featuredProducts(),
    ],
  });
}

/** The full collection-detail PAGE body (docs/122 + docs/127 §8) — the `commerce.collection`
 *  record template's default: an editable shell wrapping the PINNED `commerce.collection-detail`
 *  core. Like the category detail, the whole experience (header + a FACETED, sortable,
 *  paginated grid of the collection's members) is server-computed from the handle + search
 *  params, so it is one self-contained functional core the tenant surrounds/restyles but
 *  can't delete. This REPLACED a bind-based flat grid that could only ever show one
 *  truncated page with no filters — the core reuses the PLP's `ScopedProductBrowser`
 *  scoped to the collection, so a large collection is genuinely shoppable. No shell
 *  heading — the core renders its own header. The route mounts `<CollectionDetail>` at the
 *  host node with the collection handle. */
export function collectionDetailPage(): Node {
  return functionalShell(HOST_KEYS.commerceCollectionDetail);
}

/** The full category-detail PAGE body (docs/122) — the `commerce.category` record
 *  template's default: an editable shell wrapping the PINNED `commerce.category-detail`
 *  core. Unlike `collectionDetailPage` (a bind-based flat grid), a category is a browse
 *  TREE node whose header + subcategories + paginated product ROLLUP (self + descendants)
 *  is server-computed, so the whole experience is one self-contained functional core the
 *  tenant surrounds/restyles but can't delete. No shell heading — the core renders its own
 *  header. The route mounts `<CategoryDetail>` at the host node with the category handle. */
export function categoryDetailPage(): Node {
  return functionalShell(HOST_KEYS.commerceCategoryDetail);
}

/** A centered header band for a collection / category landing page. Binds its
 *  title + description scope-relatively against the collection record the page
 *  provides (no self-scope — the collection page owns the object scope). */
/** The SHOP page's header — a static heading, deliberately carrying no binds.
 *
 *  The starter's Shop page used `collectionHeader()`, which is a COLLECTION DETAIL
 *  header: its `title`/`description` binds resolve against the collection in scope. On
 *  `/shop` there is no collection in scope — it is a plain page, not a record template
 *  — so both binds silently kept their placeholders and every tenant's shop page, a
 *  primary nav destination, read:
 *
 *      Collection
 *      Collection description.
 *
 *  Nothing errored; it just shipped. A page that is not a record template must not
 *  carry record binds, which is why this one is plain text the tenant edits in the
 *  studio rather than a bind that can fail to nothing. */
export function shopHeader(): Node {
  return el('section', 'bg-base-100 @container px-6 pt-12 pb-4', {
    children: [
      el('div', 'mx-auto w-full max-w-6xl', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Shop',
          }),
          el('p', 'mt-4 max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Everything we currently have available.',
          }),
        ],
      }),
    ],
  });
}

export function collectionHeader(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 text-center', {
    children: [
      bind(el('h1', 'text-4xl font-bold text-base-content', { text: 'Collection' }), 'title'),
      bind(
        el('p', 'mx-auto mt-3 max-w-2xl text-lg text-base-content', {
          text: 'Collection description.',
        }),
        'description'
      ),
    ],
  });
}
