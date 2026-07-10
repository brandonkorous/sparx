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
//   · a bound ATTRIBUTE (a card's `href`) uses `bindAttr(el, 'href', 'url')` —
//     silica's `resolveTree` stops resolving a node's children once it fills an
//     attribute binding, so the value rides a hidden carrier input that
//     `hoistAttrBindings` lifts + removes before `toHtml`. See `attr-binding.ts`.
//     Binding an `<a>` with a plain `bind()` would replace its children with the
//     URL string and destroy the card.

import { action, atom, behave, bind, el, repeat, type Node } from '@wizeworks/silicaui-html';

import { bindAttr } from './attr-binding';

// A neutral, self-contained placeholder tile (inline SVG data-URI) — the Image's
// default `src` so the UNBOUND state (a card just inserted, not yet pinned to a
// product) shows a clean "image goes here" tile instead of the browser's
// broken-image glyph. silica's `fillValue` overwrites this `src` with the
// product's real primary-image URL the moment the node resolves against data, so
// it never ships to a live, bound storefront.
const PLACEHOLDER_IMAGE =
  "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='400' height='400'>" +
  "<rect width='400' height='400' fill='%23e5e7eb'/>" +
  "<circle cx='150' cy='150' r='36' fill='%23cbd5e1'/>" +
  "<path d='M70 300l86-104 62 74 58-70 74 100z' fill='%23cbd5e1'/></svg>";

/** The shared product card body — image, title, price. Used standalone (pin it to
 *  one product) and as the repeated item in `product_grid` / `featured_products`.
 *  `extraClass` lets a caller add layout affordances (a fixed width for the
 *  horizontal featured rail) without a second card definition.
 *
 *  The card IS the link: an `<a>` whose `href` is bound to the product's `url`
 *  through `bindAttr` (silica cannot bind an attribute natively — see
 *  `attr-binding.ts`). The whole tile is the hit target, which is what a shopper
 *  expects, and a product with no url degrades to a plain, un-clickable card. */
function productCardNode(extraClass = ''): Node {
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
        el('div', 'flex flex-col gap-1.5 p-4', {
          children: [
            bind(el('h3', 'font-semibold text-base-content', { text: 'Product name' }), 'title'),
            bind(el('p', 'text-lg font-bold text-primary', { text: '$0.00' }), 'price'),
          ],
        }),
      ],
    }),
    'href',
    'url'
  );
}

/** A single product card — image, name, price. Bind it to one product (an entity
 *  pin) or let it inherit an ancestor product scope. */
export function productCard(): Node {
  return productCardNode();
}

/** A responsive grid that repeats over the tenant's product catalog. The grid
 *  container carries the `commerce.product` collection binding; each product scopes
 *  one card. */
export function productGrid(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12', {
    children: [
      el('h2', 'mb-8 text-2xl font-semibold text-base-content', { text: 'Shop our products' }),
      repeat(
        el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4', {
          children: [productCardNode()],
        }),
        'commerce.product'
      ),
    ],
  });
}

/** A horizontal, snap-scrolling rail of products — the "featured" merchandising
 *  strip. Same product source, laid out as a scroll row instead of a grid. */
export function featuredProducts(): Node {
  return el('section', 'bg-base-200 @container px-6 py-12', {
    children: [
      el('h2', 'mb-8 text-2xl font-semibold text-base-content', { text: 'Featured' }),
      repeat(
        el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
          children: [productCardNode('w-64 shrink-0 snap-start')],
        }),
        'commerce.product'
      ),
    ],
  });
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
    el('div', 'grid gap-8 @2xl:grid-cols-2 @container', {
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
                bind(el('span', 'text-2xl font-bold text-primary', { text: '$0.00' }), 'price'),
                bind(
                  el('span', 'text-lg text-base-content/50 line-through', { text: '' }),
                  'compareAtPrice'
                ),
              ],
            }),
            bind(
              el('div', 'text-base-content/80', { text: 'Product description.' }),
              'description'
            ),
            addToCartForm(),
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
      el('section', 'bg-base-100 @container px-6 py-12', { children: [buyBox()] }),
      featuredProducts(),
    ],
  });
}

/** The full collection-detail PAGE body — a header (the collection's name +
 *  description) above a grid of the collection's OWN products. Self-scoping: the
 *  root repeats over the injected `collection` object (a collection-of-one), so the
 *  header binds `name`/`description` scope-relative to the collection, and the grid's
 *  inner repeat walks the collection's `products` list (a scope-relative field the
 *  storefront pre-fetches onto the record) — each card then scopes to its product and
 *  links to that product's PDP. No whole-catalog `commerce.product` source is bound,
 *  so only THIS collection's products render. */
export function collectionDetailPage(): Node {
  return repeat(
    el('div', 'flex flex-col', {
      children: [
        el('section', 'bg-base-100 px-6 py-12 text-center', {
          children: [
            bind(el('h1', 'text-4xl font-bold text-base-content', { text: 'Collection' }), 'name'),
            bind(
              el('p', 'mx-auto mt-3 max-w-2xl text-lg text-base-content/70', {
                text: 'Collection description.',
              }),
              'description'
            ),
          ],
        }),
        el('section', 'bg-base-100 @container px-6 pb-12', {
          children: [
            repeat(
              el('div', 'grid grid-cols-2 gap-6 @2xl:grid-cols-3 @4xl:grid-cols-4', {
                children: [productCardNode()],
              }),
              'products'
            ),
          ],
        }),
      ],
    }),
    'collection'
  );
}

/** A centered header band for a collection / category landing page. Binds its
 *  title + description scope-relatively against the collection record the page
 *  provides (no self-scope — the collection page owns the object scope). */
export function collectionHeader(): Node {
  return el('section', 'bg-base-100 px-6 py-12 text-center', {
    children: [
      bind(el('h1', 'text-4xl font-bold text-base-content', { text: 'Collection' }), 'title'),
      bind(
        el('p', 'mx-auto mt-3 max-w-2xl text-lg text-base-content/70', {
          text: 'Collection description.',
        }),
        'description'
      ),
    ],
  });
}
