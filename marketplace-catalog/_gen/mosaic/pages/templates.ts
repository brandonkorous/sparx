// Mosaic generator — the customer-story collection template (binds the CMS record). It
// renders per-record at runtime, so it binds tokens (`blog_post.*`, the type key) rather
// than literal copy — the same scope apps/site + the entry-editor preview inject.

import { atom, bound, el, node, type BuilderNode } from '../_kit';

export function storyTemplate(): BuilderNode {
  return node('Section', {
    box: { name: 'Customer story', padding: 'none', backgroundWidth: 'full', contentWidth: 'full' },
    layout: { direction: 'stack', gap: 'none' },
    children: [
      // Header band — back link + bound title + excerpt over the cream surface.
      node('Section', {
        box: { name: 'Story header', surface: 'subtle', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'md', alignItems: 'start' },
        children: [
          el('a', 'text-sm font-medium text-primary', { text: '← All customer stories', attrs: { href: '/customers' } }),
          bound(atom('Heading', 'text-4xl font-bold tracking-tight text-[#191918] @2xl:text-5xl', { level: 'h1' }), 'blog_post.title'),
          bound(atom('Text', 'max-w-2xl text-lg text-base-content/60', { variant: 'body' }), 'blog_post.excerpt'),
        ],
      }),
      // Body band — bound cover image + bound rich body.
      node('Section', {
        box: { name: 'Story body', padding: 'xl', backgroundWidth: 'full', contentWidth: 'contained' },
        layout: { direction: 'stack', gap: 'lg' },
        children: [
          bound(atom('Image', 'w-full rounded-2xl', { ratio: 'wide', alt: 'Cover' }), 'blog_post.featuredImage'),
          bound(atom('Prose', '', {}), 'blog_post.body'),
        ],
      }),
    ],
  });
}
