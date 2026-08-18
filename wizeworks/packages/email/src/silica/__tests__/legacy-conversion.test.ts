// A legacy sparx email, CONVERTED and then rendered through the real send path
// (docs/120 slice 7). The unit tests in builder-schemas prove the tree maps to the
// right silica nodes; these prove the result actually SENDS — that a tenant who
// authored an email on the old builder gets a real, branded, data-resolved email out
// the other side, not an empty frame.
//
// This is the pair of tests that stand between "we deleted renderEmailTree" and a
// tenant's order confirmation going out blank.

import { describe, expect, it } from 'vitest';
import { emailTreeToSilica, type BuilderNode } from '@wizeworks/builder-schemas';

import { renderSilicaEmail } from '../render-silica-email';

const brand = {
  primary: '#0f766e',
  primaryForeground: '#ffffff',
  foreground: '#18181b',
  muted: '#f4f4f5',
  border: '#e4e4e7',
  background: '#ffffff',
  fontBody: 'Georgia, serif',
  siteName: 'Northwind Supply',
};

let seq = 0;
const n = (
  type: string,
  props: Record<string, unknown> = {},
  children?: BuilderNode[]
): BuilderNode => ({
  id: `${type}-${(seq += 1)}`,
  type,
  props,
  ...(children ? { children } : {}),
});

/** A tenant's hand-edited order confirmation, in the shape the old builder stored:
 *  wordmark, heading with a token, greeting with a `??` fallback, a line-item table,
 *  a conditional shipping block, and a CTA. */
function legacyOrderEmail(): BuilderNode {
  const table = n('line_item_table');
  (table as { binding?: unknown }).binding = { path: 'order.items' };
  return n('Section', {}, [
    n('email_wordmark', { treatment: 'lockup' }),
    n('Heading', { text: 'Order {{order.number}} confirmed', level: 'h1' }),
    n('Text', {
      text: 'Thanks for your order, {{customer.firstName ?? "there"}}.',
      variant: 'body',
    }),
    table,
    n('conditional_block', { when: 'order.shippingAddress' }, [
      n('Text', { text: 'Shipping to: {{order.shippingAddress}}', variant: 'meta' }),
    ]),
    n('Button', { label: 'Track your order', href: '{{order.statusUrl}}' }),
    n('unsubscribe_link'),
  ]);
}

const render = (data: Record<string, unknown>, marketing = false) =>
  renderSilicaEmail(
    {
      doc: emailTreeToSilica(legacyOrderEmail(), 'Your order is confirmed', null),
      to: 'buyer@example.com',
      subject: 'Your order is confirmed',
      preheader: null,
      data,
      marketing,
    },
    { brand }
  );

describe('a legacy sparx email, converted and sent', () => {
  const data = {
    order: {
      number: 'SO-1042',
      statusUrl: 'https://shop.example.com/orders/SO-1042',
      shippingAddress: '9 Harbour Rd, Wellington',
      items: [
        { name: 'Trail Pack 30L', quantity: 2, lineTotal: '$118.00' },
        { name: 'Dry Bag', quantity: 1, lineTotal: '$24.00' },
      ],
    },
    customer: { firstName: 'Ada' },
  };

  it('renders the tenant’s own copy, with every merge token resolved', () => {
    const { html } = render(data);
    expect(html).toContain('Order SO-1042 confirmed');
    expect(html).toContain('Thanks for your order, Ada');
    expect(html).toContain('Track your order');
    // Nothing may reach a real inbox still holding an unresolved token.
    expect(html).not.toContain('{{');
  });

  it('repeats the line-item table once per item, with its header printed ONCE', () => {
    const { html } = render(data);
    expect(html).toContain('Trail Pack 30L');
    expect(html).toContain('Dry Bag');
    // The header lives in its own non-repeating section; if it had been swept into the
    // repeating one it would print twice here.
    expect(html.match(/Qty/g)).toHaveLength(1);
  });

  it('honours the `??` fallback when the data is missing', () => {
    const { html } = render({ ...data, customer: {} });
    expect(html).toContain('Thanks for your order, there');
  });

  it('DROPS the conditional block when its field is absent', () => {
    // The one that silently ships wrong rather than crashing: a shipping line on a
    // pickup order.
    const { order, ...rest } = data;
    const { shippingAddress: _drop, ...orderWithoutAddress } = order;
    const { html } = render({ ...rest, order: orderWithoutAddress });
    expect(html).not.toContain('Shipping to:');
    // …while the rest of the email is intact.
    expect(html).toContain('Order SO-1042 confirmed');
  });

  it('wears the tenant brand, and composes the frame + footer the body no longer carries', () => {
    const { html } = render(data, true);
    // The wordmark node was dropped in conversion — the FRAME supplies the site name.
    expect(html).toContain('Northwind Supply');
    // The unsubscribe node was dropped — the marketing footer supplies the opt-out, so
    // it can't be authored away.
    expect(html.toLowerCase()).toContain('unsubscribe');
    // Brand repaint reached the button (the `*Auto` fields track the theme).
    expect(html).toContain('#0f766e');
  });

  it('produces a plain-text part too', () => {
    const { text } = render(data);
    expect(text).toContain('Order SO-1042 confirmed');
    expect(text).toContain('Trail Pack 30L');
  });
});
