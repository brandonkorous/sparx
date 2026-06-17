// Commerce composites (docs/103, Tier 1a) — the catalog half that finally USES the
// binding spine (docs/98 Pillar 7) to SELL. Every other catalog file composes
// static structure; these three carry a real buy-box: a node pinned to a product
// (or repeated over a collection) whose descendants read `item.*` and whose button
// adds the right variant to the cart.
//
// The reusable contract (CONTRACT.md "Binding the spine"): a template NEVER bakes a
// concrete product id. It is authored inert-but-rich — `item.*` bindings + believable
// placeholder copy — and gets its product scope two ways: the tenant PINS the root to
// a product (Data panel → "A record"), or it sits inside a `repeat()` that scopes each
// item. An `act(_, 'add-to-cart')` button resolves the product in that scope; with none
// (an unpinned standalone), it renders inert — the correct "pin me first" state.

import { el, atom, bound, act, repeat, entry, type PlatformCatalogEntry } from './_kit';

// ── Shared card body ────────────────────────────────────────────────────────────
//
// The shoppable card subtree, reused by `product_card` (the root is the tenant's pin
// target) and as the per-item template inside `product_grid` (the repeater scopes it).
// `cid()` re-ids every call, so two uses never collide. Image binds the product's
// `images` array (the renderer's firstImage picks one); price is a real PriceTag (a
// number, formatted at the render boundary); the button is a live add-to-cart trigger.
function shoppableCard(): PlatformCatalogEntry['tree'] {
  return el(
    'article',
    'flex h-full w-full flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm transition-shadow hover:shadow-md',
    {
      name: 'Product card',
      children: [
        bound(atom('Image', 'w-full', { ratio: 'square', alt: 'Product photo' }), 'item.images'),
        el('div', 'flex flex-1 flex-col gap-2 p-5', {
          children: [
            bound(
              atom('Heading', 'text-base font-semibold text-base-content', {
                level: 'h3',
                text: 'Stoneware pour-over mug',
              }),
              'item.title'
            ),
            bound(
              atom('Text', 'text-sm text-base-content/70', {
                variant: 'body',
                text: 'Hand-glazed and microwave-safe — built for a slow morning.',
              }),
              'item.description'
            ),
            el('div', 'mt-auto flex items-center justify-between gap-3 pt-2', {
              children: [
                bound(
                  atom('PriceTag', 'text-lg font-semibold text-base-content', {}),
                  'item.price'
                ),
                act(
                  atom('Button', 'st-btn st-c-primary st-v-solid st-btn--sz-sm', {
                    label: 'Add to cart',
                  }),
                  'add-to-cart'
                ),
              ],
            }),
          ],
        }),
      ],
    }
  );
}

// ── Entries ─────────────────────────────────────────────────────────────────────

export const COMMERCE_CATALOG: PlatformCatalogEntry[] = [
  // ── Product card — a single shoppable card the tenant pins to a product ────────
  entry({
    key: 'product_card',
    name: 'Product card',
    category: 'commerce',
    kind: 'comprehensive',
    icon: 'shopping-bag',
    description:
      'A shoppable card — photo, title, price, and a working Add to cart. Pin it to a product (Data panel → A record) and everything inside reads that product.',
    surfaces: ['page', 'site'],
    tags: ['product', 'card', 'shop', 'buy', 'add to cart', 'commerce', 'store'],
    tree: shoppableCard(),
  }),

  // ── Product grid — a repeater over the catalog, one shoppable card per product ─
  entry({
    key: 'product_grid',
    name: 'Product grid',
    category: 'commerce',
    kind: 'comprehensive',
    icon: 'layout-grid',
    description:
      'A responsive grid that repeats a shoppable card once per product. Points at the whole catalog by default — re-point it to a collection or category in the Data panel.',
    surfaces: ['page', 'site'],
    tags: ['products', 'grid', 'collection', 'catalog', 'shop', 'repeater', 'commerce'],
    tree: el('section', 'w-full px-4 py-12', {
      name: 'Product grid',
      children: [
        el('div', 'mx-auto max-w-6xl', {
          children: [
            atom(
              'Heading',
              'mb-8 text-center text-3xl font-bold tracking-tight text-base-content',
              {
                level: 'h2',
                text: 'Shop the collection',
              }
            ),
            repeat(
              el('div', 'grid grid-cols-1 gap-6 @xl:grid-cols-2 @4xl:grid-cols-3', {
                name: 'Products',
                children: [shoppableCard()],
              }),
              { from: 'all', limit: 6 }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Featured product — a single product spotlight with a full buy-box ──────────
  entry({
    key: 'product_spotlight',
    name: 'Featured product',
    category: 'commerce',
    kind: 'comprehensive',
    icon: 'sparkles',
    description:
      'A two-column hero for one product — a large image beside its title, story, and a complete buy-box (price, variants, quantity, add to cart). Pin it to the product to feature.',
    surfaces: ['page', 'site'],
    tags: ['product', 'featured', 'spotlight', 'hero', 'buy box', 'pdp', 'commerce'],
    tree: el('section', 'w-full px-4 py-16', {
      name: 'Featured product',
      children: [
        el('div', 'mx-auto grid max-w-6xl grid-cols-1 gap-10 @3xl:grid-cols-2 @3xl:items-center', {
          children: [
            bound(
              atom('Image', 'w-full rounded-box', { ratio: 'square', alt: 'Featured product' }),
              'item.images'
            ),
            el('div', 'flex flex-col gap-5', {
              name: 'Product detail',
              children: [
                bound(
                  atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
                    level: 'h2',
                    text: 'The everyday leather tote',
                  }),
                  'item.title'
                ),
                bound(
                  atom('Text', 'text-base leading-relaxed text-base-content/70', {
                    variant: 'body',
                    text: 'Full-grain leather that softens with use, a laptop sleeve inside, and a footprint sized for the daily carry. Made to be the only bag you reach for.',
                  }),
                  'item.description'
                ),
                bound(atom('BuyBox', ''), 'item'),
              ],
            }),
          ],
        }),
      ],
    }),
  }),
];
