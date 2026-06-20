// Tempo home · 07 The long run — a full-bleed INVERSE (ink) editorial banner: a big
// display headline + supporting copy + a paper CTA beside a campaign glyph panel. Tracks
// the mockup's dark "Built for the long run" banner.

import { GRAD, arrowRight, btn, glyphPanel } from '../../media';
import { el, node, type BuilderNode } from '../../_kit';

export function longRun(): BuilderNode {
  return node('Section', {
    box: { name: 'The long run', surface: 'inverse', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'grid', columns: 2, gap: 'lg', alignItems: 'center' },
    children: [
      el('div', '', {
        children: [
          el('p', 'font-heading text-xs font-bold uppercase tracking-[0.3em] text-base-100/60', { text: 'Engineered to move' }),
          el('h2', 'mt-3 font-heading text-3xl font-black uppercase leading-[0.92] tracking-tightest text-base-100 @2xl:text-5xl', {
            text: 'Built for the long run',
          }),
          el('p', 'mt-4 max-w-md text-sm leading-relaxed text-base-100/70', {
            text: 'The new Glide Boost — engineered cushioning that returns energy from the first step to the finish line.',
          }),
          el('div', 'mt-6', { children: [btn('Shop Running', '/shop', { tone: 'paper', icon: arrowRight() })] }),
        ],
      }),
      glyphPanel('👟', GRAD.blueDeep, 'h-64 w-full @2xl:h-80'),
    ],
  });
}
