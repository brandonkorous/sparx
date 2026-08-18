import { describe, it, expect } from 'vitest';

import {
  extractBuilderTreeSignals,
  extractCmsDocSignals,
  extractSilicaTreeSignals,
} from './extract';

// ── The silica tree — what the CURRENT builder actually writes ────────────────
//
// The regression these lock: a silica page graded through `extractBuilderTreeSignals`
// returns ALL ZEROES, because nothing in a silica tree has `type: 'Heading'`. That is
// not a near-miss — it is a scorecard confidently reporting "no H1, no words, no links,
// no images" about a page full of all four, and it is the only signal a non-technical
// owner gets about whether their page can be found at all.

describe('extractSilicaTreeSignals', () => {
  const page = {
    kind: 'element',
    tag: 'section',
    children: [
      { kind: 'element', tag: 'h1', children: ['The Main Title'] }, // 3 words, 1 H1
      { kind: 'element', tag: 'h2', children: ['A subsection here'] }, // 3 words
      { kind: 'element', tag: 'p', children: ['Some body copy with five words.'] }, // 6 words
      { kind: 'element', tag: 'img', attrs: { alt: 'A described image' } }, // alt ok
      { kind: 'element', tag: 'img', attrs: { alt: '' } }, // missing alt
      { kind: 'element', tag: 'img' }, // missing alt
      { kind: 'element', tag: 'a', attrs: { href: '/products' }, children: ['Shop now'] }, // 2 words, internal
      { kind: 'element', tag: 'a', attrs: { href: 'https://x.com' }, children: ['External'] }, // 1 word, external
    ],
  };

  it('counts H1s, words, images-missing-alt, and internal links', () => {
    const s = extractSilicaTreeSignals(page);
    expect(s.h1Count).toBe(1);
    expect(s.imageCount).toBe(3);
    expect(s.imagesMissingAlt).toBe(2);
    expect(s.internalLinkCount).toBe(1);
    expect(s.wordCount).toBe(3 + 3 + 6 + 2 + 1);
  });

  it('the LEGACY extractor sees nothing in the same tree (why this exists)', () => {
    const s = extractBuilderTreeSignals(page);
    expect(s.h1Count).toBe(0);
    expect(s.wordCount).toBe(0);
    expect(s.imageCount).toBe(0);
    expect(s.internalLinkCount).toBe(0);
  });

  it('reads copy off silica COMPONENT atoms, which carry it in props not children', () => {
    const tree = {
      kind: 'element',
      tag: 'div',
      children: [
        { kind: 'component', component: 'Button', props: { label: 'Buy now', href: '/cart' } },
        { kind: 'component', component: 'Image', props: { alt: '' } },
        { kind: 'component', component: 'Image', props: { alt: 'A product photo' } },
      ],
    };
    const s = extractSilicaTreeSignals(tree);
    expect(s.wordCount).toBe(2);
    expect(s.internalLinkCount).toBe(1);
    expect(s.imageCount).toBe(2);
    expect(s.imagesMissingAlt).toBe(1);
  });

  it('recurses arbitrarily deep, so a heading inside nested wrappers still counts', () => {
    const tree = {
      kind: 'element',
      tag: 'div',
      children: [
        {
          kind: 'element',
          tag: 'section',
          children: [
            {
              kind: 'element',
              tag: 'div',
              children: [{ kind: 'element', tag: 'h1', children: ['Deep'] }],
            },
          ],
        },
      ],
    };
    expect(extractSilicaTreeSignals(tree).h1Count).toBe(1);
  });

  it('ignores outlet and host nodes — they carry no authored copy', () => {
    const tree = {
      kind: 'element',
      tag: 'div',
      children: [{ kind: 'outlet' }, { kind: 'host', component: 'commerce.cart' }],
    };
    const s = extractSilicaTreeSignals(tree);
    expect(s.wordCount).toBe(0);
    expect(s.h1Count).toBe(0);
  });

  it('survives junk without throwing (a tree is opaque JSON from the database)', () => {
    expect(extractSilicaTreeSignals(null).wordCount).toBe(0);
    expect(extractSilicaTreeSignals(undefined).wordCount).toBe(0);
    expect(extractSilicaTreeSignals('nonsense').wordCount).toBe(1);
    expect(extractSilicaTreeSignals({ kind: 'element' }).h1Count).toBe(0);
  });
});

