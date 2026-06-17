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

import { el, atom, bound, entry, type PlatformCatalogEntry } from './_kit';

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
              atom('Text', 'text-sm text-base-content/70', {
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
                  atom('Text', 'text-base leading-relaxed text-base-content/70', {
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
            el('div', 'flex items-center gap-3 text-sm text-base-content/60', {
              name: 'Byline',
              children: [
                el('span', '', { text: 'By the editorial team' }),
                el('span', 'text-base-content/30', { text: '·' }),
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
];
