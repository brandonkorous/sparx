// Forge generator — the Insights index (singleton). Static cards link to each seeded
// insight article at `/blog/<slug>` (a `cms.blog_post` list source exposes no per-item
// href, so a linked index is authored as static cards — marketplace-catalog CLAUDE.md).
// The card data is the single source shared with the seeded posts (cms.ts →
// insightStories), so the index never drifts. Closes on the shared contact CTA.

import { contactCta } from './home/08-contact-cta';
import { insightStories } from '../cms';
import { band, pageHero } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const articleCard = (s: { slug: string; kicker: string; accent: string; title: string; excerpt: string }): BuilderNode =>
  el('a', 'group flex flex-col overflow-hidden rounded-[1.5rem] border border-white/10 bg-[#221D16] transition-colors hover:border-white/25', {
    attrs: { href: `/blog/${s.slug}` },
    children: [
      el('div', `h-1.5 w-full bg-[${s.accent}]`, {}),
      el('div', 'flex flex-col gap-3 p-7', {
        children: [
          el('span', 'w-fit rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-base-content/70', { text: s.kicker }),
          el('h3', 'font-heading text-xl font-semibold text-[#ECE7DD]', { text: s.title }),
          el('p', 'text-sm leading-relaxed text-base-content/60', { text: s.excerpt }),
          el('span', 'mt-1 text-sm font-medium text-[#C6F24E]', { text: 'Read the story →' }),
        ],
      }),
    ],
  });

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
          el('div', 'grid w-full grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
            children: insightStories.map(articleCard),
          }),
        ],
      }),
      contactCta(),
    ],
  });
}
