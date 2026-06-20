// Forge generator — the insight-article collection template (binds the CMS record). It
// renders per-record at runtime, so it binds tokens (`blog_post.*`, the type key) rather
// than literal copy — the same scope apps/site + the entry-editor preview inject. Back
// link returns to the Insights index.

import { atom, bound, el, node, type BuilderNode } from '../_kit';

export function storyTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Insight', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Header band — back link + bound title + excerpt over the recessed surface.
      node('Section', {
        box: { name: 'Story header', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          el('a', 'text-sm font-medium text-[#C6F24E]', { text: '← All insights', attrs: { href: '/insights' } }),
          bound(
            atom('Heading', 'font-heading text-4xl font-medium tracking-tight text-[#ECE7DD] @2xl:text-5xl', { level: 'h1' }),
            'blog_post.title'
          ),
          bound(atom('Text', 'max-w-2xl text-lg text-base-content/70', { variant: 'body' }), 'blog_post.excerpt'),
        ],
      }),
      // Body band — bound cover image + bound rich body.
      node('Section', {
        box: { name: 'Story body', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          bound(atom('Image', 'w-full rounded-[1.5rem]', { ratio: 'wide', alt: 'Cover' }), 'blog_post.featuredImage'),
          bound(atom('Prose', '', {}), 'blog_post.body'),
        ],
      }),
    ],
  });
}
