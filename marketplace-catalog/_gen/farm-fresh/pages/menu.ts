// Farm Fresh generator — the Menu page: the shoppable storefront the header nav and
// every "Order Online" CTA point at (`/menu`). A branded intro, then one section per
// menu group, each a LIVE product grid (sections.ts `boundProductGrid`) bound to that
// category — every card reads a real product, its photo + title link to the PDP, and
// Add-to-cart sells the scoped product. Adding a product in commerce shows up here.

import { node, type BuilderNode } from '../_kit';
import { boundProductGrid } from '../sections';

/** One labeled category section: a leaf subhead + caption over a LIVE product grid
 *  bound to `category:<handle>`. `cols` tunes the grid density per group. */
const categorySection = (
  title: string,
  caption: string,
  handle: string,
  cols: number
): BuilderNode =>
  node('Section', {
    box: { name: title, padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      node('Heading', { cls: 'text-primary text-3xl', props: { level: 'h2', text: title } }),
      node('Text', { cls: 'text-base-content/70', props: { variant: 'body', text: caption } }),
      boundProductGrid(handle, cols),
    ],
  });

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
