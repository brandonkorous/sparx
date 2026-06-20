// Forge generator — the Work index (singleton): a page hero over a full 2-up gallery of
// case-study cards (the home grid, expanded), closing on the shared contact CTA. Reuses
// the project card + gradient thumbs from sections.ts so the gallery matches the home
// teaser.

import { contactCta } from './home/08-contact-cta';
import { band, pageHero, project, thumbBars, thumbGrid, thumbRing, thumbRings } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

export function workTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Work', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'Selected work',
        'Work that earns its place.',
        'A decade of brands and digital products, shaped end-to-end — from positioning and identity to high-converting websites and launch.'
      ),
      band({
        name: 'Project grid',
        children: [
          el('div', 'grid w-full gap-6 @3xl:grid-cols-2', {
            children: [
              project({ category: 'Fintech', title: 'Northwind Capital', meta: 'Brand system · Web platform · Motion', thumb: thumbRing() }),
              project({ category: 'Consumer', title: 'Lumen Fitness', meta: 'Naming · Identity · E-commerce', thumb: thumbBars() }),
              project({ category: 'SaaS', title: 'Aperture Cloud', meta: 'Product design · Web · Design system', thumb: thumbGrid() }),
              project({ category: 'Healthtech', title: 'Umbra Health', meta: 'Strategy · Brand · Marketing site', thumb: thumbRings() }),
              project({ category: 'Climate', title: 'Voltaic Energy', meta: 'Rebrand · Product site · Motion', thumb: thumbRing() }),
              project({ category: 'Commerce', title: 'Cedar & Co', meta: 'Identity · E-commerce · Lifecycle', thumb: thumbGrid() }),
            ],
          }),
        ],
      }),
      contactCta(),
    ],
  });
}
