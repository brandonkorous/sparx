// Mosaic generator — the Customers index (a singleton page). Presentation-only: the
// blueprint ships no stories of its own, so the index is the styled intro + an empty state
// until the tenant publishes (or industry sample data adds) customer stories. A live,
// linked index is a later platform piece — a `cms.blog_post` list source exposes no
// per-item href yet (marketplace-catalog/CLAUDE.md).

import { band, displayHeading } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

export function customersTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Customers', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Intro band (centered).
      node('Section', {
        box: { name: 'Customers intro', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained', align: 'center' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'center', justify: 'center' },
        children: [
          displayHeading('Teams that ship on Mosaic.', 'text-center'),
          el('p', 'mx-auto max-w-xl text-lg text-base-content/60', {
            text: 'From three-person startups to the Fortune 100 — see how teams bring their work together and move faster with Mosaic.',
          }),
        ],
      }),
      // Story grid — empty until the tenant (or industry sample data) adds stories.
      band({
        name: 'Customer stories',
        children: [
          el('p', 'text-base leading-relaxed text-base-content/60', {
            text: 'Customer stories are on the way — check back soon.',
          }),
        ],
      }),
    ],
  });
}
