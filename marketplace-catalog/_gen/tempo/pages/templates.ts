// Tempo generator — the two collection templates: product detail (binds the commerce
// record) and article (binds the CMS record). These render per-record at runtime, so they
// bind tokens (`product.*` / `blog_post.*`) rather than literal copy. Styled in the stark
// Tempo voice (uppercase Archivo, sharp). The PDP's BuyBox reads the product's Size option
// + variants and wires the live add-to-cart.

import { arrowLink } from '../media';
import { boundProductGrid } from '../sections';
import { atom, bound, el, node, type BuilderNode } from '../_kit';

const crumb = (label: string, href: string): BuilderNode =>
  el('a', 'text-sm text-base-content/60 transition-colors hover:text-base-content', { text: label, attrs: { href } });

const sep = (): BuilderNode => el('span', 'text-base-content/30', { text: '/' });

/** A short reassurance row beside the buy box (true for any product — the data model
 *  carries no per-product claims to bind). */
const trustRow = (emoji: string, text: string): BuilderNode =>
  el('div', 'flex items-start gap-3', {
    children: [
      el('span', 'text-xl leading-none', { text: emoji }),
      el('span', 'text-sm leading-relaxed text-base-content/80', { text }),
    ],
  });

export function productTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Product', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Breadcrumb — Home · Shop · this product (the last bound per-record).
      node('Section', {
        box: { name: 'Breadcrumb', padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'sm', alignItems: 'center', wrap: true },
        children: [crumb('Home', '/'), sep(), crumb('Shop', '/shop'), sep(), bound(el('span', 'text-sm text-base-content/60', { text: 'Product' }), 'product.title')],
      }),
      // Main — photo beside title / description / buy box / trust points.
      node('Section', {
        box: { name: 'Product detail', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 2, gap: 'xl', alignItems: 'start' },
        children: [
          bound(atom('Image', 'w-full bg-base-200', { ratio: 'square', alt: 'Product' }), 'product.images'),
          el('div', 'flex flex-col gap-7', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  bound(
                    atom('Heading', 'font-heading text-3xl font-black uppercase leading-tight tracking-tightest text-base-content @3xl:text-4xl', { level: 'h1' }),
                    'product.title'
                  ),
                  bound(atom('Prose', 'text-base leading-relaxed text-base-content/70', {}), 'product.description'),
                ],
              }),
              // BuyBox reads the product's Size option + variants and wires add-to-cart.
              bound(atom('BuyBox', '', {}), 'product'),
              atom('Divider', 'w-full border-base-300', {}),
              el('div', 'flex flex-col gap-3', {
                children: [
                  trustRow('🚚', 'Free shipping for Club members, always.'),
                  trustRow('↩️', 'Free returns within 30 days — no questions asked.'),
                  trustRow('»', 'Engineered to move, built to last.'),
                ],
              }),
            ],
          }),
        ],
      }),
      // Cross-sell — a LIVE grid bound to New & Trending so every PDP recommends a varied
      // handful (photos + PDP links all live).
      node('Section', {
        box: { name: 'You might also like', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          el('div', 'flex w-full items-end justify-between gap-4', {
            children: [
              el('h2', 'font-heading text-xl font-black uppercase tracking-tightest text-base-content @2xl:text-2xl', { text: 'You Might Also Like' }),
              arrowLink('View All', '/shop'),
            ],
          }),
          boundProductGrid('new-arrivals', 4, 4, 'collection'),
        ],
      }),
    ],
  });
}

export function articleTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Article', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Article header', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        // The in-scope CMS record is bound under `blog_post.*` (the type key).
        children: [
          bound(el('p', 'font-heading text-xs font-bold uppercase tracking-[0.2em] text-base-content/50', { text: 'News' }), 'blog_post.date'),
          bound(
            atom('Heading', 'font-heading max-w-3xl text-3xl font-black uppercase leading-[0.95] tracking-tightest text-base-content @2xl:text-5xl', { level: 'h1' }),
            'blog_post.title'
          ),
        ],
      }),
      node('Section', {
        box: { name: 'Article body', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          bound(atom('Image', 'w-full bg-base-200', { ratio: 'wide', alt: 'Cover' }), 'blog_post.featuredImage'),
          bound(atom('Prose', '', {}), 'blog_post.body'),
        ],
      }),
    ],
  });
}
