// A piece of writing with no picture is drawn with no picture (P09). Her front page led
// with a new piece whose photograph had not arrived, and drew the platform's grey "an
// image goes here" art above its headline on the live site. A shop's grid keeps the
// placeholder: a product with no photograph beside four with one reads as a hole.

import { describe, expect, it } from 'vitest';
import { bind, el, repeat, toHtml, type DataScope, type Node } from '@wizeworks/silicaui-html';

import { PLACEHOLDER_IMAGE, PLACEHOLDER_IMAGE_SRC } from './placeholder';
import { finalizeTree, resolveForVisitors } from './render';

function card(imageRef: string) {
  return el('article', 'flex flex-col gap-3', {
    children: [
      bind(
        el('img', 'aspect-video w-full rounded-box object-cover', {
          attrs: { src: PLACEHOLDER_IMAGE, alt: '' },
        }),
        imageRef
      ),
      bind(el('h3', 'text-xl', { text: 'Headline' }), 'title'),
    ],
  });
}

// A post's picture is `featuredImage`; a product's is `image` (`binding.ts`).
function list(ref: string, imageRef = 'featuredImage'): Node {
  return el('section', 'grid gap-6', { children: [repeat(card(imageRef), ref)] });
}

function render(root: Node, items: Record<string, unknown>[]): string {
  const host = {
    resolveCollection: () => items,
    resolveBinding: (ref: string, scope: DataScope) => {
      const value = (scope.item as Record<string, unknown> | undefined)?.[ref];
      return value !== undefined ? { value } : undefined;
    },
  };
  return toHtml(finalizeTree(resolveForVisitors(root, host)));
}

const WITH = { title: 'The last mill on the Nene', featuredImage: 'https://cdn.test/mill.jpg' };
const WITHOUT = { title: 'Who pays when the malting barley fails', featuredImage: '' };

describe('a list of writing', () => {
  it('leaves out the picture of a piece that has none', () => {
    const html = render(list('cms.article'), [WITHOUT, WITH]);
    expect(html).toContain('Who pays when the malting barley fails');
    expect(html).not.toContain(PLACEHOLDER_IMAGE_SRC);
    expect(html.match(/<img/g)).toHaveLength(1);
    expect(html).toContain('https://cdn.test/mill.jpg');
  });

  it('carries no marker onto the page', () => {
    expect(render(list('cms.article'), [WITHOUT, WITH])).not.toContain('data-drop-when-empty');
  });
});

describe('a post page', () => {
  it('leaves out the picture of a post that has none, outside any list', () => {
    const page = el('main', 'flex flex-col', { children: [card('featuredImage')] });
    const html = render(page, []);
    expect(html).toContain('Headline');
    expect(html).not.toContain('<img');
  });
});

describe('a shop list', () => {
  it('keeps the placeholder for a product with no photograph', () => {
    const html = render(list('commerce.product', 'image'), [{ title: 'Linen apron', image: '' }]);
    expect(html).toContain(PLACEHOLDER_IMAGE_SRC);
  });
});
