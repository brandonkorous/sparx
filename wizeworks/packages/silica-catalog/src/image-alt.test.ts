import { describe, expect, it } from 'vitest';
import { atom, el } from '@wizeworks/silicaui-html';

import { fillImageAlt } from './image-alt';

const ALTS = new Map([
  ['https://media.sparx.works/v1/public/media/abc', 'The Marlow Knit in Oat, laid flat.'],
]);
const SRC = 'https://media.sparx.works/v1/public/media/abc';

describe('fillImageAlt', () => {
  it('gives the Image atom the sentence its record carried', () => {
    const { props } = fillImageAlt(
      atom('Image', 'w-full', { src: SRC, alt: 'Product image' }),
      ALTS
    ) as { props: Record<string, unknown> };
    expect(props.alt).toBe('The Marlow Knit in Oat, laid flat.');
    expect(props.src).toBe(SRC);
  });

  it('does the same for a raw <img>, whoever dropped it in', () => {
    const { attrs } = fillImageAlt(el('img', '', { attrs: { src: SRC } }), ALTS) as {
      attrs: Record<string, unknown>;
    };
    expect(attrs.alt).toBe('The Marlow Knit in Oat, laid flat.');
  });

  it('matches on the src without its width — responsiveImages may have added one', () => {
    const { props } = fillImageAlt(
      atom('Image', '', { src: `${SRC}?w=800`, alt: 'Product image' }),
      ALTS
    ) as { props: Record<string, unknown> };
    expect(props.alt).toBe('The Marlow Knit in Oat, laid flat.');
  });

  it('matches when the RECORD url carries a query too — both sides are signed', () => {
    const signed = new Map([[`${SRC}?tenant=juniper-row`, 'The Marlow Knit in Oat, laid flat.']]);
    const { props } = fillImageAlt(
      atom('Image', '', { src: `${SRC}?tenant=juniper-row&w=800`, alt: 'Product image' }),
      signed
    ) as { props: Record<string, unknown> };
    expect(props.alt).toBe('The Marlow Knit in Oat, laid flat.');
  });

  it('leaves an alt somebody actually WROTE alone — they were looking at the page', () => {
    const { props } = fillImageAlt(
      atom('Image', '', { src: SRC, alt: 'Our best seller, on the model' }),
      ALTS
    ) as { props: Record<string, unknown> };
    expect(props.alt).toBe('Our best seller, on the model');
  });

  it('replaces every generic stand-in, not just the exact one the catalog authors', () => {
    for (const generic of ['Product image', 'image', 'PHOTO', ' Picture ', '']) {
      const { props } = fillImageAlt(atom('Image', '', { src: SRC, alt: generic }), ALTS) as {
        props: Record<string, unknown>;
      };
      expect(props.alt, generic).toBe('The Marlow Knit in Oat, laid flat.');
    }
  });

  it('heals an image nested anywhere in the tree', () => {
    const tree = el('section', '', {
      children: [
        el('div', '', { children: [atom('Image', '', { src: SRC, alt: 'Product image' })] }),
      ],
    });
    expect(JSON.stringify(fillImageAlt(tree, ALTS))).toContain('laid flat');
  });

  it('is a no-op with nothing to say — same object back', () => {
    const tree = el('div', '', {
      children: [atom('Image', '', { src: SRC, alt: 'Product image' })],
    });
    expect(fillImageAlt(tree, new Map())).toBe(tree);
    expect(fillImageAlt(tree, new Map([['https://elsewhere/x', 'other']]))).toBe(tree);
  });

  it('leaves a subtree it did not touch as the SAME object', () => {
    const untouched = el('footer', 'p-4', { children: [el('p', '', { text: 'c' })] });
    const root = fillImageAlt(
      el('div', '', {
        children: [atom('Image', '', { src: SRC, alt: 'Product image' }), untouched],
      }),
      ALTS
    ) as { children: unknown[] };
    expect(root.children[1]).toBe(untouched);
  });

  it('says nothing about an image with no src — there is nothing to match on', () => {
    const node = atom('Image', '', { alt: 'Product image' });
    expect(fillImageAlt(node, ALTS)).toBe(node);
  });
});
