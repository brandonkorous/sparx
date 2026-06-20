// Tempo generator — the News INDEX page. Lives at `/news` (NOT `/blog` — the
// `blog/[slug]` route owns that segment, so a singleton there would 404; see the catalog
// footgun in marketplace-catalog/CLAUDE.md). The cards are STATIC (built from the shared
// `newsPosts` metadata so the index never drifts from the seeded content) and each links
// to `/blog/<slug>` — the article-detail route the blog_post template renders.

import { GRAD, arrowLink, glyphPanel } from '../media';
import { newsPosts } from '../cms';
import { pageHero } from '../sections';
import { el, node, type BuilderNode } from '../_kit';

const GRADS = [GRAD.sky, GRAD.pitch, GRAD.teal];

const newsCard = (post: { slug: string; title: string; excerpt: string; glyph: string }, i: number): BuilderNode =>
  el('article', 'group flex flex-col border border-base-300', {
    children: [
      glyphPanel(post.glyph, GRADS[i % GRADS.length], 'h-44 w-full'),
      el('div', 'flex flex-1 flex-col gap-2 p-5', {
        children: [
          el('a', 'block transition-colors hover:text-base-content/70', {
            attrs: { href: `/blog/${post.slug}` },
            children: [el('h3', 'font-heading text-lg font-black uppercase leading-tight tracking-tightest text-base-content', { text: post.title })],
          }),
          el('p', 'flex-1 text-sm leading-relaxed text-base-content/65', { text: post.excerpt }),
          arrowLink('Read More', `/blog/${post.slug}`, { cls: 'mt-1' }),
        ],
      }),
    ],
  });

export function newsTree(): BuilderNode {
  return node('Section', {
    box: { name: 'News', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      pageHero('The Latest', 'News & Stories', 'Drops, athlete stories, and what we’re building next — straight from the team.'),
      node('Section', {
        box: { name: 'News grid', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: 3, gap: 'md' },
        children: newsPosts.map((p, i) => newsCard(p, i)),
      }),
    ],
  });
}
