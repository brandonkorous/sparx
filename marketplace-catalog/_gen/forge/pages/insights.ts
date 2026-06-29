// Forge generator — the Insights index (singleton). Presentation-only: the blueprint
// ships no articles of its own, so the index is the styled hero + an empty state until the
// tenant publishes (or industry sample data adds) insight articles. A live, linked index
// is a later platform piece — a `cms.blog_post` list source exposes no per-item href yet
// (marketplace-catalog/CLAUDE.md). Closes on the shared contact CTA.

import { contactCta } from './home/08-contact-cta';
import { band, pageHero } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

export function insightsTree(): BuilderNode {
  return node('Section', {
    box: { name: 'Insights', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero(
        'Insights',
        'Notes on brand, web & growth.',
        'Field notes from the studio — what we’re learning about building brands and products that compound.'
      ),
      band({
        name: 'Articles',
        children: [
          el('p', 'text-base leading-relaxed text-base-content/60', {
            text: 'Field notes are on the way — check back soon.',
          }),
        ],
      }),
      contactCta(),
    ],
  });
}
