// Farm Fresh generator — the Journal index (the blog landing). Presentation-only: the
// blueprint ships no posts of its own, so the index is the styled landing + an empty
// state until the tenant publishes (or industry sample data adds) blog posts. A live,
// linked blog index is a later platform piece — a `cms.<type>` list source exposes no
// per-entry slug yet, so its cards can't deep-link (marketplace-catalog/CLAUDE.md).
//
// Lives at `/journal` (not `/blog`): the `app/blog/[slug]` route owns the `blog`
// segment, so a `blog` singleton would 404 — `/journal` resolves through the catch-all.

import { node, type BuilderNode } from '../_kit';

export function journalTree(): BuilderNode {
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
          node('Heading', {
            box: { align: 'center' },
            props: { level: 'h1', size: 'display', text: 'The Journal' },
          }),
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
        box: {
          name: 'Posts',
          padding: 'xl',
          backgroundWidth: 'full',
          contentWidth: 'contained',
          align: 'center',
        },
        layout: { direction: 'stack', gap: 'none', alignItems: 'center', justify: 'center' },
        children: [
          node('Text', {
            box: { align: 'center' },
            cls: 'text-base-content/60',
            props: { variant: 'body', text: 'Fresh posts are on the way — check back soon.' },
          }),
        ],
      }),
    ],
  });
}
