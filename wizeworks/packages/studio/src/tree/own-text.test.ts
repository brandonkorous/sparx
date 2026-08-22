import { describe, expect, it } from 'vitest';
import type { Child, Node } from '@wizeworks/silicaui-html';
import { ownText } from './walk';

// Which nodes can be typed into — the one test behind the Inspector's Words box
// and the canvas caret (issue #019). Getting it wrong in the generous direction
// silently deletes a subtree: writing text into a node that holds blocks
// replaces them.

const el = (tag: string, children?: Child[]): Node => ({ kind: 'element', tag, id: tag, children });

describe('ownText', () => {
  it('reads the words of a node that holds only words', () => {
    expect(ownText(el('h1', ['Thistle & Rye']))).toBe('Thistle & Rye');
  });

  it('joins split text, which is what a paste leaves behind', () => {
    expect(ownText(el('p', ['Sourdough, ', 'every day']))).toBe('Sourdough, every day');
  });

  it('treats an empty node as editable — it has words, there are none yet', () => {
    expect(ownText(el('p', []))).toBe('');
    expect(ownText(el('p'))).toBe('');
  });

  it('refuses a node holding blocks, whatever text sits beside them', () => {
    expect(ownText(el('div', ['Heading', el('p', ['body'])]))).toBeUndefined();
  });

  it('refuses an outlet, which is a marker rather than a node', () => {
    expect(ownText({ kind: 'outlet' })).toBeUndefined();
  });

  it('refuses a picture — a caret in an image is a caret nobody can type into', () => {
    expect(ownText(el('img'))).toBeUndefined();
  });

  it('refuses an empty layout box, which is waiting for blocks rather than words', () => {
    expect(ownText(el('div'))).toBeUndefined();
    expect(ownText(el('section'))).toBeUndefined();
  });

  it('accepts a component that carries its own label', () => {
    const button = { kind: 'component', component: 'Button', id: 'b', children: ['Order'] } as Node;
    expect(ownText(button)).toBe('Order');
  });
});
