// Tempo home · 06 Shop Lifestyle — a contained band: a heading over a 3-up of tall
// editorial panels (Men / Women / Kids), each a gradient with a white caption foot +
// arrow-link. Tracks the mockup's editorial split panels.

import { GRAD } from '../../media';
import { editorialPanel, sectionHead } from '../../sections';
import { el, node, type BuilderNode } from '../../_kit';

export function editorial(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop Lifestyle', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      sectionHead('Shop Lifestyle'),
      el('div', 'grid w-full grid-cols-1 gap-3 @3xl:grid-cols-3', {
        children: [
          editorialPanel({ title: 'Street Ready', sub: 'Terrace styles for every day.', cta: 'Shop Men', href: '/shop', gradientCls: GRAD.rust }),
          editorialPanel({ title: 'Studio to Street', sub: 'Move in training-built layers.', cta: 'Shop Women', href: '/shop', gradientCls: GRAD.ruby }),
          editorialPanel({ title: 'Mini Me', sub: 'Icons, sized down.', cta: 'Shop Kids', href: '/shop', gradientCls: GRAD.teal }),
        ],
      }),
    ],
  });
}
