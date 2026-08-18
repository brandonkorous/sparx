// CMS-domain silica composites — the default body for a published article.
//
// WHY THIS FILE EXISTS. `starterCollectionDto` (wizeworks/apps/site) hands a tenant a real
// detail page for any record type with no stored template: a product gets
// `productDetailPage()`, a collection `collectionDetailPage()`, a service
// `serviceDetailPage()`. `cms.blog_post` had no case, so it returned null and every
// post on every tenant that had not hand-authored a template fell all the way through
// to `PageView` — an inline-styled 720px column, nested inside the site's own <main>,
// with no date, no image, and no way back to the index. A tenant could write a
// perfectly good post and have it render like a draft.
//
// The code-fallback path is the right home for this rather than a starter PAGE, for
// the same reason the PDP lives here: a STORED tree freezes at publish (docs/122 — a
// composite change never re-authors a saved page), so a seeded starter page would
// reach only tenants created after it shipped and would never improve again. A
// composite reaches every tenant who has not authored their own, including existing
// ones, and keeps improving.
//
// AUTHORING CONTRACT (builder-contract §5): every factory returns a FRESH, id-free
// `Node`; every class is a LITERAL string so the Tailwind `@source` harness safelists
// it; data refs are SCOPE-RELATIVE field keys resolved against the record in scope.

import { atom, bind, el, repeat, type Node } from '@wizeworks/silicaui-html';

import { bindAttr } from './attr-binding';
import { HOST_KEYS, hostCore } from './host-nodes';
import { PLACEHOLDER_IMAGE } from './placeholder';

/** The record fields the storefront projects for a post (`postToBuilderRecord`):
 *  `title`, `excerpt`, `date`, `featuredImage:{url,alt}`, and `body` — which is a
 *  rich-text DOCUMENT, not a string, and therefore renders through the pinned
 *  `cms.article-body` core rather than a binding.
 *
 *  Also projected (from the author + taxonomy relations the public reads now
 *  `include`): the BYLINE — `authorName`, `authorAvatar:{url,alt}`, `authorBio`,
 *  `category`, `categorySlug`, and `tags:string[]` — the rubric/byline/tags a
 *  WordPress-style publisher template binds. Empty for a post with no author or
 *  terms, so a bound byline degrades to nothing rather than erroring. The default
 *  templates below don't bind them yet (an empty bind would blank an authored line);
 *  a template that wants a byline gates it with `visibleWhen('authorName')`. */

/** The post's masthead — the back-link, date, headline, and the excerpt as a lede.
 *
 *  The date sits above the title as METADATA, not as an eyebrow: an eyebrow is a
 *  category chip or a kicker ("Article", "01 / 03") whose only job is to introduce the
 *  heading, and those are banned. A publication date is a fact about the thing. */
function masthead(): Node {
  return el('section', 'w-full @container bg-base-200 text-base-content', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 pt-12 pb-16 @2xl:pt-16 @2xl:pb-20', {
        children: [
          el(
            'a',
            'inline-flex items-center gap-2 text-base font-semibold text-base-content hover:underline',
            {
              attrs: { href: '/blog' },
              children: [
                el('span', undefined, { text: '←' }),
                el('span', undefined, { text: 'All posts' }),
              ],
            }
          ),
          el('div', 'mt-8 flex flex-col gap-5', {
            children: [
              // Placeholder text is not decoration: on the studio canvas NO record is in
              // scope, so this string is the only thing the author sees. An empty
              // placeholder renders the template as a floating headline over blank
              // regions — nothing to click and nothing to explain what belongs there.
              bind(
                el('span', 'text-base font-semibold text-base-content', { text: 'Published date' }),
                'date'
              ),
              bind(
                el(
                  'h1',
                  'max-w-4xl text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
                  { text: 'Post title' }
                ),
                'title'
              ),
              bind(
                el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                  text: 'The short summary of this post, written in the CMS.',
                }),
                'excerpt'
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The post's featured image, if it has one.
 *
 *  `alt` is empty ON PURPOSE and the bind fills only `src` (a bare bind on `Image` IS
 *  its source — alt is a static prop). The image sits directly beneath the headline it
 *  illustrates, so describing it would make a screen reader announce the same sentence
 *  twice; an empty alt marks it decorative, which is the correct treatment here. */
function featuredImage(): Node {
  return el('section', 'w-full @container bg-base-100', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 py-10', {
        children: [
          bind(
            atom('Image', 'aspect-video w-full rounded-box object-cover', {
              // The shared placeholder tile, not an empty `src`: unbound (the studio
              // canvas, where no post is in scope) an empty src renders the browser's
              // broken-image glyph. `fillValue` overwrites it with the post's real
              // image the moment the node resolves, so it never reaches a live page.
              src: PLACEHOLDER_IMAGE,
              alt: '',
            }),
            'featuredImage'
          ),
        ],
      }),
    ],
  });
}

/** The written body — the pinned `cms.article-body` core on a PROSE measure.
 *
 *  `max-w-3xl`, not the page's `max-w-5xl`: this band is nothing but body text, and a
 *  line much past ~75 characters is measurably harder to read. */
function articleBody(): Node {
  return el('section', 'w-full @container bg-base-100 text-base-content', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl px-6 pb-20 @2xl:pb-24', {
        children: [hostCore(HOST_KEYS.cmsArticleBody, 'w-full')],
      }),
    ],
  });
}

