// Tempo generator — reusable SECTION-level builders shared across the layout + pages: the
// uppercase Archivo section heading (with an optional right-aligned arrow-link), the
// campaign category tile, the colorway marquee tile, the tall editorial panel, the benefit
// cell, the footer link column, the secondary-page hero, and the LIVE shoppable product
// card + bound product grid. Each returns a BuilderNode and calls node()/el()/atom() when
// invoked, so the shared id counter only advances when manifest.ts assembles the trees.
// Class strings track docs/mockups/examples/adidas.html.

import { arrowLink, motionMark } from './media';
import { atom, bound, el, node, type BuilderNode } from './_kit';

// ── Section heading ──────────────────────────────────────────────────────────────────

/** The home/section heading — the design's single strongest voice carrier: bold Archivo,
 *  UPPERCASE, tight tracking. `light` recolors it for dark bands. */
export const sectionHead = (text: string, opts: { light?: boolean; cls?: string } = {}): BuilderNode =>
  el(
    'h2',
    `font-heading text-xl font-black uppercase tracking-tightest @2xl:text-2xl ${opts.light ? 'text-base-100' : 'text-base-content'} ${opts.cls ?? ''}`.trim(),
    { text }
  );

/** A section-heading ROW: the heading on the left, a "View All" arrow-link on the right
 *  (the mockup's "Shop Best Sellers … View All"). */
export const headRow = (text: string, linkLabel: string, href: string): BuilderNode =>
  el('div', 'flex w-full items-end justify-between gap-4', {
    children: [sectionHead(text), arrowLink(linkLabel, href, { cls: 'pb-0.5' })],
  });

// ── Campaign category tile ───────────────────────────────────────────────────────────
// A full-bleed gradient tile with the motion-mark floated top-right, an optional big
// product/sport glyph, and a white caption foot (title + sub + arrow-link). The whole
// tile links through. Used by "Shop the Season" + "Shop by Category".

export const categoryTile = (opts: {
  title: string;
  sub: string;
  href: string;
  gradientCls: string;
  glyph?: string;
  heightCls?: string;
}): BuilderNode =>
  el('article', `group relative flex flex-col justify-end overflow-hidden ${opts.heightCls ?? 'h-80'} ${opts.gradientCls}`, {
    children: [
      motionMark('text-xl', 'absolute right-4 top-4 text-base-100/90'),
      ...(opts.glyph
        ? [
            // Centered via a full-width flex row (avoids the fractional `left-1/2` /
            // `-translate-x-1/2` utilities surface-compile drops).
            el('div', 'pointer-events-none absolute inset-x-0 top-10 flex justify-center', {
              children: [
                el('span', 'text-7xl leading-none drop-shadow-xl transition-transform duration-500 group-hover:scale-110', {
                  text: opts.glyph,
                }),
              ],
            }),
          ]
        : []),
      el('div', 'relative bg-base-100 p-5', {
        children: [
          el('h3', 'font-heading text-lg font-black uppercase leading-tight tracking-tightest text-base-content', {
            text: opts.title,
          }),
          el('p', 'mt-1 text-xs text-base-content/60', { text: opts.sub }),
          arrowLink('Shop Now', opts.href, { cls: 'mt-3' }),
        ],
      }),
    ],
  });

// ── Colorway marquee tile (the "Find Your Team" scroller) ─────────────────────────────

/** One colorway tile in the team marquee — a tall gradient panel stamped with the
 *  motion-mark, with a white name foot. */
export const colorwayTile = (name: string, gradientCls: string): BuilderNode =>
  el('a', `group relative flex h-56 w-52 shrink-0 flex-col justify-end overflow-hidden ${gradientCls}`, {
    attrs: { href: '/shop' },
    children: [
      motionMark('text-lg', 'absolute right-3 top-3 text-base-100/90'),
      el('div', 'bg-base-100 px-3 py-2', {
        children: [el('span', 'font-heading text-sm font-black uppercase tracking-tight text-base-content', { text: name })],
      }),
    ],
  });

// ── Tall editorial panel (Men / Women / Kids) ────────────────────────────────────────

export const editorialPanel = (opts: {
  title: string;
  sub: string;
  cta: string;
  href: string;
  gradientCls: string;
}): BuilderNode =>
  el('article', `group relative flex min-h-[360px] flex-col justify-end overflow-hidden ${opts.gradientCls}`, {
    children: [
      el('div', 'pointer-events-none absolute right-6 top-8 h-40 w-28 bg-black/25 blur-[1px] transition-transform duration-500 group-hover:scale-105', {}),
      el('div', 'relative bg-base-100 p-5', {
        children: [
          el('h3', 'font-heading text-lg font-black uppercase tracking-tightest text-base-content', { text: opts.title }),
          el('p', 'mt-1 text-xs text-base-content/60', { text: opts.sub }),
          arrowLink(opts.cta, opts.href, { cls: 'mt-3' }),
        ],
      }),
    ],
  });

