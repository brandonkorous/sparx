import { describe, expect, it } from 'vitest';
import { sameDocument } from './same-document';

// Undo back to the saved page must read as saved (sparx persona issue 060).

const saved = {
  pages: [
    {
      id: 'home',
      root: {
        type: 'section',
        children: [
          { type: 'image', props: { src: '/shop.jpg', alt: 'The Gillett Diesel Service shop' } },
        ],
      },
    },
  ],
  theme: { primary: '#c62828' },
};

describe('sameDocument', () => {
  it('treats a property put back in a different place as the same page', () => {
    const undone = {
      theme: { primary: '#c62828' },
      pages: [
        {
          root: {
            children: [
              {
                props: { alt: 'The Gillett Diesel Service shop', src: '/shop.jpg' },
                type: 'image',
              },
            ],
            type: 'section',
          },
          id: 'home',
        },
      ],
    };
    expect(sameDocument(saved, undone)).toBe(true);
  });

  it('sees a swapped picture', () => {
    const swapped = structuredClone(saved);
    swapped.pages[0]!.root.children[0]!.props.src = '/banks-derringer.jpg';
    expect(sameDocument(saved, swapped)).toBe(false);
  });

  it('sees two children in a new order', () => {
    const a = { children: [{ id: 'a' }, { id: 'b' }] };
    const b = { children: [{ id: 'b' }, { id: 'a' }] };
    expect(sameDocument(a, b)).toBe(false);
  });

  it('counts a key holding undefined as absent', () => {
    expect(sameDocument({ alt: undefined, src: '/x.jpg' }, { src: '/x.jpg' })).toBe(true);
  });

  it('counts an empty collection as absent, the way the editor hands one back', () => {
    expect(sameDocument({ pages: [], symbols: {} }, { pages: [] })).toBe(true);
    expect(sameDocument({ symbols: { hero: { id: 'x' } } }, {})).toBe(false);
  });
});
