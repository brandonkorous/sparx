// Locks the commerce composites against the REAL silica engine: the data-binding
// structure (a `commerce.product` collection scope repeating scope-relative cards),
// the image-fill contract (a scalar `image` ref → `<img src>`), and the price/text
// binds — driven through `resolveTree` + `toHtml` so a mis-authored ref or class
// fails here, not in a live storefront.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope, type ResolveHost } from '@wizeworks/silicaui-html';

import {
  buyBox,
  collectionDetailPage,
  collectionHeader,
  featuredCarousel,
  featuredProducts,
  productCard,
  productDetailPage,
  productGrid,
  productsBlock,
} from './commerce';
import { COMMERCE_CATALOG } from './catalog';
import { HOST_KEYS } from './host-nodes';
import { renderSilicaBody } from './render';

/** The first host node in a tree carrying `component`. Used to assert not just that a
 *  core is present but HOW it was stamped — a pinned core and an unpinned one look
 *  identical in the rendered HTML and differ only in `locked`. */
function findHost(
  node: unknown,
  component: string
): { component?: string; locked?: string } | undefined {
  const n = node as { kind?: string; component?: string; locked?: string; children?: unknown[] };
  if (!n || typeof n !== 'object') return undefined;
  if (n.kind === 'host' && n.component === component) return n;
  for (const child of n.children ?? []) {
    const hit = findHost(child, component);
    if (hit) return hit;
  }
  return undefined;
}

// A trivial host mirroring what @sparx/builder-schemas' resolver does — short refs
// off the scoped item, `commerce.product`/`product` off fixed data — inline so this
// package carries no cross-dependency.
const PRODUCTS = [
  { image: '/aurora.png', title: 'Aurora Lamp', price: 149, url: '/products/aurora-lamp' },
  { image: '/dune.png', title: 'Dune Chair', price: 320, url: '/products/dune-chair' },
];
const PRODUCT = {
  image: '/solo.png',
  title: 'Solo Desk',
  price: 210,
  description: 'A tidy desk.',
  variantId: 'var_solo_default',
};
// A collection carrying its OWN products (the shape the storefront injects) — its
// `products` is a scope-relative field, resolved off the in-scope collection item.
const COLLECTION = {
  name: 'Lighting',
  description: 'Warm, sculptural light.',
  products: PRODUCTS,
};

const host: ResolveHost = {
  resolveBinding(ref: string, scope: DataScope) {
    const item = scope.item as Record<string, unknown> | undefined;
    return { value: item?.[ref] };
  },
  resolveCollection(ref: string, scope: DataScope) {
    if (ref === 'commerce.product') return PRODUCTS;
    if (ref === 'commerce.featured') return PRODUCTS; // bounded rail — host fills a slice
    if (ref === 'product') return [PRODUCT]; // object source → collection-of-one
    if (ref === 'collection') return [COLLECTION];
    // Scope-relative `products` — the collection's own list, off the in-scope item
    // (mirrors the sparx resolver's `item.products` re-rooting).
    if (ref === 'products') return (scope.item as { products?: unknown[] })?.products ?? [];
    return [];
  },
};

/** Every `value` ref carried anywhere in a subtree, in document order. */
function valueRefs(node: unknown, out: string[] = []): string[] {
  const n = node as { data?: { kind?: string; ref?: string }; children?: unknown[] };
  if (n?.data?.kind === 'value' && n.data.ref) out.push(n.data.ref);
  for (const c of n?.children ?? []) if (c && typeof c === 'object') valueRefs(c, out);
  return out;
}
/** The first descendant carrying a `collection` binding. */
function collectionRef(node: unknown): string | undefined {
  const n = node as { data?: { kind?: string; ref?: string }; children?: unknown[] };
  if (n?.data?.kind === 'collection') return n.data.ref;
  for (const c of n?.children ?? []) {
    if (c && typeof c === 'object') {
      const found = collectionRef(c);
      if (found) return found;
    }
  }
  return undefined;
}