// ── Benefit cell (the 4-up hairline strip) ───────────────────────────────────────────

export const benefitCell = (title: string, sub: string): BuilderNode =>
  el('div', 'bg-base-100 p-6 text-center', {
    children: [
      el('p', 'font-heading text-sm font-bold uppercase tracking-tight text-base-content', { text: title }),
      el('p', 'mt-1 text-xs text-base-content/60', { text: sub }),
    ],
  });

// ── Footer link column ────────────────────────────────────────────────────────────────

export const footerCol = (title: string, links: Array<{ label: string; href: string }>): BuilderNode =>
  el('div', 'flex flex-col', {
    children: [
      el('h4', 'font-heading text-xs font-bold uppercase tracking-widest text-base-100/90', { text: title }),
      el('ul', 'mt-4 flex flex-col gap-2.5 text-sm text-base-100/70', {
        children: links.map((l) =>
          el('li', '', {
            children: [el('a', 'transition-colors hover:text-base-100 hover:underline', { text: l.label, attrs: { href: l.href } })],
          })
        ),
      }),
    ],
  });

// ── Secondary-page hero ────────────────────────────────────────────────────────────────

/** A consistent top for Shop / Club / Story / Help / News — a contained band with a small
 *  uppercase kicker, a big uppercase display headline, and a supporting blurb. */
export const pageHero = (kicker: string, title: string, blurb: string): BuilderNode =>
  node('Section', {
    box: { name: 'Page hero', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      el('p', 'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50', { text: kicker }),
      el('h1', 'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl', {
        text: title,
      }),
      el('p', 'max-w-2xl text-base leading-relaxed text-base-content/70', { text: blurb }),
    ],
  });

// ── Live shoppable product card + bound grid ─────────────────────────────────────────
// A real card bound to the repeated `item.*` product: the photo + title tap through to
// the product's PDP. Sharp corners (theme radius 0), a soft-gray image well, a decorative
// wishlist heart, the title in uppercase Archivo, and the PriceTag (renders the
// compare-at strike for sale styles). Shared by the home Best Sellers row + the Shop grid.

/** Wrap a node in a link to the scoped product's PDP. `/products/{{item.handle}}` is
 *  resolved per-product by the renderer (the repeater scopes `item`). */
const pdpLink = (cls: string, child: BuilderNode): BuilderNode => {
  const link = el('a', cls, { children: [child] });
  link.binding = { action: 'link', href: '/products/{{item.handle}}' };
  return link;
};

export const shopCard = (): BuilderNode =>
  el('article', 'group flex flex-col', {
    children: [
      el('div', 'relative overflow-hidden bg-base-200', {
        children: [
          el('button', 'absolute right-2 top-2 z-10 text-base-content/50 transition-colors hover:text-base-content', {
            attrs: { type: 'button', ariaLabel: 'Add to wishlist' },
            children: [atom('Icon', 'h-5 w-5', { name: 'heart' })],
          }),
          pdpLink(
            'block',
            bound(
              atom('Image', 'w-full transition-transform duration-500 group-hover:scale-105', { ratio: 'square', alt: 'Product' }),
              'item.images'
            )
          ),
        ],
      }),
      el('div', 'flex flex-1 flex-col pt-2', {
        children: [
          pdpLink(
            'block transition-colors hover:text-base-content/70',
            bound(
              atom('Heading', 'font-heading text-sm font-bold uppercase tracking-tight text-base-content', { level: 'h3', text: 'Product' }),
              'item.title'
            )
          ),
          bound(
            el('p', 'mt-0.5 line-clamp-1 text-xs text-base-content/55', { text: 'A Tempo essential.' }),
            'item.description'
          ),
          bound(atom('PriceTag', 'mt-1 text-sm font-bold text-base-content', {}), 'item.price'),
        ],
      }),
    ],
  });

/** A LIVE product grid bound to a category OR collection by HANDLE (the installer rewrites
 *  the handle → the real id at install). `limit` caps it for a teaser; omit for the full
 *  shop. `from` picks the source kind — `collection` (the home Best Sellers / New &
 *  Trending teasers) or `category` (the Shop page's per-category grids). */
export const boundProductGrid = (
  handle: string,
  cols: number,
  limit?: number,
  from: 'category' | 'collection' = 'collection'
): BuilderNode => {
  const grid = node('Section', {
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'grid', columns: cols, gap: 'md' },
    children: [shopCard()],
  });
  grid.binding = { source: { from, id: handle, ...(limit ? { limit } : {}) } };
  return grid;
};
