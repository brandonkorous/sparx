// Farm Fresh generator — the two collection templates: product detail (binds the
// commerce record) and blog post (binds the CMS record). These render per-record at
// runtime, so they bind tokens (`product.*` / `blog_post.*`) rather than literal copy.

import { node, type BuilderNode } from '../_kit';
import { boundProductGrid, valueCard } from '../sections';

/** A breadcrumb text-link: a Button given its OWN class (so the leaf wears it instead
 *  of the `st-btn` recipe) — a quiet inline link, not a chip. */
const crumb = (label: string, href: string): BuilderNode =>
  node('Button', {
    cls: 'text-sm text-base-content/60 transition-colors hover:text-accent',
    props: { label, href },
  });

/** A trust row beside the buy box: a food emoji + a short reassurance line. True for
 *  every made-to-order bowl, so it reads honestly on any product (the data model
 *  carries no per-product nutrition/claims to bind). */
const trustRow = (emoji: string, text: string): BuilderNode =>
  node('Stack', {
    box: { padding: 'none' },
    layout: { direction: 'row', gap: 'sm', alignItems: 'start' },
    children: [
      node('Text', { cls: 'text-xl leading-none', props: { variant: 'body', text: emoji } }),
      node('Text', { cls: 'text-sm leading-relaxed text-base-content/80', props: { variant: 'body', text } }),
    ],
  });

export function productTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Product', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Breadcrumb — Home · Menu · this product (the last is bound per-record).
      node('Section', {
        box: { name: 'Breadcrumb', padding: 'md', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'row', gap: 'sm', alignItems: 'center', wrap: true },
        children: [
          crumb('Home', '/'),
          node('Text', { cls: 'text-base-content/30', props: { variant: 'body', text: '/' } }),
          crumb('Menu', '/menu'),
          node('Text', { cls: 'text-base-content/30', props: { variant: 'body', text: '/' } }),
          node('Text', { cls: 'text-sm text-base-content/60', bind: 'product.title' }),
        ],
      }),
      // Main — photo beside the title / description / buy box / trust points.
      node('Section', {
        box: { name: 'Product detail', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 2, gap: 'xl', alignItems: 'start' },
        children: [
          node('Image', {
            cls: 'w-full rounded-box shadow-lg',
            bind: 'product.images',
            props: { ratio: 'square', alt: 'Bowl' },
          }),
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
            children: [
              node('Badge', {
                cls: 'st-badge st-c-primary st-v-soft st-badge--sz-md',
                props: { label: 'Made to order' },
              }),
              node('Heading', { props: { level: 'h1', size: 'display' }, bind: 'product.title' }),
              node('Prose', { cls: 'text-base-content/80', bind: 'product.description' }),
              node('BuyBox', { bind: 'product' }),
              node('Divider', { cls: 'w-full border-base-300' }),
              node('Stack', {
                box: { padding: 'none' },
                layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
                children: [
                  trustRow('🌿', 'Local, wholesome ingredients — nothing artificial, ever.'),
                  trustRow('🥣', 'Blended to order, never sitting in storage.'),
                  trustRow('🚲', 'Free local delivery on orders over $35.'),
                ],
              }),
            ],
          }),
        ],
      }),
      // Benefits strip — the brand promise, consistent with the home values row.
      node('Section', {
        box: { name: 'Why bowls', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 3, gap: 'lg' },
        children: [
          valueCard('🌾', 'Locally Sourced', 'From farms within 60 miles'),
          valueCard('⚖️', 'Balanced Macros', 'Portioned by nutritionists'),
          valueCard('♻️', 'Eco Packaging', '100% compostable bowls'),
        ],
      }),
      // Cross-sell — a LIVE grid bound to the curated "Fan Favorites" collection, so
      // every product page recommends a varied handful (photos + Add-to-cart all live).
      node('Section', {
        box: { name: 'You might also like', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg', alignItems: 'start' },
        children: [
          node('Heading', { cls: 'text-primary text-3xl', props: { level: 'h2', text: 'You might also like' } }),
          node('Text', {
            cls: 'text-base-content/70',
            props: { variant: 'body', text: 'More fresh favorites our regulars order on repeat.' },
          }),
          boundProductGrid('fan-favorites', 4, 4, 'collection'),
        ],
      }),
    ],
  });
}

export function postTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Post', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: { name: 'Post header', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        // The in-scope CMS record is bound under `blog_post.*` (the type key) — the same
        // root apps/site `postToBuilderRecord` and the entry-editor preview both inject.
        children: [
          node('Text', { box: { align: 'center' }, cls: 'text-primary text-sm font-medium', bind: 'blog_post.date' }),
          node('Heading', { box: { align: 'center' }, props: { level: 'h1' }, bind: 'blog_post.title' }),
        ],
      }),
      node('Section', {
        box: { name: 'Post body', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          node('Image', {
            cls: 'w-full rounded-box',
            bind: 'blog_post.featuredImage',
            props: { ratio: 'wide', alt: 'Cover' },
          }),
          node('Prose', { bind: 'blog_post.body' }),
        ],
      }),
    ],
  });
}
