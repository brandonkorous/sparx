// Shared PRODUCT-DETAIL construction kit for the ten reference-driven template
// blueprints (docs/templates/*). Phase 3 — the FULL-SITE pass. A store lives on its
// product page, so "closest clone allowed" means each template ships its OWN bespoke
// PDP, not the generic platform buy box every bundle fell back to before.
//
// WHAT THIS KIT IS. The PDP's LAYOUT is where a brand shows itself — a gallery-left
// serif column, a dark cinematic split, a blush-panel beauty counter — so each
// template AUTHORS that layout in its own generator. What it must NOT re-derive is the
// fiddly, easy-to-get-wrong DATA plumbing: a product page is a `commerce.product`
// collection template whose body repeats over the routed product (a collection-of-one)
// and binds SCOPE-RELATIVE short keys (`title`, `price`, `image`, `description`,
// `compareAtPrice`) that resolve to `item.*`. Get the scope or a key wrong and the page
// silently renders placeholders. So this kit owns the binds + the `repeat('product')`
// scoping + the add-to-cart form, and each template composes them into its own shell.
//
// This mirrors `packages/silica-catalog/src/commerce.ts` `buyBox()` / `productDetailPage()`
// — the same binds, the same `repeat('product')`, the same `visibleWhen(compareAtPrice)`
// sale guard, the same exported `addToCartForm()` — so a bespoke PDP is guaranteed to
// resolve exactly like the starter's, only dressed in the template's own layout.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules);
// the primitives come through the silica-catalog package's own copy so the nodes minted
// here and the nodes the catalog factories mint are the same module instance.