describe('product_grid — data-bound product collection', () => {
  it('binds the grid as a collection over commerce.product', () => {
    expect(collectionRef(productGrid())).toBe('commerce.product');
  });

  it('the card binds scope-relative SHORT refs (image, title, price)', () => {
    const refs = valueRefs(productCard());
    expect(refs).toEqual(expect.arrayContaining(['image', 'title', 'price']));
    // never a dotted root path — these resolve against the product in scope
    expect(refs.every((r) => !r.includes('.'))).toBe(true);
  });

  it('resolves + renders one card per product through the real engine', () => {
    const html = toHtml(resolveTree(productGrid(), host));
    expect(html).toContain('Aurora Lamp');
    expect(html).toContain('Dune Chair');
    expect((html.match(/Lamp|Chair/g) ?? []).length).toBe(2);
  });

  it('fills the scalar image ref into an <img src> (not text)', () => {
    const html = toHtml(resolveTree(productGrid(), host));
    expect(html).toContain('src="/aurora.png"');
    expect(html).toContain('src="/dune.png"');
  });

  it('binds the raw price number (the host formats it, not the tree)', () => {
    const html = toHtml(resolveTree(productGrid(), host));
    expect(html).toContain('149');
    expect(html).toContain('320');
  });

  // A grid whose cards navigate nowhere is not a storefront. The card IS the
  // link: an <a> whose href is bound per-item through the attr-binding bridge.
  // Rendered via `renderSilicaBody` because that is the seam that hoists.
  it('renders each card as a link to ITS OWN product', () => {
    const html = renderSilicaBody(productGrid(), { host });
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
    expect(html).not.toContain('<input'); // the carrier never ships
  });
});

describe('featured_products — horizontal rail', () => {
  it('repeats the BOUNDED commerce.featured source (not the whole catalog) in a scroll row', () => {
    expect(collectionRef(featuredProducts())).toBe('commerce.featured');
    const html = toHtml(resolveTree(featuredProducts(), host));
    expect(html).toContain('overflow-x-auto');
    expect((html.match(/Lamp|Chair/g) ?? []).length).toBe(2);
  });
});

describe('products — the one configurable block', () => {
  it('defaults to a grid over the whole catalog', () => {
    const block = productsBlock();
    expect(collectionRef(block)).toBe('commerce.product');
    expect(toHtml(resolveTree(block, host))).toContain('grid-cols-2');
  });

  it('binds the chosen source and lays out as a rail', () => {
    const block = productsBlock({ source: 'commerce.featured', layout: 'rail', heading: 'Picks' });
    expect(collectionRef(block)).toBe('commerce.featured');
    const html = toHtml(resolveTree(block, host));
    expect(html).toContain('overflow-x-auto');
    expect(html).toContain('Picks');
  });

  it('accepts a parameterized category source', () => {
    expect(collectionRef(productsBlock({ source: 'commerce.category.studio-goods' }))).toBe(
      'commerce.category.studio-goods'
    );
  });

  it('presets (productGrid / featuredProducts) are just this block', () => {
    expect(collectionRef(productGrid())).toBe('commerce.product');
    expect(collectionRef(featuredProducts())).toBe('commerce.featured');
  });

  it('puts page links under a whole-catalog GRID, and never under a rail', () => {
    // The catalog grid is the one that runs out of room — it shows 24 and the shop has
    // more. A rail is a curation ("Featured", "New in"), and a Next button under a
    // curated strip is a curation that forgot it was one.
    const grid = toHtml(resolveTree(productGrid(), host));
    expect(grid).toContain(`data-sui-host="${HOST_KEYS.sitePagination}"`);

    const rail = toHtml(resolveTree(featuredProducts(), host));
    expect(rail).not.toContain(HOST_KEYS.sitePagination);

    // Nor under a category grid: those are a chosen slice, not the catalog.
    const category = toHtml(
      resolveTree(productsBlock({ source: 'commerce.category.studio-goods' }), host)
    );
    expect(category).not.toContain(HOST_KEYS.sitePagination);
  });

  it('leaves the pager UNLOCKED, so a tenant who wants no pager can delete it', () => {
    // Every other seeded core is `locked: "host"` because removing it would break a
    // transaction. This one is a convenience under a grid the tenant may later remove.
    const pager = findHost(productGrid(), HOST_KEYS.sitePagination);
    expect(pager).toBeTruthy();
    expect(pager?.locked).toBeUndefined();
  });
});

