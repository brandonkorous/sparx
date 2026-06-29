// Tempo generator — the Shop page: the catalog landing. A page hero over ONE LIVE grid
// bound to the whole catalog (sections.ts `boundProductGrid`). The blueprint ships no
// catalog of its own (presentation-only), so the grid fills with the tenant's products
// (their own, or industry sample data) and is empty until any exist. Every nav facet
// lands here until the tenant wires per-category routes.

import { boundProductGrid, pageHero, sectionHead } from '../sections';
import { node, type BuilderNode } from '../_kit';

export function shopTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Shop', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'New & Trending',
        'Shop everything',
        'Performance and heritage, on and off the pitch — find your next pair, kit, or layer.'
      ),
      node('Section', {
        box: { name: 'All products', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [sectionHead('All products'), boundProductGrid(4)],
      }),
    ],
  });
}