import {
  atom,
  bind,
  el,
  repeat,
  type Node,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { bindAttr } from '../../../packages/silica-catalog/src/attr-binding';
import { visibleWhen } from '../../../packages/silica-catalog/src/conditional';
import {
  addToCartForm,
  productsBlock,
  type ProductsSource,
} from '../../../packages/silica-catalog/src/commerce';
import { PLACEHOLDER_IMAGE } from '../../../packages/silica-catalog/src/placeholder';

// ── Bound field primitives ────────────────────────────────────────────────────
//
// Each returns ONE bound node the routed product fills. `className` is the whole
// visual decision, so a template controls aspect, scale, weight and colour while the
// bind stays correct. Every key here is what `buyBox()` binds, verified against the
// resolver — do not invent field keys (an unknown key resolves to nothing, silently).

/** The product's primary image, bound to `image`. `PLACEHOLDER_IMAGE` shows only on the
 *  empty studio canvas — the storefront overwrites `src` the moment it resolves.
 *
 *  `className` must be NAMED utilities only — an arbitrary value like `aspect-[4/5]` compiles
 *  only while this file is @source-scanned and emits NOTHING once the class is living in a
 *  tenant's stored tree (the site-lint sweep flags it `class-no-css`). Use `aspect-square` /
 *  `aspect-video`, not an arbitrary ratio; the same rule the whole catalog follows. */
export function pdpImage(className: string, alt = 'Product image'): Node {
  return bind(atom('Image', className, { src: PLACEHOLDER_IMAGE, alt }), 'image');
}

/** The product title, bound to `title`. The PDP heading is the page's ONE `<h1>` — pass
 *  `tag: 'h1'` on the main title and `h2`/`h3` for any secondary echo. */
export function pdpTitle(tag: 'h1' | 'h2' | 'h3', className: string): Node {
  return bind(el(tag, className, { text: 'Product name' }), 'title');
}

/**
 * The price row — the live price and, ONLY on an actual sale, a struck-through was-price
 * beside it. The compare-at is wrapped in `visibleWhen('compareAtPrice')` so a full-price
 * product renders no empty strike span (the trap `buyBox` documents: a bare bind still
 * emits the element as a real flex item, leaving a stray gap after every non-sale price).
 *
 * INK, never the brand role, on the number a shopper commits money against — the same
 * lesson `buyBox`/`productCard` carry: a bright primary is a FILL colour on several
 * themes and goes pale-on-pale as text. The template picks scale/weight through the
 * class args; legibility is not negotiable, so the colour is fixed to ink here.
 */
export function pdpPriceRow(opts: {
  priceClass: string;
  compareClass: string;
  rowClass?: string;
}): Node {
  return el('div', opts.rowClass ?? 'flex items-baseline gap-3', {
    children: [
      bind(el('span', opts.priceClass, { text: '$0.00' }), 'price'),
      visibleWhen(
        el('span', opts.compareClass, {
          children: [bind(el('span', '', { text: '' }), 'compareAtPrice')],
        }),
        'compareAtPrice'
      ),
    ],
  });
}

/** The product description, bound to `description`. */
export function pdpDescription(className: string): Node {
  return bind(el('div', className, { text: 'Product description.' }), 'description');
}

/** The add-to-cart form — quantity + Add-to-cart, the buy box's interactive half. Re-exported
 *  from `commerce.ts` so a bespoke PDP carries the SAME real `<form>` behaviour marker the
 *  storefront's `onAction` cart handler listens for; a hand-rolled form would not fire it. */
export { addToCartForm };

/** A bound "details" row — a labelled line of product copy where the value binds to a field
 *  key. Only `description` is a guaranteed scalar today; reserved for templates that want a
 *  second bound line, it defaults to the description so it is always safe. */
export function pdpBoundLine(className: string, key = 'description'): Node {
  return bind(el('p', className, { text: '' }), key);
}

// ── Page assembly ─────────────────────────────────────────────────────────────

/**
 * Assemble a full product-detail PAGE body from a template's authored buy REGION.
 *
 * `buyRegion` is the template's whole bespoke buy box — its gallery + title + price +
 * description + `addToCartForm()` laid out however the brand wants. This wraps it in
 * `repeat(_, 'product')` so the routed product becomes the `item.*` scope every bound
 * primitive inside resolves against (a collection-of-one, exactly like `buyBox`). Author
 * the region UNSCOPED — the scope is applied here, once, so a template never has to
 * remember to wrap it (forgetting is the failure mode: unscoped binds render placeholders).
 *
 * `related` is an optional cross-sell section BELOW the buy region, OUTSIDE the product
 * scope so it binds the catalog source it names. Defaults to a "You may also like"
 * carousel of `commerce.related` (same-collection products, current one excluded) — the
 * natural PDP cross-sell. Pass your own `productsBlock({...})` to retitle or repoint it,
 * or `null` for no rail.
 */
export function productPage(
  buyRegion: Node,
  opts: { related?: Node | null; relatedHeading?: string; relatedSource?: ProductsSource } = {}
): Node {
  const related =
    opts.related === null
      ? null
      : (opts.related ??
        productsBlock({
          source: opts.relatedSource ?? 'commerce.related',
          layout: 'carousel',
          heading: opts.relatedHeading ?? 'You may also like',
        }));
  return el('div', 'flex flex-col', {
    children: [repeat(buyRegion, 'product'), ...(related ? [related] : [])],
  });
}

/** A bound whole-tile product LINK — image over title + price, the card `<a>` whose `href`
 *  binds to the product `url`. A template that wants its OWN product-card look inside a
 *  bespoke grid (rather than the catalog's `productsBlock` card) composes from this. The
 *  classes are the whole visual decision; the binds + the `href` carrier stay correct. */
export function pdpProductCardLink(opts: {
  cardClass: string;
  imageClass: string;
  bodyClass: string;
  titleClass: string;
  priceClass: string;
}): Node {
  return bindAttr(
    el('a', opts.cardClass, {
      children: [
        pdpImage(opts.imageClass),
        el('div', opts.bodyClass, {
          children: [
            bind(el('h3', opts.titleClass, { text: 'Product name' }), 'title'),
            bind(el('p', opts.priceClass, { text: '$0.00' }), 'price'),
          ],
        }),
      ],
    }),
    'href',
    'url'
  );
}
