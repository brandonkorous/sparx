import { describe, expect, it } from 'vitest';
import { DEFAULT_BOX, DEFAULT_LAYOUT, type BuilderNode } from '@sparx/builder-schemas';
import { renderEmailTree } from '../render-email-tree';

const brand = { primary: '#0EA5E9', storeName: 'Acme Diesel' };

function node(type: string, over: Partial<BuilderNode> = {}): BuilderNode {
  return { id: `${type}-1`, type, box: { ...DEFAULT_BOX }, props: {}, ...over };
}

describe('renderEmailTree', () => {
  it('renders a static body tree inside the branded frame', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      box: { ...DEFAULT_BOX },
      layout: { ...DEFAULT_LAYOUT, direction: 'stack' },
      props: {},
      children: [
        node('Heading', { props: { level: 'h1', text: 'Welcome aboard' } }),
        node('Text', { props: { variant: 'body', text: 'Thanks for joining us.' } }),
        node('Button', { props: { label: 'Get started', href: 'https://example.com/start' } }),
      ],
    };
    const out = await renderEmailTree(
      { tree, subject: 'Welcome', preheader: 'You are in', to: 'x@y.com' },
      { brand }
    );
    expect(out.html).toContain('Welcome aboard');
    expect(out.html).toContain('Thanks for joining us.');
    expect(out.html).toContain('Get started');
    expect(out.html).toContain('https://example.com/start');
    expect(out.html).toContain('Acme Diesel'); // footer wordmark fallback
    expect(out.text).toContain('Thanks for joining us.');
    expect(out.subject).toBe('Welcome');
  });

  it('iterates a container bound to an array (cardinality parity with storefront)', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      box: { ...DEFAULT_BOX },
      layout: { ...DEFAULT_LAYOUT, direction: 'stack' },
      props: {},
      binding: { path: 'commerce.product' },
      children: [node('Heading', { props: { level: 'h2' }, binding: { path: 'item.title' } })],
    };
    const out = await renderEmailTree(
      {
        tree,
        subject: 'Picks',
        to: 'x@y.com',
        // DataSources are nested by module — resolvePath splits the binding path
        // on '.', so `commerce.product` reads root.commerce.product.
        data: { commerce: { product: [{ title: 'Widget A' }, { title: 'Widget B' }] } },
      },
      { brand }
    );
    expect(out.html).toContain('Widget A');
    expect(out.html).toContain('Widget B');
  });
});
