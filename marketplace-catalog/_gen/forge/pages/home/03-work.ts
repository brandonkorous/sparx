// Forge home · 03 Selected work — the case-study gallery: a heading + supporting blurb,
// a 2-up grid of project cards (each a gradient thumb + category pill + title/meta + the
// circular up-right affordance), and a "See all projects" CTA. Tracks the mockup.

import { arrowRight, btn } from '../../media';
import { band, project, sectionIntro, thumbBars, thumbGrid, thumbRing, thumbRings } from '../../sections';
import { el, type BuilderNode } from '../../_kit';

export function work(): BuilderNode {
  return band({
    name: 'Selected work',
    gap: 'lg',
    children: [
      sectionIntro(
        'Selected work',
        'Brands and digital products we’ve shaped end-to-end — from positioning and identity to high-converting websites and launch.'
      ),
      el('div', 'grid w-full gap-6 @3xl:grid-cols-2', {
        children: [
          project({ category: 'Fintech', title: 'Northwind Capital', meta: 'Brand system · Web platform · Motion', thumb: thumbRing() }),
          project({ category: 'Consumer', title: 'Lumen Fitness', meta: 'Naming · Identity · E-commerce', thumb: thumbBars() }),
          project({ category: 'SaaS', title: 'Aperture Cloud', meta: 'Product design · Web · Design system', thumb: thumbGrid() }),
          project({ category: 'Healthtech', title: 'Umbra Health', meta: 'Strategy · Brand · Marketing site', thumb: thumbRings() }),
        ],
      }),
      el('div', 'flex w-full justify-center', {
        children: [btn('See all projects', '/work', { variant: 'outline', icon: arrowRight() })],
      }),
    ],
  });
}
