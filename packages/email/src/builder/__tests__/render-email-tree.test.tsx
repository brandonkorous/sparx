import { describe, expect, it } from 'vitest';
import { type BuilderNode } from '@sparx/builder-schemas';
import { renderEmailTree } from '../render-email-tree';

const brand = { primary: '#0EA5E9', siteName: 'Acme Diesel' };

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

  it('interpolates {{token}} merge fields (with ?? fallback) in copy + links', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        node('Heading', { props: { level: 'h1', text: 'Invoice {{invoice.number}}' } }),
        node('Text', {
          props: {
            variant: 'body',
            text: 'Hi {{customer.firstName ?? "there"}}, balance {{invoice.balance}}.',
          },
        }),
        node('Button', { props: { label: 'Pay now', href: '{{invoice.payUrl}}' } }),
      ],
    };
    const out = await renderEmailTree(
      {
        tree,
        subject: 'Due',
        to: 'x@y.com',
        data: {
          invoice: { number: 'INV-9', balance: '$500.00', payUrl: 'https://shop.test/pay/9' },
          customer: {}, // firstName missing → fallback
        },
      },
      { brand }
    );
    expect(out.html).toContain('Invoice INV-9');
    expect(out.html).toContain('Hi there, balance $500.00.');
    expect(out.html).toContain('https://shop.test/pay/9');
  });

  it('renders a line_item_table over a bound collection, empty → nothing', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        { id: 'lit', type: 'line_item_table', props: {}, binding: { path: 'invoice.items' } },
        node('Text', { props: { variant: 'body', text: 'After table' } }),
      ],
    };
    const out = await renderEmailTree(
      {
        tree,
        subject: 'X',
        to: 'x@y.com',
        data: {
          invoice: {
            items: [
              { description: 'Widget', quantity: 2, unitPrice: '$10.00', lineTotal: '$20.00' },
              { name: 'Gadget', quantity: 1, lineTotal: '$5.00' },
            ],
          },
        },
      },
      { brand }
    );
    expect(out.html).toContain('Widget');
    expect(out.html).toContain('× 2');
    expect(out.html).toContain('$20.00');
    expect(out.html).toContain('Gadget');

    // Absent collection → the table renders nothing but the page still composes.
    const empty = await renderEmailTree(
      { tree, subject: 'X', to: 'x@y.com', data: { invoice: { items: [] } } },
      { brand }
    );
    expect(empty.html).toContain('After table');
    expect(empty.html).not.toContain('× 2');
  });

  it('shows/hides a conditional_block on its when path', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        {
          id: 'cond',
          type: 'conditional_block',
          props: { when: 'b2bAccount.creditLimit' },
          children: [
            node('Text', {
              props: { variant: 'body', text: 'Credit line {{b2bAccount.creditLimit}}' },
            }),
          ],
        },
      ],
    };
    const shown = await renderEmailTree(
      { tree, subject: 'X', to: 'x@y.com', data: { b2bAccount: { creditLimit: '$5,000' } } },
      { brand }
    );
    expect(shown.html).toContain('Credit line $5,000');

    // Empty value → block hidden entirely.
    const hidden = await renderEmailTree(
      { tree, subject: 'X', to: 'x@y.com', data: { b2bAccount: { creditLimit: '' } } },
      { brand }
    );
    expect(hidden.html).not.toContain('Credit line');
  });

  it('renders unsubscribe_link + physical_address from the compliance context', async () => {
    const tree: BuilderNode = {
      id: 'root',
      type: 'Section',
      class: 'flex flex-col',
      props: {},
      children: [
        { id: 'u', type: 'unsubscribe_link', props: {} },
        { id: 'a', type: 'physical_address', props: {} },
      ],
    };
    const out = await renderEmailTree(
      {
        tree,
        subject: 'X',
        to: 'x@y.com',
        compliance: {
          unsubscribeUrl: 'https://api.test/v1/public/email/unsubscribe?t=abc',
          physicalAddress: '123 Main St, Visalia, CA',
        },
      },
      { brand }
    );
    expect(out.html).toContain('Unsubscribe');
    expect(out.html).toContain('https://api.test/v1/public/email/unsubscribe?t=abc');
    expect(out.html).toContain('123 Main St, Visalia, CA');

    // Without compliance values: the address node renders nothing, the link → '#'.
    const bare = await renderEmailTree({ tree, subject: 'X', to: 'x@y.com' }, { brand });
    expect(bare.html).not.toContain('123 Main St');
  });

  it('composes a real default template end-to-end (invoicing-overdue)', async () => {
    const { getDefaultEmailTemplate } = await import('@sparx/builder-schemas');
    const tpl = getDefaultEmailTemplate('invoicing-overdue')!;
    const out = await renderEmailTree(
      {
        tree: tpl.tree,
        subject: tpl.subject,
        preheader: tpl.preheader,
        to: 'x@y.com',
        data: {
          invoice: {
            number: 'INV-42',
            balance: '$1,200.00',
            dueDate: 'Jun 1, 2026',
            overdueDays: 12,
            payUrl: 'https://shop.test/pay/42',
          },
          tenant: { name: 'Acme Diesel' },
          customer: { firstName: 'Sam' },
        },
      },
      { brand }
    );
    expect(out.html).toContain('past due');
    expect(out.html).toContain('INV-42');
    expect(out.html).toContain('$1,200.00');
    expect(out.html).toContain('12 days overdue');
    expect(out.html).toContain('https://shop.test/pay/42');
  });
});
