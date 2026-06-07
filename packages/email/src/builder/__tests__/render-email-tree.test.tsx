import { describe, expect, it } from 'vitest';
import { type BuilderNode } from '@sparx/builder-schemas';
import { renderEmailTree } from '../render-email-tree';

const brand = { primary: '#0EA5E9', storeName: 'Acme Diesel' };

function node(type: string, over: Partial<BuilderNode> = {}): BuilderNode {
  return { id: `${type}-1`, type, props: {}, ...over };
}

describe('renderEmailTree', () => {
  it('renders a static body tree inside the branded frame', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
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
      class: 'flex flex-col',
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

  it('renders per-recipient bindings + a bound image (personalization)', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        // A per-recipient greeting bound to recipient.firstName.
        node('Heading', { props: { level: 'h1' }, binding: { path: 'recipient.firstName' } }),
        // A bound product image (ImageDisplay) iterated by the grid below.
        node('Grid', {
          props: {},
          class: 'grid grid-cols-2',
          binding: { path: 'commerce.product' },
          children: [node('ImageDisplay', { props: {}, binding: { path: 'item.imageUrl' } })],
        }),
      ],
    };
    const out = await renderEmailTree(
      {
        tree,
        subject: 'Hi',
        to: 'x@y.com',
        data: {
          recipient: { firstName: 'Dana' },
          commerce: {
            product: [{ imageUrl: 'https://cdn.example.com/a.png' }, { imageUrl: '' }],
          },
        },
      },
      { brand }
    );
    expect(out.html).toContain('Dana');
    expect(out.html).toContain('https://cdn.example.com/a.png');
  });

  it('serializes an authored Prose doc to sanitised HTML', async () => {
    const doc = {
      type: 'doc',
      content: [
        { type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text: 'Big news' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'Hello ' },
            { type: 'text', marks: [{ type: 'bold' }], text: 'world' },
            { type: 'text', text: '. Visit ' },
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
              text: 'us',
            },
            // A hostile link: the audited serializer must drop the protocol.
            {
              type: 'text',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
              text: 'danger',
            },
          ],
        },
        {
          type: 'bulletList',
          content: [
            {
              type: 'listItem',
              content: [{ type: 'paragraph', content: [{ type: 'text', text: 'First point' }] }],
            },
          ],
        },
      ],
    };
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [node('Prose', { props: { doc } })],
    };
    const out = await renderEmailTree({ tree, subject: 'News', to: 'x@y.com' }, { brand });
    expect(out.html).toContain('Big news');
    expect(out.html).toContain('<strong>world</strong>');
    // safeHref normalizes via new URL() (a trailing slash may be added).
    expect(out.html).toContain('href="https://example.com');
    expect(out.html).toContain('First point');
    // Sanitization is in the path — the javascript: link is stripped to plain text.
    expect(out.html).not.toContain('javascript:');
    expect(out.html).toContain('danger');
    // Plain-text generation walks the same HTML (headings get uppercased there).
    expect(out.text).toContain('Hello world');
  });

  it('omits an empty Prose node', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        node('Prose', { props: { doc: { type: 'doc', content: [] } } }),
        node('Text', { props: { variant: 'body', text: 'Only this shows.' } }),
      ],
    };
    const out = await renderEmailTree({ tree, subject: 'Hi', to: 'x@y.com' }, { brand });
    expect(out.html).toContain('Only this shows.');
  });
});
