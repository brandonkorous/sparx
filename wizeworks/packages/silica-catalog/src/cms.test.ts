// Locks the blog-post composite against the REAL silica engine.
//
// The failures this guards are all SILENT ones — none of them throws, and every one
// of them ships a page that looks finished until you read it:
//   · the root losing its `blog_post` scope, so every field renders its placeholder;
//   · the body core going missing, so the post page renders everything except the post;
//   · a placeholder going empty, so the studio canvas shows blank regions;
//   · `starterCollectionDto` losing the `cms.blog_post` case, which is how posts fell
//     through to the bare fallback in the first place.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope, type ResolveHost } from '@wizeworks/silicaui-html';

import { blogPostPage } from './cms';
import { HOST_KEYS } from './host-nodes';

// The record shape the storefront injects (`postToBuilderRecord`). `body` is absent on
// purpose: it is a rich-text DOCUMENT that renders through the host core, never a bind.
const POST = {
  title: 'What belongs on your homepage',
  excerpt: 'Less than you think, in a clearer order.',
  date: '14 July 2026',
  featuredImage: '/desk.jpg',
};

const host: ResolveHost = {
  resolveBinding(ref: string, scope: DataScope) {
    const item = scope.item as Record<string, unknown> | undefined;
    return { value: item?.[ref] };
  },
  resolveCollection(ref: string) {
    // An object source arrives as a collection-of-one — the same shape the buy box's
    // `product` scope uses.
    return ref === 'blog_post' ? [POST] : [];
  },
};

/** Every `value` ref carried anywhere in a subtree, in document order. */
function valueRefs(node: unknown, out: string[] = []): string[] {
  const n = node as { data?: { kind?: string; ref?: string }; children?: unknown[] };
  if (n?.data?.kind === 'value' && n.data.ref) out.push(n.data.ref);
  for (const c of n?.children ?? []) if (c && typeof c === 'object') valueRefs(c, out);
  return out;
}

/** Every host-core key mounted anywhere in a subtree. */
function hostKeys(node: unknown, out: string[] = []): string[] {
  const n = node as { kind?: string; component?: string; children?: unknown[] };
  if (n?.kind === 'host' && n.component) out.push(n.component);
  for (const c of n?.children ?? []) if (c && typeof c === 'object') hostKeys(c, out);
  return out;
}

describe('blogPostPage — the default cms.blog_post template', () => {
  it('scopes its ROOT to the blog_post record', () => {
    const root = blogPostPage() as { data?: { kind?: string; ref?: string } };
    expect(root.data?.kind).toBe('collection');
    expect(root.data?.ref).toBe('blog_post');
  });

  it('binds scope-relative SHORT refs, never a dotted root path', () => {
    const refs = valueRefs(blogPostPage());
    expect(refs).toEqual(expect.arrayContaining(['title', 'excerpt', 'date', 'featuredImage']));
    expect(refs.every((r) => !r.includes('.'))).toBe(true);
  });

  it('mounts the pinned article-body core, and pins it', () => {
    expect(hostKeys(blogPostPage())).toContain(HOST_KEYS.cmsArticleBody);
    const core = findHost(blogPostPage());
    // Unlocked, the studio would let an author delete the one node that renders the
    // post — leaving a template that shows a headline and an image and no article.
    expect(core?.locked).toBe('host');
  });

  it('never binds `body` — a rich-text doc is not a value bind', () => {
    expect(valueRefs(blogPostPage())).not.toContain('body');
  });

  it('resolves the real record through the engine', () => {
    const html = toHtml(resolveTree(blogPostPage(), host));
    expect(html).toContain('What belongs on your homepage');
    expect(html).toContain('Less than you think, in a clearer order.');
    expect(html).toContain('14 July 2026');
  });

  it('fills the featured image into an <img src>, not text', () => {
    const html = toHtml(resolveTree(blogPostPage(), host));
    expect(html).toContain('src="/desk.jpg"');
  });

  it('leaves the reader a route back to the index', () => {
    expect(toHtml(resolveTree(blogPostPage(), host))).toContain('href="/blog"');
  });

  // The canvas has NO record in scope, so these strings are the only thing an author
  // sees. Shipped empty once already: the template rendered as a floating headline
  // over two blank regions.
  it('carries legible placeholders for the unbound studio canvas', () => {
    const html = toHtml(blogPostPage());
    expect(html).toContain('Post title');
    expect(html).toContain('Published date');
    expect(html).toMatch(/summary of this post/i);
  });

  // A reader meets one left edge down the whole post, or the page reads as broken.
  //
  // Every band centres its own inner box with `mx-auto`, so the box's measure IS the
  // page's left edge: a narrower measure moves the edge inward by half the difference.
  // `articleBody` carried `max-w-3xl` on the BAND while its three neighbours carried
  // `max-w-5xl`, which put the written body (1024-768)/2 = 128px to the right of the
  // headline above it, on every post on every tenant rendering from this factory
  // (issue 339). The measure the prose needs is real; capping it on the CORE keeps it
  // without moving the band.
  it('gives every band on the post one left edge', () => {
    const measures = bandMeasures(blogPostPage());
    expect(measures).toEqual(['5xl', '5xl', '5xl', '5xl']);
  });

  // The other half of the same fix, and the reason it is not simply "widen the body":
  // a line much past ~75 characters is measurably harder to read, so the cap has to
  // survive somewhere. Asserted on the core itself, where it no longer moves the band.
  it('still caps the prose at a reading measure', () => {
    expect(toHtml(blogPostPage())).toMatch(
      /class="[^"]*max-w-3xl[^"]*"[^>]*data-sui-host="cms.article-body"/
    );
  });
});

/** The `max-w-*` on each band's own centred inner box, in document order — the thing
 *  that decides where that band's content starts.
 *
 *  Read off the EMITTED HTML rather than the node tree. The first version of this walked
 *  the tree for a `class` property, found nothing on any band, and returned four
 *  identical `'none'`s — which is a set of size one, so it passed against the very code
 *  it was written to catch. Asserting on what actually ships has no such hole, and the
 *  expected value is spelled out in full so an empty result cannot read as agreement. */
function bandMeasures(node: Parameters<typeof toHtml>[0]): string[] {
  const bands = toHtml(node).matchAll(/<section[^>]*>\s*<div class="([^"]*)"/g);
  return [...bands].map((m) => /max-w-(\S+?)(?:\s|$)/.exec(m[1] ?? '')?.[1] ?? 'none');
}

/** The first host node in a subtree, with its lock state. */
function findHost(node: unknown): { locked?: string } | undefined {
  const n = node as { kind?: string; locked?: string; children?: unknown[] };
  if (n?.kind === 'host') return n;
  for (const c of n?.children ?? []) {
    if (c && typeof c === 'object') {
      const found = findHost(c);
      if (found) return found;
    }
  }
  return undefined;
}