/** The way out. A reader who finishes a post is otherwise at a dead end.
 *
 *  Deliberately a link to the index rather than a "related posts" rail: relatedness
 *  needs a topic taxonomy the CMS does not have, so a rail here would be
 *  newest-across-the-blog wearing a label that claims more than it knows. */
function backToIndex(): Node {
  return el('section', 'w-full @container bg-base-200 text-base-content', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 py-16', {
        children: [
          el('div', 'flex flex-col gap-6', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @2xl:text-3xl', {
                text: 'Keep reading',
              }),
              el('div', undefined, {
                children: [
                  el('a', 'btn btn-primary btn-lg', {
                    attrs: { href: '/blog' },
                    text: 'See all posts',
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

// ── The index ────────────────────────────────────────────────────────────────

/** One post card — the grid's SINGLE child, repeated per post.
 *
 *  THE REPEAT MARKER GOES ON THE GRID, NOT ON THIS CARD. Marking the card makes the
 *  CARD the container, so its own children repeat inside it: the page renders one
 *  giant anchor holding every post's heading and excerpt stacked in a single column,
 *  with the rest of the grid empty and every href stuck on the placeholder. Nothing
 *  errors. See `blogIndex()` below and the same contract in `commerce.ts`.
 *
 *  The card's `href` is a native attribute binding (`bindAttr`): binding the anchor
 *  itself would replace its children with the URL string and destroy the card. */
function postCard(): Node {
  return bindAttr(
    el(
      'a',
      'group flex h-full flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6 transition hover:border-primary hover:shadow-lg',
      {
        attrs: { href: '/blog' },
        children: [
          bind(
            atom('Image', 'aspect-video w-full rounded-box object-cover', {
              src: PLACEHOLDER_IMAGE,
              alt: '',
            }),
            'featuredImage'
          ),
          bind(
            el('span', 'text-sm font-semibold text-base-content', { text: 'Published date' }),
            'date'
          ),
          bind(
            el('h2', 'text-xl font-bold leading-snug tracking-tight text-base-content', {
              text: 'Post title',
            }),
            'title'
          ),
          bind(
            el('p', 'text-base leading-relaxed text-base-content', {
              text: 'The short summary of this post, written in the CMS.',
            }),
            'excerpt'
          ),
        ],
      }
    ),
    'href',
    'url'
  );
}

/** The full blog INDEX page body — the `/blog` listing.
 *
 *  Two columns, not three: these cards carry a real headline and a full excerpt, and
 *  at three-up on a 1152px measure the titles wrap to four lines each.
 *
 *  Exists because the post template's "See all posts" pointed at a page no tenant had
 *  — the detail page shipped without its index, so every post's primary way out was a
 *  dead link. */
/** The post-grid SECTION of the blog index — the `cms.blog_post` repeat, on its own so a
 *  bespoke journal (a template's own editorial masthead) can sit above the SAME correct,
 *  linkable grid rather than re-authoring the repeat (and drifting from the card that knows
 *  how to link a post). Two columns, not three — see `blogIndexPage`. */
export function blogPostGrid(): Node {
  return el('section', 'w-full @container bg-base-100', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 py-16', {
        children: [
          repeat(
            el('div', 'grid grid-cols-1 items-stretch gap-6 @5xl:grid-cols-2', {
              children: [postCard()],
            }),
            'cms.blog_post'
          ),
        ],
      }),
    ],
  });
}

export function blogIndexPage(): Node {
  return el('div', 'flex flex-col', {
    children: [
      el('section', 'w-full @container bg-base-200 text-base-content', {
        children: [
          el('div', 'mx-auto w-full max-w-5xl px-6 py-16 @2xl:py-20', {
            children: [
              el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
                text: 'Journal',
              }),
              el('p', 'mt-5 max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'News, notes, and what we have been working on.',
              }),
            ],
          }),
        ],
      }),
      blogPostGrid(),
    ],
  });
}

/** The full blog-post PAGE body — the `cms.blog_post` record template's default.
 *
 *  Registered in `RECORD_TEMPLATES` (record-templates.ts) — that registry, not a
 *  hand-maintained switch, is what the storefront looks a record type up in.
 *
 *  Self-scoping, like `collectionDetailPage`: the root repeats over the injected
 *  `blog_post` object (a collection-of-one), so every field below binds scope-relative
 *  to the routed post. Without that wrapper the binds resolve against nothing and the
 *  page ships its placeholders — silently, with no error anywhere. */
export function blogPostPage(): Node {
  return repeat(
    el('div', 'flex flex-col', {
      children: [masthead(), featuredImage(), articleBody(), backToIndex()],
    }),
    'blog_post'
  );
}