describe('buy_box — self-scoping product detail', () => {
  it('scopes itself to the product object source (collection-of-one)', () => {
    expect(collectionRef(buyBox())).toBe('product');
  });

  it('renders the pinned product once, with an inert add-to-cart action', () => {
    const tree = buyBox();
    // the action marker survives resolution (the engine never touches action nodes)
    const html = toHtml(resolveTree(tree, host));
    expect(html).toContain('Solo Desk');
    expect(html).toContain('A tidy desk.');
    expect(html).toContain('data-sui-action');
    expect(html).toContain('Add to cart');
    expect((html.match(/Solo Desk/g) ?? []).length).toBe(1);
  });

  // The add-to-cart contract, end to end through the real engine. Every one of
  // these was silently broken before silicaui 0.12: `fillValue` wrote a bound
  // value into an element's CHILDREN, and `input` is a void element, so `toHtml`
  // dropped it and the form submitted no variant at all.
  it("resolves the variant id into the hidden input's value attribute", () => {
    const html = toHtml(resolveTree(buyBox(), host));
    expect(html).toContain('name="variantId"');
    expect(html).toContain('value="var_solo_default"');
    // …and as an ATTRIBUTE, never as text content the browser would ignore.
    expect(html).not.toContain('>var_solo_default<');
  });

  it('marks the form as both a form behavior and the add-to-cart action', () => {
    const html = toHtml(resolveTree(buyBox(), host));
    // `hydrate()` wires the submit handler off data-sui-behavior; the ref that
    // reaches the host's onAction comes off data-sui-action. Both must be on the
    // <form>, or the button is decoration.
    expect(html).toMatch(/<form[^>]*data-sui-behavior="form"/);
    expect(html).toMatch(/<form[^>]*data-sui-action="add-to-cart"/);
    expect(html).toContain('type="submit"');
  });

  it('submits a quantity field defaulting to 1', () => {
    const html = toHtml(resolveTree(buyBox(), host));
    expect(html).toContain('name="quantity"');
    expect(html).toMatch(/name="quantity"[^>]*value="1"/);
    expect(html).toMatch(/name="quantity"[^>]*min="1"/);
  });

  it('resolves an empty value when the product has no live variant', () => {
    // defaultVariantId === null upstream → '' in scope. The markup still renders;
    // refusing the empty add is the storefront onAction handler's job (a hidden
    // input ignores `required`).
    const noVariant: ResolveHost = {
      ...host,
      resolveCollection: (ref) => (ref === 'product' ? [{ ...PRODUCT, variantId: '' }] : []),
    };
    const html = toHtml(resolveTree(buyBox(), noVariant));
    expect(html).toContain('name="variantId"');
    expect(html).toContain('value=""');
  });
});

describe('product_detail_page — the composed PDP body', () => {
  it('renders the buy box for the in-scope product AND the cross-sell rail', () => {
    // The storefront injects the routed product as the `product` object scope and
    // the catalog as `commerce.product`; the page composes both — the interactive
    // buy box (this product) above a rail (the catalog). Through the hoisting seam.
    const html = renderSilicaBody(productDetailPage(), { host });
    // buy box: the pinned product, once, with a live add-to-cart form.
    expect(html).toContain('Solo Desk');
    expect(html).toMatch(/<form[^>]*data-sui-action="add-to-cart"/);
    expect(html).toContain('value="var_solo_default"');
    // rail: the catalog products link to their own PDPs.
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
    expect(html).not.toContain('<input type="hidden" name="__sui-attr'); // carriers hoisted away
  });
});

