// Tempo generator — the News INDEX page. Presentation-only: the blueprint ships no posts
// of its own, so the index is the styled hero + an empty state until the tenant publishes
// (or industry sample data adds) articles. A live, linked blog index is a later platform
// piece — a `cms.<type>` list source exposes no per-entry slug yet, so its cards can't
// deep-link (marketplace-catalog/CLAUDE.md). Lives at `/news` (NOT `/blog` — the
// `blog/[slug]` route owns that segment, so a singleton there would 404).

import { pageHero } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

export function newsTree(): BuilderNode {
  return node('Section', {
    box: { name: 'News', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'The Latest',
        'News & Stories',
        'Drops, athlete stories, and what we’re building next — straight from the team.'
      ),
      node('Section', {
        box: { name: 'News grid', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'none', alignItems: 'start' },
        children: [
          el('p', 'text-base text-base-content/60', {
            text: 'Fresh stories are on the way — check back soon.',
          }),
        ],
      }),
    ],
  });
}
