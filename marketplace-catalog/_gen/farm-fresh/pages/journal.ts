// Farm Fresh generator — the Journal index (the blog landing). The platform's
// `cms.<type>` list source exposes no per-entry slug, and there's no per-item href
// templating for a CMS repeater (the catalog `post_grid` ships dead `#` read-mores),
// so a LINKED index can't be a live repeater today. Instead each card is authored from
// the single-source `journalPosts` metadata (cms.ts) and links to the real
// `/blog/<slug>` post page — working links, no stub. The cover reuses the post's `seed`
// emoji/colour so the index matches each post's featured image.
//
// Lives at `/journal` (not `/blog`): the `app/blog/[slug]` route owns the `blog`
// segment, so a `blog` singleton would 404 — `/journal` resolves through the catch-all.

import { node, type BuilderNode } from '../_kit';
import { journalPosts } from '../cms';
import { emojiOf, emojiSurface } from '../media';
import { CARD_CLS } from '../theme';

/** One journal card: a fixed-height emoji-panel cover, then title + excerpt + a link
 *  to the post. The cover emoji/colour matches the post's featured image (same seed). */
const journalCard = (post: { slug: string; title: string; excerpt: string; seed: string }): BuilderNode =>
  node('Card', {
    cls: `overflow-hidden ${CARD_CLS}`,
    box: { padding: 'none' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        cls: 'h-44 rounded-b-none',
        box: {
          surface: emojiSurface(post.seed),
          align: 'center',
          backgroundWidth: 'full',
          contentWidth: 'full',
          padding: 'none',
        },
        layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', { cls: 'text-6xl leading-none', props: { variant: 'body', text: emojiOf(post.seed) } }),
        ],
      }),
      node('Stack', {
        cls: 'flex-1',
        box: { padding: 'md' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start', justify: 'between' },
        children: [
          node('Stack', {
            box: { padding: 'none' },
            layout: { direction: 'stack', gap: 'sm', alignItems: 'start' },
            children: [
              node('Heading', { cls: 'text-xl', props: { level: 'h3', text: post.title } }),
              node('Text', { cls: 'text-sm leading-relaxed text-base-content/70', props: { variant: 'body', text: post.excerpt } }),
            ],
          }),
          node('Button', { props: { label: 'Read article →', style: 'soft', href: `/blog/${post.slug}` } }),
        ],
      }),
    ],
  });

export function journalTree(): BuilderNode {
  const cols = journalPosts.length >= 3 ? 3 : journalPosts.length;
  return node('Section', {
    box: { name: 'Journal', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      node('Section', {
        box: {
          name: 'Journal intro',
          surface: 'subtle',
          padding: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
        },
        layout: { direction: 'stack', gap: 'sm', alignItems: 'center', justify: 'center' },
        children: [
          node('Heading', { box: { align: 'center' }, props: { level: 'h1', size: 'display', text: 'The Journal' } }),
          node('Text', {
            box: { align: 'center' },
            cls: 'max-w-xl',
            props: {
              variant: 'body',
              text: 'Notes from the counter — how we source, what’s in season, and the people behind the bowls.',
            },
          }),
        ],
      }),
      node('Section', {
        box: { name: 'Posts', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'grid', columns: cols, gap: 'lg' },
        children: journalPosts.map((p) => journalCard(p)),
      }),
    ],
  });
}
