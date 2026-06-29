// Tempo home · 05 Best Sellers — a contained band: a heading row (with a "View All"
// arrow-link) over a LIVE product grid bound to the live catalog (`from: 'all'`). Real
// shoppable cards — photo + title link to each product's PDP. The blueprint ships no
// catalog of its own, so it fills with the tenant's products (their own, or industry
// sample data) and is empty until any exist. Tracks the mockup's "Shop Best Sellers" row.

import { boundProductGrid, headRow } from '../../sections';
import { node, type BuilderNode } from '../../_kit';

export function bestSellers(): BuilderNode {
  return node('Section', {
    box: { name: 'Best Sellers', padding: 'lg', backgroundWidth: 'full', contentWidth: 'contained' },
    layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
    children: [
      headRow('Shop Best Sellers', 'View All', '/shop'),
      // 2-up on phones, 4-up on desktop — the grid's own columns; the card is responsive.
      boundProductGrid(4, 8),
    ],
  });
}
