// Farm Fresh generator — the Menu page: the shoppable storefront the header nav and
// every "Order Online" CTA point at (`/menu`). A branded intro, then ONE LIVE product
// grid (sections.ts `boundProductGrid`) bound to the whole catalog — every card reads a
// real product, its photo + title link to the PDP, and Add-to-cart sells the scoped
// product. The blueprint ships no catalog of its own (presentation-only), so the grid
// fills with the tenant's products (their own, or industry sample data) and is empty
// until then.

import { node, type BuilderNode } from '../_kit';
import { boundProductGrid } from '../sections';

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
      node('Section', {
        box: { name: 'Menu items', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          node('Heading', { cls: 'text-primary text-3xl', props: { level: 'h2', text: 'On the menu' } }),
          node('Text', {
            cls: 'text-base-content/70',
            props: {
              variant: 'body',
              text: 'Everything we make, blended to order from local ingredients.',
            },
          }),
          boundProductGrid(3),
        ],
      }),
    ],
  });
}
