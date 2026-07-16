// Content composites (docs/103, Tier 1b) — the publishing twin of commerce.ts. The
// binding spine (docs/98 Pillar 7) also DISPLAYS RECORDS: a node pinned to a content
// entry (a blog post / article) renders its real title / body / hero, and a container
// bound to a content collection repeats a card per entry. This is what a CMS-only
// tenant builds with — no selling required.
//
// Same template rule as commerce (CONTRACT.md "Binding the spine"): never bake an
// entry id. A featured/article composite is authored inert-but-rich with `item.*`
// bindings + placeholder copy; the tenant PINS it to an entry (Data panel → "A record"
// → a content type → an entry). The `post_grid` repeats the legacy `cms.<type>` array
// source (the commerce `source` schema is products-only) — defaulting to `blog_post`,
// re-pointed in the Data panel if the tenant's type key differs.
//
// Fields are the built-in `blog_post` schema (seed 20260528100100): title / excerpt /
// body (rich_text → a Prose leaf) / featuredImage. There is no author/date schema
// field, so bylines are authored static text, not bindings.

import { el, atom, bound, behave, part, entry, type PlatformCatalogEntry } from './_kit';

// ── Shared post card ────────────────────────────────────────────────────────────
//
// The compact article card, the per-item template inside `post_grid` (the `cms.<type>`
// repeater scopes each to a post). Binds the cover, title, and excerpt; the read-more
// is a static link the tenant points at the post.
function postCard(): PlatformCatalogEntry['tree'] {
  return el(
    'article',
    'flex h-full flex-col overflow-hidden rounded-box border border-base-200 bg-base-100 shadow-sm transition-shadow hover:shadow-md',
    {
      name: 'Post card',
      children: [
        bound(atom('Image', 'w-full', { ratio: 'wide', alt: 'Post cover' }), 'item.featuredImage'),
        el('div', 'flex flex-1 flex-col gap-2 p-5', {
          children: [
            bound(
              atom('Heading', 'text-lg font-semibold text-base-content', {
                level: 'h3',
                text: 'Designing for calm: the case for slower interfaces',
              }),
              'item.title'
            ),
            bound(
              atom('Text', 'text-sm text-base-content', {
                variant: 'body',
                text: 'Why the most considerate products do less, more deliberately — and how restraint reads as quality.',
              }),
              'item.excerpt'
            ),
            el(
              'a',
              'mt-auto inline-flex w-fit items-center gap-1 pt-2 text-sm font-semibold text-primary hover:underline',
              { text: 'Read more →', attrs: { href: '#' } }
            ),
          ],
        }),
      ],
    }
  );
}

// ── Entries ─────────────────────────────────────────────────────────────────────

