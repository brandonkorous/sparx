// Locks the commerce composites against the REAL silica engine: the data-binding
// structure (a `commerce.product` collection scope repeating scope-relative cards),
// the image-fill contract (a scalar `image` ref → `<img src>`), and the price/text
// binds — driven through `resolveTree` + `toHtml` so a mis-authored ref or class
// fails here, not in a live storefront.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope, type ResolveHost } from '@wizeworks/silicaui-html';

import { buyBox, collectionHeader, featuredProducts, productCard, productGrid } from './commerce';
import { COMMERCE_CATALOG } from './catalog';

// A trivial host mirroring what @sparx/builder-schemas' resolver does — short refs
// off the scoped item, `commerce.product`/`product` off fixed data — inline so this
// package carries no cross-dependency.
const PRODUCTS = [
  { image: '/aurora.png', title: 'Aurora Lamp', price: 149 },
  { image: '/dune.png', title: 'Dune Chair', price: 320 },
];
const PRODUCT = { image: '/solo.png', title: 'Solo Desk', price: 210, description: 'A tidy desk.' };

const host: ResolveHost = {
  resolveBinding(ref: string, scope: DataScope) {
    const item = scope.item as Record<string, unknown> | undefined;
    return { value: item?.[ref] };
  },
  resolveCollection(ref: string) {
    if (ref === 'commerce.product') return PRODUCTS;
    if (ref === 'product') return [PRODUCT]; // object source → collection-of-one
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
