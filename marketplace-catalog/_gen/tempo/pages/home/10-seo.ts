// Tempo home · 10 SEO copy — a contained band of dense category copy above the footer (a
// keyword-rich block the way large sportswear sites close the home page). Tracks the
// mockup's SEO text block.

import { el, node, type BuilderNode } from '../../_kit';

export function seoCopy(): BuilderNode {
  return node('Section', {
    box: { name: 'SEO copy', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
    children: [
      el('h2', 'font-heading text-base font-bold uppercase tracking-tight text-base-content', {
        text: 'Sneakers, activewear and sporting goods',
      }),
      el('p', 'max-w-4xl text-xs leading-relaxed text-base-content/60', {
        text: 'From the track to the street, our gear is built to move with you. Explore performance running shoes, heritage Originals sneakers, soccer cleats and national team kits, training apparel, and lifestyle staples designed to last. Whether you’re chasing a personal best or building an everyday rotation, find the fit, the cushioning, and the colors that match your game. Shop new arrivals, best sellers, and seasonal essentials for men, women, and kids — all backed by free returns and Club member rewards.',
      }),
    ],
  });
}
