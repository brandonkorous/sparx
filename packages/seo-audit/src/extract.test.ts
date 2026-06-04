import { describe, it, expect } from 'vitest';

import { extractBuilderTreeSignals, extractCmsDocSignals } from './extract';

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
          content: [{ type: 'sparxReference', attrs: { entryId: 'e1', typeKey: 'post', label: 'X' } }],
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

  it('returns empty signals for a non-doc', () => {
    expect(extractCmsDocSignals({}).wordCount).toBe(0);
    expect(extractCmsDocSignals(undefined).h1Count).toBe(0);
  });
});
