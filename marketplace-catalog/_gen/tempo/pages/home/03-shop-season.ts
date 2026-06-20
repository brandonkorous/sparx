// Tempo home · 03 Shop the Season — a contained band: a heading over a 4-up grid of
// campaign category tiles (gradient + motion-mark + glyph + white caption foot). Tracks
// the mockup's "Shop the World Cup" 4-up.

import { GRAD } from '../../media';
import { categoryTile, sectionHead } from '../../sections';
import { el, node, type BuilderNode } from '../../_kit';

export function shopSeason(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop the Season', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      sectionHead('Shop the Season'),
      el('div', 'grid w-full grid-cols-1 gap-3 @sm:grid-cols-2 @4xl:grid-cols-4', {
        children: [
          categoryTile({ title: 'National Kits', sub: 'Authentic & replica jerseys', href: '/shop', gradientCls: GRAD.fire, glyph: '👕' }),
          categoryTile({ title: 'Cleats', sub: 'Firm ground & turf', href: '/shop', gradientCls: GRAD.blueDeep, glyph: '👟' }),
          categoryTile({ title: 'Match Balls', sub: 'Official & training', href: '/shop', gradientCls: GRAD.steel, glyph: '⚽' }),
          categoryTile({ title: 'Fan Gear', sub: 'Show your colors', href: '/shop', gradientCls: GRAD.grape, glyph: '🧣' }),
        ],
      }),
    ],
  });
}
