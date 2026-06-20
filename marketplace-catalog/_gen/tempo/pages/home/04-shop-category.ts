// Tempo home · 04 Shop by Category — a contained band: a heading over a 4-up of taller
// category tiles (Originals / Running / Soccer / Lifestyle), each linking to the catalog.
// Tracks the mockup's "Shop by Category" 4-up.

import { GRAD } from '../../media';
import { categoryTile, sectionHead } from '../../sections';
import { el, node, type BuilderNode } from '../../_kit';

export function shopCategory(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop by Category', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      sectionHead('Shop by Category'),
      el('div', 'grid w-full grid-cols-2 gap-3 @4xl:grid-cols-4', {
        children: [
          categoryTile({ title: 'Originals', sub: 'Heritage icons', href: '/shop', gradientCls: GRAD.ink, glyph: '👟', heightCls: 'h-72 @2xl:h-96' }),
          categoryTile({ title: 'Running', sub: 'Engineered to move', href: '/shop', gradientCls: GRAD.sky, glyph: '🏃', heightCls: 'h-72 @2xl:h-96' }),
          categoryTile({ title: 'Soccer', sub: 'Built for the pitch', href: '/shop', gradientCls: GRAD.pitch, glyph: '⚽', heightCls: 'h-72 @2xl:h-96' }),
          categoryTile({ title: 'Lifestyle', sub: 'Terrace style', href: '/shop', gradientCls: GRAD.sunset, glyph: '🧥', heightCls: 'h-72 @2xl:h-96' }),
        ],
      }),
    ],
  });
}
