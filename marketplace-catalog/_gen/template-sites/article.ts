// Shared ARTICLE-DETAIL construction kit for the ten reference-driven CONTENT templates
// (docs/templates/content/*) — the content-side counterpart to `pdp.ts`. A publisher
// lives on its article page the way a shop lives on its product page, so "closest clone
// allowed" means each content template ships its OWN bespoke article design, not the
// generic `blogPostPage()` every bundle would otherwise fall back to.
//
// WHAT THIS KIT IS. The article's LAYOUT is where a publication shows itself — a dense
// news masthead, a serif longform reader, a full-bleed photo lede — so each template
// AUTHORS that layout in its own generator. What it must NOT re-derive is the DATA
// plumbing: an article page is a `cms.blog_post` collection template whose body repeats
// over the routed post (a collection-of-one) and binds SCOPE-RELATIVE short keys that
// resolve to the post. This kit owns the binds + the `repeat('blog_post')` scoping + the
// pinned article-body core, and each template composes them into its own shell.
//
// This mirrors `packages/silica-catalog/src/cms.ts` `blogPostPage()` — the same
// `repeat('blog_post')` scope, the same field keys, the same `cms.article-body` host core
// for the written body — so a bespoke article resolves exactly like the starter's, only in
// the template's own layout.
//
// THE BYLINE IS REAL NOW. The storefront projects a post's author + taxonomy onto the
// bound record (`apps/site/lib/builder-data.ts` `projectByline`): `authorName`,
// `authorAvatar`, `authorBio`, `category`, `categorySlug`, `tags`. Every byline primitive
// here is `visibleWhen`-gated on its own field, so a post with no author or no category
// renders NOTHING for that line rather than a blank — the same discipline `pdpStockBadge`
// uses for a real-only signal.
//
// EDITORIAL DEVICES LIVE HERE, NOT IN THE SHARED CATALOG. A category rubric sitting above
// the headline is the "eyebrow" the platform bans on its OWN surfaces (CLAUDE.md RULE #2)
// and that `sections.test.ts` enforces across `SECTION_CATALOG`. A tenant's own published
// site has design freedom, so the rubric is correct HERE — a bundle-level composition —
// exactly as the commerce bespoke PDPs carry looks the house palette would not.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules);
// the primitives come through the silica-catalog package's own copy so the nodes minted
// here and the nodes the catalog factories mint are the same module instance.

import {
  atom,
  bind,
  el,
  repeat,
  type Node,
} from '../../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';

import { visibleWhen } from '../../../packages/silica-catalog/src/conditional';
import { HOST_KEYS, hostCore } from '../../../packages/silica-catalog/src/host-nodes';
import { PLACEHOLDER_IMAGE } from '../../../packages/silica-catalog/src/placeholder';

// ── Bound field primitives ────────────────────────────────────────────────────
//
// Each returns ONE bound node the routed post fills. `className` is the whole visual
// decision, so a template controls scale, weight and colour while the bind stays correct.
// Every key here is what `postToBuilderRecord` + `projectByline` project — do not invent
// field keys (an unknown key resolves to nothing, silently).

/** The post's category, as an editorial RUBRIC — the label above the headline. Gated on
 *  `category`, so a post filed under nothing renders no empty rubric. A bundle-level device
 *  (see the header): the house palette bans it, a tenant's own site does not. */
export function articleRubric(className: string): Node {
  return visibleWhen(bind(el('span', className, { text: 'Section' }), 'category'), 'category');
}

/** The post title, bound to `title`. The article heading is the page's ONE `<h1>` — pass
 *  `tag: 'h1'` on the main title and `h2`/`h3` for any secondary echo. */
export function articleTitle(tag: 'h1' | 'h2' | 'h3', className: string): Node {
  return bind(el(tag, className, { text: 'Post title' }), 'title');
}

/** The standfirst — the post's excerpt as the lede paragraph, bound to `excerpt`. */
export function articleStandfirst(className: string): Node {
  return bind(
    el('p', className, { text: 'The short summary of this post, written in the CMS.' }),
    'excerpt'
  );
}

/** The publication date, bound to `date`. Metadata, not an eyebrow — a fact about the
 *  post, placed wherever the byline sits. */
export function articleDate(className: string): Node {
  return bind(el('span', className, { text: 'Published date' }), 'date');
}

/** The author's name, bound to `authorName`, gated so a post with no author shows nothing. */
export function articleAuthorName(className: string): Node {
  return visibleWhen(
    bind(el('span', className, { text: 'Author name' }), 'authorName'),
    'authorName'
  );
}

/** The author's portrait, bound to `authorAvatar` (a `{url,alt}` the storefront resolves).
 *  Gated on the same field, so no author means no empty avatar frame. */
