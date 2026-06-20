// Forge home · 07 Testimonials — "What partners say" over a 3-up row of quote figures
// (blockquote + initial avatar + name/role). Tracks the mockup.

import { TESTIMONIALS } from '../../data';
import { band, quoteFigure, sectionHeading } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function testimonials(): BuilderNode {
  return band({
    name: 'Testimonials',
    gap: 'lg',
    children: [
      sectionHeading('What partners say', 'max-w-3xl'),
      el('div', 'grid w-full gap-6 @3xl:grid-cols-3', {
        children: TESTIMONIALS.map((t) => quoteFigure(t)),
      }),
    ],
  });
}
