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
// This mirrors `wizeworks/packages/silica-catalog/src/commerce.ts` `buyBox()` / `productDetailPage()`
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
} from '../../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { bindAttr } from '../../../wizeworks/packages/silica-catalog/src/attr-binding';
import { visibleWhen } from '../../../wizeworks/packages/silica-catalog/src/conditional';
import {
    addToCartForm,
    productsBlock,
    type ProductsSource,
} from '../../../wizeworks/packages/silica-catalog/src/commerce';
import { PLACEHOLDER_IMAGE } from '../../../wizeworks/packages/silica-catalog/src/placeholder';

// ── Bound field primitives ────────────────────────────────────────────────────
//
// Each returns ONE bound node the routed product fills. `className` is the whole
// visual decision, so a template controls aspect, scale, weight and color while the
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
 * lesson `buyBox`/`productCard` carry: a bright primary is a FILL color on several
 * themes and goes pale-on-pale as text. The template picks scale/weight through the
 * class args; legibility is not negotiable, so the color is fixed to ink here.
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

// ── Typed attributes (docs/143) ─────────────────────────────────────────────────
//
// THE FIX for the hardcoded PDP. Every template used to bake per-product copy — a cap's
// "Fabric & construction", a jacket's "Care" — as STATIC strings, byte-identical on every
// product. There was no per-product field to bind to. Now a product carries a typed
// `attributeSections` list (its product type's fields, filled per product), and this kit
// repeats over it: one labeled section per attribute, resolved from the routed product.
// No field keys are named here — a template renders whatever its products' TYPE defines,
// which is the whole point (a cap's care ≠ a jacket's care ≠ coffee's origin).

/**
 * The product's typed attribute sections — the labeled detail blocks that replaced the
 * hardcoded `pdpDetail(label, body)` stack. Repeats over the routed product's
 * `attributeSections` (ordered by the type's field order):
 *
 *   - a SCALAR attribute (fabric, care, origin, size…) renders its `value` text.
 *   - a REPEATER attribute (materials, specs, nutrition…) renders a sub-repeat of
 *     `items` — one `label / value` row each — since its section `value` is empty.
 *
 * `visibleWhen('value')` hides the scalar block for a repeater section, and the whole
 * block is `visibleWhen('attributeSections')` so an untyped product (no sections) renders
 * NOTHING — a clean empty state, never an empty heading. Classes are the whole visual
 * decision; the binds stay correct.
 */
export function pdpAttributes(opts: {
    containerClass?: string;
    sectionClass?: string;
    labelTag?: 'h2' | 'h3' | 'h4';
    labelClass: string;
    valueClass: string;
    rowsClass?: string;
    rowClass?: string;
    rowLabelClass?: string;
    rowValueClass?: string;
}): Node {
    const section = el('div', opts.sectionClass ?? 'flex flex-col gap-2', {
        children: [
            bind(el(opts.labelTag ?? 'h3', opts.labelClass, { text: 'Section' }), 'label'),
            // Scalar value — dropped for a repeater section (its `value` is '').
            visibleWhen(bind(el('div', opts.valueClass, { text: '' }), 'value'), 'value'),
            // Repeater rows — an empty list for a scalar section, so this renders nothing there.
            repeat(
                el('div', opts.rowClass ?? 'flex items-baseline justify-between gap-4', {
                    children: [
                        bind(el('span', opts.rowLabelClass ?? '', { text: '' }), 'label'),
                        bind(el('span', opts.rowValueClass ?? '', { text: '' }), 'value'),
                    ],
                }),
                'items'
            ),
        ],
    });
    return visibleWhen(
        el('div', opts.containerClass ?? 'flex flex-col gap-6', {
            children: [repeat(section, 'attributeSections')],
        }),
        'attributeSections'
    );
}

/**
 * The shipping/returns trust line — LINKS to the site's real legal pages instead of
 * reprinting a policy the template can't possibly know. `/shipping-policy` and
 * `/returns-policy` are the canonical legal slugs (@wizeworks/legal-templates `LegalKind`
 * shipping / returns). No fabricated copy: a policy is authored once, in the legal page,
 * and every PDP points at it.
 */
export function pdpPolicyLinks(opts: {
    className?: string;
    linkClass?: string;
    shippingLabel?: string;
    returnsLabel?: string;
}): Node {
    return el('div', opts.className ?? 'flex flex-wrap items-center gap-x-6 gap-y-2 text-sm', {
        children: [
            el('a', opts.linkClass ?? 'underline underline-offset-4', {
                text: opts.shippingLabel ?? 'Shipping & delivery',
                attrs: { href: '/shipping-policy' },
            }),
            el('a', opts.linkClass ?? 'underline underline-offset-4', {
                text: opts.returnsLabel ?? 'Returns & refunds',
                attrs: { href: '/returns-policy' },
            }),
        ],
    });
}

/**
 * A real low-stock badge — bound to the product's inventory, shown ONLY when stock is
 * genuinely at/below its reorder point (`visibleWhen('lowStock')`). This replaced the
 * fabricated "Selling fast" block + fake countdown that some templates invented: scarcity
 * that isn't real is a lie to the shopper. When stock is healthy it renders nothing.
 * The label is static ("Low stock") — an honest signal, not a bound number, so it never
 * leaks exact inventory. Classes carry the whole look (a Badge atom or a styled span).
 */
export function pdpStockBadge(opts: { className?: string; label?: string }): Node {
    return visibleWhen(
        el('span', opts.className ?? 'inline-flex items-center gap-2 text-sm font-medium', {
            text: opts.label ?? 'Low stock',
        }),
        'lowStock'
    );
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
