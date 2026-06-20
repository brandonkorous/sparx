// Mosaic generator — the Customers index (a singleton page). Static cards link to each
// seeded customer story at `/blog/<slug>` (a `cms.blog_post` list source exposes no
// per-item href, so a linked index is authored as static cards — marketplace-catalog
// CLAUDE.md). The card data is the single source shared with the seeded posts
// (cms.ts → customerStories), so the index never drifts.

import { customerStories } from '../cms';
import { band, displayHeading } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const storyCard = (story: { slug: string; title: string; excerpt: string; glyph: string }): BuilderNode =>
  el('a', 'flex flex-col gap-3 rounded-2xl border border-base-300 bg-base-100 p-6 transition-shadow hover:shadow-lg', {
    attrs: { href: `/blog/${story.slug}` },
    children: [
      el('span', 'text-2xl', { text: story.glyph }),
      el('h3', 'text-lg font-semibold text-[#191918]', { text: story.title }),
      el('p', 'text-sm leading-relaxed text-base-content/60', { text: story.excerpt }),
      el('span', 'mt-1 text-sm font-medium text-primary', { text: 'Read the story →' }),
    ],
  });

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
      // Story grid.
      band({
        name: 'Customer stories',
        children: [
          el('div', 'grid w-full grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
            children: customerStories.map(storyCard),
          }),
        ],
      }),
    ],
  });
}
