// View HTML serializer (docs/98 §3.8/§4.2) — asserts the output is the CLEAN
// publish markup: raw elements render AS their tag with node.class, NO editor
// chrome (`data-node-id`, `.bx-node`, selection rings), and the shared renderLeaf
// drives leaf content.

import { describe, expect, it } from 'vitest';
import type { BuilderNode } from '@sparx/builder-schemas';

import { serializeNodeToHtml, serializeTreeToHtml } from './serialize-html';

function node(partial: Partial<BuilderNode> & { type: string }): BuilderNode {
  return { id: partial.type.toLowerCase(), props: {}, ...partial };
}

describe('serializeNodeToHtml — raw elements', () => {
  it('renders a raw element AS its tag, carrying node.class', () => {
    const html = serializeNodeToHtml(
      node({ id: 'a', type: 'el:section', class: 'py-10 bg-base-100' }),
      { pretty: false }
    );
    expect(html).toBe('<section class="py-10 bg-base-100"></section>');
  });

  it('nests children and preserves the tree shape', () => {
    const tree = node({
      id: 'sec',
      type: 'el:section',
      class: 'p-4',
      children: [
        node({ id: 'h', type: 'el:h1', class: 'text-2xl', props: { text: 'Title' } }),
        node({ id: 'p', type: 'el:p', props: { text: 'Body copy' } }),
      ],
    });
    const html = serializeNodeToHtml(tree, { pretty: false });
    expect(html).toContain('<section class="p-4">');
    expect(html).toContain('<h1 class="text-2xl">Title</h1>');
    expect(html).toContain('<p>Body copy</p>');
  });

  it('serializes sanitized attributes and forces rel on _blank links', () => {
    const html = serializeNodeToHtml(
      node({
        id: 'a',
        type: 'el:a',
        class: 'underline',
        props: { href: 'https://x.test', target: '_blank', text: 'Go' },
      }),
      { pretty: false }
    );
    expect(html).toContain('href="https://x.test"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('drops a dangerous href scheme via the shared sanitizer', () => {
    const html = serializeNodeToHtml(
      node({ id: 'a', type: 'el:a', props: { href: 'javascript:alert(1)', text: 'x' } }),
      { pretty: false }
    );
    expect(html).not.toContain('javascript:');
  });

  it('renders a void element self-closed with no children', () => {
    const html = serializeNodeToHtml(
      node({ id: 'img', type: 'el:img', class: 'w-full', props: { src: '/a.jpg', alt: 'A' } }),
      { pretty: false }
    );
    expect(html).toContain('<img');
    expect(html).toContain('src="/a.jpg"');
    expect(html).toContain('alt="A"');
  });
});

describe('serializeNodeToHtml — no editor chrome', () => {
  it('emits no data-node-id / bx-node / selection chrome', () => {
    const tree = node({
      id: 'root',
      type: 'el:div',
      class: 'grid',
      children: [node({ id: 'c', type: 'el:span', props: { text: 'hi' } })],
    });
    const html = serializeNodeToHtml(tree);
    expect(html).not.toContain('data-node-id');
    expect(html).not.toContain('bx-node');
    expect(html).not.toContain('data-bx-type');
    expect(html).not.toContain('contenteditable');
  });
});

describe('serializeTreeToHtml', () => {
  it('serializes a page tree by its children (drops the editor root wrapper)', () => {
    const tree = node({
      id: 'page',
      type: 'el:div',
      class: 'page-root',
      children: [
        node({ id: 's1', type: 'el:section', class: 'a' }),
        node({ id: 's2', type: 'el:section', class: 'b' }),
      ],
    });
    const html = serializeTreeToHtml(tree, { pretty: false });
    // The two sections appear; the root wrapper's own class does not lead the output.
    expect(html).toBe('<section class="a"></section><section class="b"></section>');
  });

  it('pretty-prints with indentation by default', () => {
    const tree = node({
      id: 'root',
      type: 'el:section',
      children: [node({ id: 'p', type: 'el:p', props: { text: 'x' } })],
    });
    const html = serializeNodeToHtml(tree);
    expect(html).toContain('\n');
    // The <p> is indented one level under <section>.
    expect(html).toMatch(/<section>\n {2}<p>x<\/p>\n<\/section>/);
  });
});

describe('serialize — curated leaves go through renderLeaf', () => {
  it('renders a Heading leaf as a real heading element wearing its class', () => {
    const html = serializeNodeToHtml(
      node({ id: 'h', type: 'Heading', class: 'h2', props: { level: 'h2', text: 'Hello' } }),
      { pretty: false }
    );
    expect(html).toContain('Hello');
    expect(html.toLowerCase()).toContain('<h2');
  });
});