export const CONTENT_CATALOG: PlatformCatalogEntry[] = [
  // ── Featured article — a two-column spotlight pinned to one content entry ──────
  entry({
    key: 'featured_article',
    name: 'Featured article',
    category: 'content',
    kind: 'comprehensive',
    icon: 'newspaper',
    description:
      'A two-column spotlight for one article — cover image beside its title and excerpt, with a read-more link. Pin it to a content entry and it reads that entry.',
    surfaces: ['page', 'site'],
    tags: ['article', 'blog', 'post', 'featured', 'editorial', 'cms', 'content'],
    tree: el('section', 'w-full px-4 py-16', {
      name: 'Featured article',
      children: [
        el('div', 'mx-auto grid max-w-6xl grid-cols-1 gap-10 @3xl:grid-cols-2 @3xl:items-center', {
          children: [
            bound(
              atom('Image', 'w-full rounded-box', { ratio: 'wide', alt: 'Article cover' }),
              'item.featuredImage'
            ),
            el('div', 'flex flex-col gap-4', {
              name: 'Article summary',
              children: [
                bound(
                  atom('Heading', 'text-3xl font-bold tracking-tight text-base-content', {
                    level: 'h2',
                    text: 'Designing for calm: the case for slower interfaces',
                  }),
                  'item.title'
                ),
                bound(
                  atom('Text', 'text-base leading-relaxed text-base-content', {
                    variant: 'body',
                    text: 'The most considerate products do less, more deliberately. A look at how restraint — fewer prompts, gentler motion, quieter color — reads as quality and earns trust.',
                  }),
                  'item.excerpt'
                ),
                el(
                  'a',
                  'inline-flex w-fit items-center gap-1 text-sm font-semibold text-primary hover:underline',
                  { text: 'Read the full story →', attrs: { href: '#' } }
                ),
              ],
            }),
          ],
        }),
      ],
    }),
  }),

  // ── Article body — a full reading layout pinned to one entry ───────────────────
  entry({
    key: 'article_body',
    name: 'Article body',
    category: 'content',
    kind: 'comprehensive',
    icon: 'text',
    description:
      'A full article layout — title, byline, hero image, and the rich body. Pin it to a content entry; the body renders that entry’s formatted rich text.',
    surfaces: ['page', 'site'],
    tags: ['article', 'blog', 'post', 'body', 'prose', 'reading', 'cms', 'content'],
    tree: el('article', 'mx-auto w-full max-w-3xl px-4 py-16', {
      name: 'Article',
      children: [
        el('header', 'mb-8 flex flex-col gap-4', {
          children: [
            bound(
              atom('Heading', 'text-4xl font-bold leading-tight tracking-tight text-base-content', {
                level: 'h1',
                text: 'Designing for calm: the case for slower interfaces',
              }),
              'item.title'
            ),
            el('div', 'flex items-center gap-3 text-sm text-base-content', {
              name: 'Byline',
              children: [
                el('span', '', { text: 'By the editorial team' }),
                el('span', 'text-base-content', { text: '·' }),
                el('span', '', { text: '6 min read' }),
              ],
            }),
          ],
        }),
        bound(
          atom('Image', 'mb-8 w-full rounded-box', { ratio: 'wide', alt: 'Article hero' }),
          'item.featuredImage'
        ),
        bound(atom('Prose', ''), 'item.body'),
      ],
    }),
  }),

  // ── Post grid — a repeater over a content collection, one card per entry ───────
  entry({
    key: 'post_grid',
    name: 'Post grid',
    category: 'content',
    kind: 'comprehensive',
    icon: 'layout-grid',
    description:
      'A responsive grid that repeats an article card once per content entry — a blog index. Reads the blog_post type by default; re-point it to another type in the Data panel.',
    surfaces: ['page', 'site'],
    tags: ['blog', 'index', 'articles', 'posts', 'grid', 'archive', 'cms', 'content'],
    tree: el('section', 'w-full px-4 py-12', {
      name: 'Post grid',
      children: [
        el('div', 'mx-auto max-w-6xl', {
          children: [
            atom('Heading', 'mb-8 text-3xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'From the journal',
            }),
            bound(
              el('div', 'grid grid-cols-1 gap-6 @xl:grid-cols-2 @4xl:grid-cols-3', {
                name: 'Posts',
                children: [postCard()],
              }),
              'cms.blog_post'
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Related posts — a "more to read" strip repeating article cards ────────────
  entry({
    key: 'related_posts',
    name: 'Related posts',
    category: 'content',
    kind: 'comprehensive',
    icon: 'newspaper',
    description:
      'A “more to read” strip — a repeating row of article cards over the blog_post type. Re-point it to another content type in the Data panel.',
    surfaces: ['page', 'site'],
    tags: ['related', 'more', 'articles', 'posts', 'recommended', 'cms', 'content'],
    tree: el('section', 'w-full px-4 py-12', {
      name: 'Related posts',
      children: [
        el('div', 'mx-auto max-w-6xl', {
          children: [
            atom('Heading', 'mb-6 text-2xl font-bold tracking-tight text-base-content', {
              level: 'h2',
              text: 'More to read',
            }),
            bound(
              el('div', 'grid grid-cols-1 gap-6 @xl:grid-cols-3', {
                name: 'Posts',
                children: [postCard()],
              }),
              'cms.blog_post'
            ),
          ],
        }),
      ],
    }),
  }),

  // ── Author bio — byline card with photo, role, and social links ───────────────
  entry({
    key: 'author_bio',
    name: 'Author bio',
    category: 'content',
    kind: 'comprehensive',
    icon: 'user-round',
    description:
      'A byline card — author photo, name, role, a short bio, and social links. Place it at the end of an article or on an author page.',
    surfaces: ['page', 'site'],
    tags: ['author', 'byline', 'bio', 'profile', 'writer', 'cms', 'content'],
    tree: el(
      'div',
      'flex w-full flex-col items-center gap-4 rounded-box border border-base-200 bg-base-100 p-6 text-center @xl:flex-row @xl:items-start @xl:text-left',
      {
        name: 'Author bio',
        children: [
          atom('Image', 'h-16 w-16 shrink-0 rounded-full', {
            ratio: 'square',
            alt: 'Author photo',
          }),
          el('div', 'flex flex-col gap-2', {
            children: [
              el('div', 'flex flex-col gap-0.5', {
                children: [
                  atom('Heading', 'text-lg font-semibold text-base-content', {
                    level: 'h3',
                    text: 'Jordan Avery',
                  }),
                  el('p', 'text-sm text-base-content', { text: 'Senior writer' }),
                ],
              }),
              atom('Text', 'text-sm leading-relaxed text-base-content', {
                variant: 'body',
                text: 'Jordan writes about design, craft, and the small decisions that add up to great products. Ten years in, still sweating the details.',
              }),
              el('div', 'flex justify-center gap-3 @xl:justify-start', {
                name: 'Social links',
                children: [
                  el('a', 'text-base-content transition-colors hover:text-primary', {
                    attrs: { href: '#', ariaLabel: 'Twitter' },
                    children: [atom('Icon', 'h-4 w-4', { name: 'twitter' })],
                  }),
                  el('a', 'text-base-content transition-colors hover:text-primary', {
                    attrs: { href: '#', ariaLabel: 'LinkedIn' },
                    children: [atom('Icon', 'h-4 w-4', { name: 'linkedin' })],
                  }),
                  el('a', 'text-base-content transition-colors hover:text-primary', {
                    attrs: { href: '#', ariaLabel: 'Website' },
                    children: [atom('Icon', 'h-4 w-4', { name: 'globe' })],
                  }),
                ],
              }),
            ],
          }),
        ],
      }
    ),
  }),

  // ── Article with contents — a two-column reading layout + auto TOC ────────────
  // The TOC builds itself from the body's headings at render (the `toc` behavior),
  // so the sidebar links are placeholders in the canvas and the real headings live.
  entry({
    key: 'article_with_toc',
    name: 'Article with contents',
    category: 'content',
    kind: 'comprehensive',
    icon: 'list-tree',
    description:
      'A long-read layout — a sticky “On this page” table of contents beside the article body. The TOC builds itself from the body’s headings and tracks scroll. Pin it to an entry.',
    surfaces: ['page', 'site'],
    tags: ['article', 'toc', 'contents', 'long read', 'documentation', 'cms', 'content'],
    tree: behave(
      el('div', 'mx-auto grid w-full max-w-5xl grid-cols-1 gap-10 px-4 py-16 @3xl:grid-cols-4', {
        name: 'Article with contents',
        children: [
          el('nav', 'h-fit @3xl:col-span-1 @3xl:sticky @3xl:top-24', {
            name: 'Contents',
            attrs: { ariaLabel: 'On this page' },
            children: [
              el('p', 'mb-2 text-xs font-semibold text-base-content', { text: 'On this page' }),
              part(
                el('div', 'st-toc__list', {
                  name: 'Links',
                  children: [
                    el('a', 'st-toc__link', { text: 'Introduction', attrs: { href: '#' } }),
                    el('a', 'st-toc__link', { text: 'Getting started', attrs: { href: '#' } }),
                    el('a', 'st-toc__link st-toc__link--sub', {
                      text: 'A closer look',
                      attrs: { href: '#' },
                    }),
                  ],
                }),
                'panel'
              ),
            ],
          }),
          el('article', 'min-w-0 @3xl:col-span-3', {
            name: 'Article',
            children: [
              bound(
                atom(
                  'Heading',
                  'mb-4 text-4xl font-bold leading-tight tracking-tight text-base-content',
                  { level: 'h1', text: 'A field guide to slower, kinder software' }
                ),
                'item.title'
              ),
              el('div', 'mb-8 flex items-center gap-3 text-sm text-base-content', {
                name: 'Byline',
                children: [
                  el('span', '', { text: 'By the editorial team' }),
                  el('span', 'text-base-content', { text: '·' }),
                  el('span', '', { text: '9 min read' }),
                ],
              }),
              part(
                el('div', 'min-w-0', { children: [bound(atom('Prose', ''), 'item.body')] }),
                'spy'
              ),
            ],
          }),
        ],
      }),
      { type: 'toc' }
    ),
  }),
];
