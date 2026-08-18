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
              atom('Text', 'text-sm text-base-content', {
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
                  atom('Button', 'btn btn-primary btn-sm', {
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

// One line item in the cart summary — thumbnail, name + quantity, line price.
function cartLine(name: string, qty: string, price: string): PlatformCatalogEntry['tree'] {
  return el('div', 'flex items-center gap-3', {
    children: [
      atom('Image', 'h-14 w-14 shrink-0 rounded-field', { ratio: 'square', alt: name }),
      el('div', 'flex flex-1 flex-col', {
        children: [
          el('span', 'text-sm font-medium text-base-content', { text: name }),
          el('span', 'text-xs text-base-content', { text: `Qty ${qty}` }),
        ],
      }),
      el('span', 'text-sm font-semibold text-base-content', { text: price }),
    ],
  });
}

// One collection pill in the horizontal nav — a link styled as a filter chip.
function collectionPill(label: string, href: string, active = false): PlatformCatalogEntry['tree'] {
  const tone = active
    ? 'border-primary bg-primary text-primary-content'
    : 'border-base-200 text-base-content hover:border-base-300 hover:bg-base-200';
  return el('a', `rounded-full border px-4 py-1.5 text-sm font-medium transition-colors ${tone}`, {
    text: label,
    attrs: { href },
  });
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
                  atom('Text', 'text-base leading-relaxed text-base-content', {
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

  // ── Related products — a cross-sell strip that repeats shoppable cards ─────────
  entry({
    key: 'related_products',
    name: 'Related products',
    category: 'commerce',
    kind: 'comprehensive',
    icon: 'shopping-bag',
    description:
      'A “You may also like” strip — a repeating row of shoppable cards. Points at the catalog by default; re-point it to a collection in the Data panel.',
    surfaces: ['page', 'site'],
    tags: ['related', 'cross-sell', 'recommended', 'you may also like', 'products', 'commerce'],
    tree: el('section', 'w-full px-4 py-12', {
      name: 'Related products',
      children: [
        el('div', 'mx-auto max-w-6xl', {
          children: [
            atom('Heading', 'mb-6 text-2xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'You may also like',
            }),
            repeat(
              el('div', 'grid grid-cols-2 gap-4 @2xl:grid-cols-4', {
                name: 'Products',
                children: [shoppableCard()],
              }),
              { from: 'all', limit: 4 }
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Cart summary — a mini-cart panel (line items + subtotal + checkout) ────────
  entry({
    key: 'mini_cart',
    name: 'Cart summary',
    category: 'commerce',
    kind: 'comprehensive',
    icon: 'shopping-cart',
    description:
      'A mini-cart panel — line items with thumbnails, a subtotal, and a checkout button. Drop it in a drawer or sidebar; wire the items to the live cart.',
    surfaces: ['page', 'site'],
    tags: ['cart', 'mini cart', 'basket', 'checkout', 'drawer', 'commerce'],
    tree: el(
      'aside',
      'flex w-full max-w-sm flex-col gap-4 rounded-box border border-base-200 bg-base-100 p-5',
      {
        name: 'Cart summary',
        attrs: { ariaLabel: 'Your cart' },
        children: [
          atom('Heading', 'text-lg font-semibold text-base-content', {
            level: 'h3',
            text: 'Your cart',
          }),
          el('div', 'flex flex-col gap-4', {
            name: 'Line items',
            children: [
              cartLine('Stoneware pour-over mug', '2', '$76.00'),
              cartLine('Linen tea towel set', '1', '$28.00'),
              cartLine('Cast-iron trivet', '1', '$34.00'),
            ],
          }),
          el('div', 'flex items-center justify-between border-t border-base-200 pt-4', {
            children: [
              el('span', 'text-sm text-base-content', { text: 'Subtotal' }),
              el('span', 'text-lg font-semibold text-base-content', { text: '$138.00' }),
            ],
          }),
          act(
            atom('Button', 'btn btn-primary btn-md w-full', {
              label: 'Checkout',
            }),
            'link',
            '/checkout'
          ),
        ],
      }
    ),
  }),

  // ── Collection nav — a horizontal row of collection filter pills ──────────────
  entry({
    key: 'collection_nav',
    name: 'Collection nav',
    category: 'commerce',
    kind: 'common',
    icon: 'list-filter',
    description:
      'A horizontal row of collection links styled as filter pills — point each at a collection page and mark the current one active.',
    surfaces: ['page', 'site'],
    tags: ['collections', 'categories', 'filter', 'pills', 'nav', 'shop', 'commerce'],
    tree: el('nav', 'w-full px-4 py-4', {
      name: 'Collection nav',
      attrs: { ariaLabel: 'Collections' },
      children: [
        el('div', 'mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-2', {
          children: [
            collectionPill('All', '/products', true),
            collectionPill('New arrivals', '/collections/new'),
            collectionPill('Best sellers', '/collections/best-sellers'),
            collectionPill('Sale', '/collections/sale'),
            collectionPill('Gifts', '/collections/gifts'),
          ],
        }),
      ],
    }),
  }),
];