describe('extractBuilderTreeSignals', () => {
  it('counts H1s, words, images-missing-alt, and internal links across the tree', () => {
    const tree = {
      type: 'Section',
      props: {},
      children: [
        { type: 'Heading', props: { level: 'h1', text: 'The Main Title' } }, // 3 words, 1 H1
        { type: 'Heading', props: { level: 'h2', text: 'A subsection here' } }, // 3 words
        { type: 'Text', props: { text: 'Some body copy with five words.' } }, // 6 words
        { type: 'Image', props: { alt: 'A described image' } }, // alt ok
        { type: 'Image', props: { alt: '' } }, // missing alt
        { type: 'Image', props: {} }, // missing alt
        { type: 'Button', props: { label: 'Shop now', href: '/products' } }, // 2 words, internal
        { type: 'Button', props: { label: 'External', href: 'https://x.com' } }, // 1 word, external
      ],
    };
    const s = extractBuilderTreeSignals(tree);
    expect(s.h1Count).toBe(1);
    expect(s.imageCount).toBe(3);
    expect(s.imagesMissingAlt).toBe(2);
    expect(s.internalLinkCount).toBe(1);
    expect(s.wordCount).toBe(3 + 3 + 6 + 2 + 1);
  });

  it('recurses nested children and counts a button nested in a section', () => {
    const tree = {
      type: 'Section',
      props: {},
      children: [
        {
          type: 'Stack',
          props: {},
          children: [{ type: 'Heading', props: { level: 'h1', text: 'Nested' } }],
        },
      ],
    };
    expect(extractBuilderTreeSignals(tree).h1Count).toBe(1);
  });

  it('is null-safe on garbage input', () => {
    expect(extractBuilderTreeSignals(null)).toEqual({
      h1Count: 0,
      wordCount: 0,
      imageCount: 0,
      imagesMissingAlt: 0,
      internalLinkCount: 0,
    });
    expect(extractBuilderTreeSignals({ type: 'Heading' }).h1Count).toBe(0);
  });
});

describe('extractCmsDocSignals', () => {
  it('walks a TipTap doc for headings, images, links, and word count', () => {
    const doc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Diesel Maintenance Guide' }], // 3 words, 1 H1
        },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'See our ' }, // 2 words
            {
              type: 'text',
              text: 'related guide',
              marks: [{ type: 'link', attrs: { href: '/guides/oil' } }], // 2 words, internal link
            },
            { type: 'text', text: ' for more.' }, // 2 words
          ],
        },
        { type: 'image', attrs: { src: 'https://x/a.jpg', alt: 'An engine' } }, // alt ok
        { type: 'sparxImage', attrs: { src: 'https://x/b.jpg' } }, // missing alt
        {
          type: 'paragraph',
          content: [
            { type: 'sparxReference', attrs: { entryId: 'e1', typeKey: 'post', label: 'X' } },
          ],
        },
      ],
    };
    const s = extractCmsDocSignals(doc);
    expect(s.h1Count).toBe(1);
    expect(s.imageCount).toBe(2);
    expect(s.imagesMissingAlt).toBe(1);
    expect(s.internalLinkCount).toBe(2); // one link mark + one sparxReference
    expect(s.wordCount).toBe(3 + 2 + 2 + 2);
  });

  it('finds the doc inside a field bag (ContentEntry.body wraps fields)', () => {
    // body is a field bag; the rich-text doc lives in a field (here `content`).
    const body = {
      title: 'Page Title',
      content: {
        type: 'doc',
        content: [
          {
            type: 'heading',
            attrs: { level: 1 },
            content: [{ type: 'text', text: 'Hello World' }],
          },
        ],
      },
    };
    const s = extractCmsDocSignals(body);
    expect(s.h1Count).toBe(1);
    expect(s.wordCount).toBe(2);
  });

  it('returns empty signals for a non-doc', () => {
    expect(extractCmsDocSignals({}).wordCount).toBe(0);
    expect(extractCmsDocSignals(undefined).h1Count).toBe(0);
  });
});
