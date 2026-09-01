// What the canvas puts on an element, and the two things it used to get wrong.
//
// Both were found while an owner built her About page. The section shelf ships every
// placeholder picture as `src: ''` so a block reads as a real design the moment it is
// dropped — and the canvas rendered that empty string, which makes a browser re-request
// the whole studio page, once per picture. The publish path has scrubbed empty URL
// attributes for a long time (`dropEmptyUrlAttrs`); the canvas never did.
//
// The second is quieter and worse: `img` is a void tag, and the canvas applied a bound
// attribute AFTER its void-tag early return. So a bound product photo drew a placeholder
// on the canvas and the real picture on the live page, on every product card on the
// shelf, with nothing on screen to say why.

import { describe, expect, it } from 'vitest';
import { attributeProps } from './render-node';

describe('empty URL attributes are dropped, as the live page drops them', () => {
  it('leaves off a placeholder picture with no source', () => {
    expect(attributeProps({ src: '', alt: 'A studio' })).toEqual({ alt: 'A studio' });
  });

  it('leaves off a half-finished link', () => {
    expect(attributeProps({ href: '' })).toEqual({});
  });

  it('keeps an empty alt, which is how a decorative image is marked', () => {
    expect(attributeProps({ src: '/a.png', alt: '' })).toEqual({ src: '/a.png', alt: '' });
  });

  it('keeps an empty value, which is a legitimately empty field', () => {
    expect(attributeProps({ value: '' })).toEqual({ value: '' });
  });

  it('keeps a real URL', () => {
    expect(attributeProps({ src: '/photo.jpg' })).toEqual({ src: '/photo.jpg' });
  });
});

describe('a bound attribute reaches a VOID tag', () => {
  it('fills a product image whose src is bound — the case img being void broke', () => {
    expect(attributeProps({ src: '', alt: 'Product' }, { key: 'src', value: '/real.jpg' })).toEqual(
      {
        src: '/real.jpg',
        alt: 'Product',
      }
    );
  });

  it('lets the bound value win over the authored one', () => {
    expect(attributeProps({ src: '/placeholder.svg' }, { key: 'src', value: '/real.jpg' })).toEqual(
      {
        src: '/real.jpg',
      }
    );
  });

  it('drops a binding that resolves to an empty URL, same as an authored one', () => {
    expect(attributeProps({ href: '/fallback' }, { key: 'href', value: '' })).toEqual({});
  });

  it('changes nothing when there is no binding', () => {
    expect(attributeProps({ src: '/a.jpg' }, undefined)).toEqual({ src: '/a.jpg' });
  });
});
