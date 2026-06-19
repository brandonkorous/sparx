// Farm Fresh generator — the Menu page: the shoppable storefront the header nav and
// every "Order Online" CTA point at (`/menu`). A branded intro, then one section per
// menu group, each a LIVE product grid BOUND to that category — the repeater scopes
// every card to a real product, so the photo/title/price/Add-to-cart read live data.
//
// Categories are authored by HANDLE (`acai-bowls`); the blueprint installer rewrites
// each `source.id` to the real category id at install (resolveBindingHandles), so the
// grid loads exactly that category's products. Adding a product in commerce shows up
// here automatically — this is the real shop, not the home page's static teaser.

import { node, type BuilderNode } from '../_kit';
import { CARD_CLS } from '../theme';

/** A live shoppable card bound to the repeated `item.*` product: real photo, title,
 *  berry price, and a working Add-to-cart (the action resolves the card's scoped
 *  product). Wears the brand card shell + hover-lift, matching the home menu cards. */
const shopCard = (): BuilderNode => {
  const addToCart = node('Button', {
    cls: 'st-btn st-c-accent st-v-solid st-btn--sz-sm whitespace-nowrap',
    props: { label: 'Add' },
  });
  addToCart.binding = { action: 'add-to-cart' };
  return node('Card', {
    cls: `overflow-hidden ${CARD_CLS}`,
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Image', { bind: 'item.images', cls: 'w-full', props: { ratio: 'square', alt: 'Bowl' } }),
      node('Stack', {
        cls: 'flex-1',
        box: { padding: 'md' },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
        children: [
          node('Heading', { cls: 'text-xl', props: { level: 'h3', text: 'Bowl' }, bind: 'item.title' }),
          node('Text', {
            cls: 'text-sm leading-relaxed text-base-content/70',
            props: { variant: 'body', text: 'A fresh, balanced bowl.' },
            bind: 'item.description',
          }),
          node('Stack', {
            cls: 'mt-auto w-full',
            box: { padding: 'none' },
            layout: { direction: 'row', justify: 'between', alignItems: 'center', gap: 'sm' },
            children: [
              node('PriceTag', { cls: 'text-accent font-extrabold text-lg', bind: 'item.price' }),
              addToCart,
            ],
          }),
        ],
      }),
    ],
  });
};

/** One labeled category section: a leaf subhead + caption over a LIVE product grid
 *  bound to `category:<handle>`. `cols` tunes the grid density per group. */
const categorySection = (
  title: string,
  caption: string,
  handle: string,
  cols: number
): BuilderNode => {
  const grid = node('Section', {
    box: { padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'grid', columns: cols, gap: 'lg' },
    children: [shopCard()],
  });
  grid.binding = { source: { from: 'category', id: handle } };
  return node('Section', {
    box: { name: title, padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      node('Heading', { cls: 'text-primary text-3xl', props: { level: 'h2', text: title } }),
      node('Text', { cls: 'text-base-content/70', props: { variant: 'body', text: caption } }),
      grid,
    ],
  });
};

export function menuTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Menu', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Menu intro',
          surface: 'subtle',
          padding: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', size: 'display', text: 'The menu' } }),
          node('Text', {
            box: { align: 'center' },
            cls: 'max-w-xl',
            props: {
              variant: 'body',
              text: 'Blended-to-order açaí bowls, cold-pressed smoothies, and hearty grain bowls — built fresh from local ingredients. Order for pickup or free local delivery.',
            },
          }),
        ],
      }),
      categorySection(
        'Açaí & Smoothie Bowls',
        'Blended to order and piled with fruit, granola, and seeds.',
        'acai-bowls',
        3
      ),
      categorySection(
        'Cold-Pressed Smoothies',
        'Fresh-pressed and never from concentrate.',
        'smoothies',
        4
      ),
      categorySection(
        'Salads & Grain Bowls',
        'Hearty, balanced, and made to fuel your day.',
        'salads-grains',
        3
      ),
    ],
  });
}
