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
  featuredProducts,
  productCard,
  productDetailPage,
  productGrid,
} from './commerce';
import { COMMERCE_CATALOG } from './catalog';
import { renderSilicaBody } from './render';

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
  it('repeats the same product source in a scroll row', () => {
    expect(collectionRef(featuredProducts())).toBe('commerce.product');
    const html = toHtml(resolveTree(featuredProducts(), host));
    expect(html).toContain('overflow-x-auto');
    expect((html.match(/Lamp|Chair/g) ?? []).length).toBe(2);
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

describe('collection_detail_page — header + the collection’s own products', () => {
  it('renders the collection name/description AND a card per product IN the collection', () => {
    const html = renderSilicaBody(collectionDetailPage(), { host });
    expect(html).toContain('Lighting'); // the collection name (scope-relative to the collection)
    expect(html).toContain('Warm, sculptural light.'); // its description
    // the collection's OWN products (a scope-relative `products` repeat, NOT the catalog)
    expect(html).toContain('Aurora Lamp');
    expect(html).toContain('Dune Chair');
    expect((html.match(/Lamp|Chair/g) ?? []).length).toBe(2);
    // each card links to its product's PDP
    expect(html).toContain('href="/products/aurora-lamp"');
    expect(html).toContain('href="/products/dune-chair"');
    expect(html).not.toContain('<input type="hidden" name="__sui-attr'); // carriers hoisted away
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
      'product_grid',
      'featured_products',
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