export function articleAuthorAvatar(className: string): Node {
  return visibleWhen(
    bind(atom('Image', className, { src: PLACEHOLDER_IMAGE, alt: '' }), 'authorAvatar'),
    'authorAvatar'
  );
}

/** The post's featured image, bound to `featuredImage`. `PLACEHOLDER_IMAGE` shows only on
 *  the empty studio canvas — the storefront overwrites `src` the moment it resolves.
 *
 *  `className` must be NAMED utilities only — an arbitrary value (`aspect-[4/5]`) compiles
 *  only while this file is @source-scanned and emits NOTHING once stamped into a tenant's
 *  tree (the sweep flags it `class-no-css`). Use `aspect-video` / `aspect-square`. */
export function articleFeaturedImage(className: string, alt = ''): Node {
  return bind(atom('Image', className, { src: PLACEHOLDER_IMAGE, alt }), 'featuredImage');
}

/** The written body — the pinned `cms.article-body` host core, which the platform fills
 *  with the routed post's rich-text document. NOT a binding: the body is a document, not a
 *  scalar, so it renders through the core exactly as `cms.ts` `articleBody()` does. */
export function articleBodyCore(className = 'w-full'): Node {
  return hostCore(HOST_KEYS.cmsArticleBody, className);
}

/**
 * An author card — portrait, name and bio, for the foot of the piece. The whole block is
 * gated on `authorBio` (a post with no author has none), so it appears only when there is
 * genuinely something to say about who wrote this. Classes carry the whole look.
 */
export function articleAuthorCard(opts: {
  cardClass: string;
  avatarClass: string;
  bodyClass?: string;
  nameClass: string;
  bioClass: string;
}): Node {
  return visibleWhen(
    el('div', opts.cardClass, {
      children: [
        visibleWhen(
          bind(atom('Image', opts.avatarClass, { src: PLACEHOLDER_IMAGE, alt: '' }), 'authorAvatar'),
          'authorAvatar'
        ),
        el('div', opts.bodyClass ?? 'flex flex-col gap-1', {
          children: [
            bind(el('span', opts.nameClass, { text: 'Author name' }), 'authorName'),
            bind(el('p', opts.bioClass, { text: 'About the author.' }), 'authorBio'),
          ],
        }),
      ],
    }),
    'authorBio'
  );
}

// ── Page assembly ─────────────────────────────────────────────────────────────

/**
 * Assemble a full article-detail PAGE body from a template's authored HEADER region.
 *
 * `header` is the template's whole bespoke masthead — its rubric + title + standfirst +
 * byline + featured image, laid out however the publication wants, authored UNSCOPED. This
 * wraps it in `repeat(_, 'blog_post')` so the routed post becomes the scope every bound
 * primitive resolves against (a collection-of-one, exactly like `cms.ts` `blogPostPage`),
 * then appends the written body core and — unless suppressed — a "keep reading" way out.
 * Author the header UNSCOPED: the scope is applied here, once, so a template never has to
 * remember to wrap it (forgetting is the failure mode — unscoped binds render placeholders).
 *
 * `foot` is an optional block BELOW the body but still INSIDE the post scope — an author
 * card, a tag row — so its binds resolve against the same post. `backHref` is where the
 * "keep reading" link points (default `/journal`, the bundle's article index; NOT `/blog`,
 * which the record route owns). Pass `back: null` for a template that ends its own way.
 */
export function articlePage(
  header: Node,
  opts: { bodyClass?: string; foot?: Node | null; back?: Node | null; backHref?: string } = {}
): Node {
  const back =
    opts.back === null
      ? null
      : (opts.back ?? defaultKeepReading(opts.backHref ?? '/journal'));
  return repeat(
    el('div', 'flex flex-col', {
      children: [
        header,
        articleBodyBand(opts.bodyClass),
        ...(opts.foot ? [opts.foot] : []),
        ...(back ? [back] : []),
      ],
    }),
    'blog_post'
  );
}

/** The body band — the article-body core on a prose measure. `max-w-3xl`, not the page's
 *  wider measure: this band is nothing but body text, and a line past ~75 characters is
 *  measurably harder to read (the same call `cms.ts` `articleBody` makes). */
function articleBodyBand(bodyClass?: string): Node {
  return el('section', 'w-full @container bg-base-100 text-base-content', {
    children: [
      el('div', bodyClass ?? 'mx-auto w-full max-w-3xl px-6 pb-20 @2xl:pb-24', {
        children: [articleBodyCore('w-full')],
      }),
    ],
  });
}

/** The default way out — a link back to the article index. A reader who finishes a post is
 *  otherwise at a dead end; this points at `/journal` (the bundle's index singleton), never
 *  `/blog` (the record route owns that segment and a singleton there 404s). */
function defaultKeepReading(href: string): Node {
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
                    attrs: { href },
                    text: 'More stories',
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
