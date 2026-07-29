import { atom, el, type ElementNode, type Node } from '@wizeworks/silicaui-html';
import { describe, expect, it } from 'vitest';

import { MEDIA_WIDTHS, responsiveImages } from './responsive-images';
import { renderSilicaBody } from './render';

const ID = '3f1b2c4d-5e6f-4a7b-8c9d-0e1f2a3b4c5d';
const RESOLVER = `https://api.sparx.works/v1/public/media/${ID}?tenant=acme`;

/** Pull one node's attributes out of a rewritten tree. */
function imgAttrs(node: Node): Record<string, unknown> {
  const found = find(node);
  if (!found) throw new Error('no <img> in tree');
  return found.attrs ?? {};
}

function find(node: Node): ElementNode | null {
  if (node.kind === 'element' && node.tag === 'img') return node;
  if (node.kind === 'outlet') return null;
  for (const child of node.children ?? []) {
    if (typeof child === 'string') continue;
    const hit = find(child);
    if (hit) return hit;
  }
  return null;
}

describe('responsiveImages', () => {
  it('offers the full ladder for a resolver-backed <img>', () => {
    const out = responsiveImages(el('img', 'w-full', { attrs: { src: RESOLVER, alt: 'A' } }));
    const attrs = imgAttrs(out);
    expect(attrs.srcset).toBe(MEDIA_WIDTHS.map((w) => `${RESOLVER}&w=${w} ${w}w`).join(', '));
    expect(attrs.sizes).toBe('100vw');
    // The original src is untouched, so a browser with no srcset support still works.
    expect(attrs.src).toBe(RESOLVER);
  });

  it('rewrites an Image ATOM, which is what a product card actually uses', () => {
    // The single most common image on any storefront is the product grid tile, and it
    // is an `Image` atom rather than an `<img>`. The walk sets PROPS and leaves the
    // node a component — silica's own `expand` lowers them (0.36.0 forwards
    // srcset/sizes; before that it dropped them, and this walk had to pre-expand).
    const card = el('div', 'grid', {
      children: [atom('Image', 'aspect-square w-full object-cover', { src: RESOLVER, alt: 'P' })],
    });
    const out = responsiveImages(card);
    const img = out.kind === 'outlet' ? undefined : out.children?.[0];
    if (typeof img === 'string' || img?.kind !== 'component') throw new Error('not a component');
    expect(img.component).toBe('Image');
    expect(String(img.props?.srcset)).toContain('w=400 400w');
    expect(String(img.props?.srcset)).toContain('w=2000 2000w');
    expect(img.props?.sizes).toBe('100vw');
    // The node's KIND is unchanged — the old pre-expansion swapped a component for an
    // element mid-tree, which is exactly the hazard this rewrite removed.
    expect(img.class).toBe('aspect-square w-full object-cover');
  });

  it('lowers an atom ladder all the way to HTML', () => {
    // The half a props assertion cannot make: silica has to FORWARD srcset/sizes out of
    // `Image.expand`. If a future release stops, the props above still pass and every
    // product tile silently ships at full width again — so assert the rendered markup.
    const html = renderSilicaBody(
      el('main', '', {
        children: [atom('Image', 'aspect-square w-full', { src: RESOLVER, alt: 'P' })],
      })
    );
    expect(html).toContain('<img');
    expect(html).toContain('w=2000 2000w');
    expect(html).toContain('sizes="100vw"');
    // Lowering stays silica's: the class and its lazy-loading default survive.
    expect(html).toContain('aspect-square w-full');
    expect(html).toContain('loading="lazy"');
  });

  it('sizes a fixed-size image in pixels instead of 100vw', () => {
    // A 64px avatar with sizes="100vw" would still select the 2000px rung on a wide
    // display — the exact waste this file exists to remove.
    const out = responsiveImages(
      el('img', 'size-16 shrink-0 rounded-full object-cover', { attrs: { src: RESOLVER } })
    );
    expect(imgAttrs(out).sizes).toBe('64px');
  });

  it('does not read w-full or w-1/2 as a pixel width', () => {
    for (const cls of ['w-full', 'w-1/2 object-cover', 'h-auto w-full']) {
      const out = responsiveImages(el('img', cls, { attrs: { src: RESOLVER } }));
      expect(imgAttrs(out).sizes).toBe('100vw');
    }
  });

  it('leaves alone every source it cannot improve', () => {
    const untouched = [
      // Someone else's CDN — its `w` param means something else entirely.
      'https://images.unsplash.com/photo-123?w=1200',
      // Already a specific stored object; the variant route ignores `w`.
      `https://api.sparx.works/v1/public/media/variants/t/${ID}/webp-800.webp`,
      // Bytes are already inline.
      'data:image/svg+xml,%3Csvg%3E%3C/svg%3E',
      // No picture chosen yet.
      '',
    ];
    for (const src of untouched) {
      const node = el('img', 'w-full', { attrs: { src } });
      const out = responsiveImages(node);
      expect(out, src).toBe(node); // same reference — nothing rebuilt
    }
  });

  it('respects an authored srcset and an authored sizes', () => {
    const authored = responsiveImages(
      el('img', 'w-full', { attrs: { src: RESOLVER, srcset: 'a.jpg 1x' } })
    );
    expect(imgAttrs(authored).srcset).toBe('a.jpg 1x');

    const sized = responsiveImages(
      el('img', 'w-full', { attrs: { src: RESOLVER, sizes: '(min-width: 60rem) 33vw, 100vw' } })
    );
    expect(imgAttrs(sized).sizes).toBe('(min-width: 60rem) 33vw, 100vw');
    expect(String(imgAttrs(sized).srcset)).toContain('w=800 800w');
  });

  it('skips a URL that already pins a width', () => {
    // Four URLs that all resolve to the same file is not a choice, it is noise.
    const pinned = `${RESOLVER}&w=800`;
    const node = el('img', 'w-full', { attrs: { src: pinned } });
    expect(responsiveImages(node)).toBe(node);
  });

  it('returns the SAME tree when nothing matched', () => {
    const tree = el('section', 'py-16', {
      children: [el('h2', 'text-3xl', { text: 'No pictures here' })],
    });
    expect(responsiveImages(tree)).toBe(tree);
  });

  it('reaches images nested deep inside a page', () => {
    const deep = el('section', '', {
      children: [
        el('div', '', {
          children: [
            el('ul', '', {
              children: [
                el('li', '', { children: [el('img', 'w-full', { attrs: { src: RESOLVER } })] }),
              ],
            }),
          ],
        }),
      ],
    });
    expect(String(imgAttrs(responsiveImages(deep)).srcset)).toContain('w=1200 1200w');
  });

  it('lands in the rendered HTML through the real render seam', () => {
    // The transform is only worth anything if it survives `toHtml`'s sanitizer, which
    // runs `isSafeUrl` over `srcset` and enforces a per-tag attribute allowlist. A
    // stricter silicaui release that dropped either attribute would fail HERE rather
    // than shipping full-width images with a green test suite.
    const html = renderSilicaBody(
      el('main', '', { children: [el('img', 'w-full', { attrs: { src: RESOLVER, alt: 'Hero' } })] })
    );
    expect(html).toContain('srcset="');
    expect(html).toContain('sizes="100vw"');
    expect(html).toContain(`w=2000 2000w`);
  });
});
