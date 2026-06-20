// Tempo generator — the Shop page: the catalog landing. A page hero over one LIVE grid
// per category (Originals / Running / Soccer / Lifestyle), each bound to the category by
// handle (the installer rewrites handle → id). Every nav facet lands here until the tenant
// wires per-category routes.

import { boundProductGrid, headRow, pageHero } from '../sections';
import { node, type BuilderNode } from '../_kit';

const CATEGORIES: Array<[string, string]> = [
  ['Originals', 'originals'],
  ['Running', 'running'],
  ['Soccer', 'soccer'],
  ['Lifestyle', 'lifestyle'],
];

const categoryBlock = (name: string, handle: string): BuilderNode =>
  node('Section', {
    box: { name, padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [headRow(name, 'View All', '/shop'), boundProductGrid(handle, 4, undefined, 'category')],
  });

export function shopTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('New & Trending', 'Shop everything', 'Performance and heritage, on and off the pitch — find your next pair, kit, or layer across every category.'),
      ...CATEGORIES.map(([name, handle]) => categoryBlock(name, handle)),
    ],
  });
}