describe('collection_detail_page — the pinned collection-detail core', () => {
  it('is an editable shell wrapping the pinned commerce.collection-detail core', () => {
    // The collection detail is now a FUNCTIONAL core (docs/127 §8) — header + a faceted,
    // sorted, paged grid of the collection's members, server-rendered on the storefront by
    // <CollectionDetail>, not a bind-based `products` repeat. The composite lowers to the
    // empty host mount point the storefront walk swaps for the real component, exactly like
    // the category detail (its browse-tree sibling).
    const html = renderSilicaBody(collectionDetailPage(), { host });
    expect(html).toContain('data-sui-host="commerce.collection-detail"');
    // No baked product markup — the core owns the grid, so nothing is stamped here.
    expect(html).not.toContain('Aurora Lamp');
  });
});

describe('collection_header — page header band', () => {
  it('binds title + description scope-relatively', () => {
    const refs = valueRefs(collectionHeader());
    expect(refs).toEqual(['title', 'description']);
  });
});

describe('COMMERCE_CATALOG — the palette group', () => {
  it('is one Products group whose items build fresh, distinct nodes', () => {
    expect(COMMERCE_CATALOG).toHaveLength(1);
    const group = COMMERCE_CATALOG[0]!;
    expect(group.key).toBe('commerce');
    expect(group.items.map((i) => i.key)).toEqual([
      'products',
      'product_carousel',
      'product_card',
      'buy_box',
      'collection_header',
    ]);
    // every factory returns a fresh tree (no shared node identity across inserts)
    const first = group.items[0]!;
    const a = first.make();
    const b = first.make();
    expect(a).not.toBe(b);
    expect(a.kind).toBe('element');
  });
});

describe('featured_carousel — a rail with real controls', () => {
  it('carries silica\u2019s carousel behavior on the section, so the runtime wires it', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    expect(html).toContain('data-sui-behavior="carousel"');
  });

  it('marks the track and every slide, which is what the behavior scrolls', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    expect(html).toContain('data-sui-part="track"');
    // The plugin's real class, not a hand-rolled flex+snap+overflow imitation of it —
    // it is also the only thing that hides the scrollbar under the prev/next controls.
    expect(html).toContain('class="carousel gap-6"');
    // One per product — the marker is on the repeat TEMPLATE, so it must survive
    // being stamped per item or the behavior sees a track with nothing in it.
    expect((html.match(/data-sui-part="slide"/g) ?? []).length).toBe(2);
  });

  it('ships Previous/Next as labelled controls, not bare arrows', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    expect(html).toContain('data-sui-part="prev"');
    expect(html).toContain('data-sui-part="next"');
    expect(html).toContain('aria-label="Previous products"');
    expect(html).toContain('aria-label="Next products"');
  });

  it('sizes slides by CONTAINER width so a phone gets one card, not a clipped four', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    expect(html).toContain('carousel-item');
    expect(html).toContain('basis-full');
    expect(html).toContain('@2xl:basis-1/3');
    expect(html).toContain('@4xl:basis-1/4');
  });

  it('stays bound to the BOUNDED source and still links each card to its product', () => {
    expect(collectionRef(featuredCarousel())).toBe('commerce.featured');
    const html = renderSilicaBody(featuredCarousel(), { host });
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
  });

  it('carries no pager — a carousel already has its own way forward', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    expect(html).not.toContain('site.pagination');
  });
});

describe('carousel controls — the empty-button trap', () => {
  // `atom('Button', …)` silently drops `aria-label` (a ComponentNode carries only
  // declared props, and Button declares none), which renders two empty circles: nothing
  // visible, nothing announced. Pinned because it type-checks, lints and looks fine in
  // review — it only fails for the person trying to use the site.
  it('every control has a visible glyph AND an announceable name', () => {
    const html = toHtml(resolveTree(featuredCarousel(), host));
    const buttons = html.match(/<button[^>]*>.*?<\/button>/g) ?? [];
    expect(buttons).toHaveLength(2);
    for (const b of buttons) {
      expect(b).toMatch(/aria-label="[^"]+"/);
      expect(b).toContain('<svg');
    }
  });
});
