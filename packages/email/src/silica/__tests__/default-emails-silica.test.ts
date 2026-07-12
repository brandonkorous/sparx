// The provisioned defaults, rendered through the real send path (docs/120 slice 6).
//
// These are the emails a tenant gets without ever opening the editor, so they're the
// ones most likely to ship broken and least likely to be looked at. Each assertion
// here corresponds to something that silently produces a WRONG email rather than a
// crash: a conditional that never hides, a line-item table that prints its placeholder
// row, a merge token that renders blank, a button in the wrong brand color.

import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_TEMPLATES, getDefaultEmailTemplate } from '@sparx/builder-schemas';

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

const docFor = (key: string) => {
  const t = getDefaultEmailTemplate(key);
  if (!t) throw new Error(`no default template "${key}"`);
  return t.doc;
};

const orderData = {
  site: { name: 'Northwind Supply', url: 'https://northwind.test' },
  customer: { firstName: 'Rosa' },
  order: {
    number: '1042',
    total: '$88.00',
    statusUrl: 'https://northwind.test/account/orders',
    shippingAddress: '12 Harbour Rd, Portland, OR 97201',
    items: [
      { name: 'Cedar planter', quantity: '2', lineTotal: '$60.00' },
      { name: 'Potting soil', quantity: '1', lineTotal: '$28.00' },
    ],
  },
};

describe('the provisioned default emails, on silica', () => {
  it('renders every default to real HTML and plain text', () => {
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const out = renderSilicaEmail({ doc: t.doc, to: 'a@b.test', data: {} }, { brand });
      expect(out.html, t.key).toContain('<table');
      expect(out.text.trim(), t.key).not.toBe('');
      // No default may ship an unresolved token to a real inbox.
      expect(out.html, t.key).not.toContain('{{');
      expect(out.subject, t.key).not.toContain('{{');
    }
  });

  it('fills the line-item table once per item, dropping the authored placeholder row', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.html).toContain('Cedar planter');
    expect(out.html).toContain('Potting soil');
    expect(out.html).toContain('$60.00');
    // The header row prints exactly once — it lives OUTSIDE the repeating section.
    expect(out.html.match(/Qty/g)).toHaveLength(1);
  });

  it('resolves merge tokens in the subject and the body copy', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.subject).toBe('Your order 1042 is confirmed');
    expect(out.html).toContain('Thanks for your order, Rosa');
    expect(out.html).toContain('Total: $88.00');
  });

  it('falls back when a token has no value, rather than leaving a hole in the copy', () => {
    const out = renderSilicaEmail(
      {
        doc: docFor('order-confirmation'),
        to: 'a@b.test',
        data: { ...orderData, customer: {} },
      },
      { brand }
    );
    // `{{customer.firstName ?? "there"}}` — silica's native pass ignores the fallback
    // syntax, and sparx's pass over the projected HTML honors it.
    expect(out.html).toContain('Thanks for your order, there');
  });

  it('shows a conditional block when its data is present', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(out.html).toContain('Shipping to: 12 Harbour Rd, Portland, OR 97201');
  });

  it('DROPS a conditional block when its data is absent — no dangling label', () => {
    const { shippingAddress: _omitted, ...order } = orderData.order;
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: { ...orderData, order } },
      { brand }
    );
    expect(out.html).not.toContain('Shipping to:');
    // The rest of the email is unaffected.
    expect(out.html).toContain('Cedar planter');
  });

  it('repaints the authored defaults in the tenant brand', () => {
    const out = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    // The CTA tracks the brand primary (silica's neutral #111827 must be gone), and
    // the body font follows the brand too.
    expect(out.html).toContain('#0f766e');
    expect(out.html).not.toContain('#111827');
    expect(out.html).toContain('Georgia, serif');
  });

  it('composes the legal footer onto a marketing default, and not a transactional one', () => {
    const marketing = renderSilicaEmail(
      {
        doc: docFor('win-back'),
        to: 'a@b.test',
        data: orderData,
        marketing: true,
        compliance: { unsubscribeUrl: 'https://n.test/u/1', physicalAddress: '9 Dock St' },
      },
      { brand }
    );
    expect(marketing.html).toContain('Unsubscribe');
    expect(marketing.html).toContain('9 Dock St');

    const transactional = renderSilicaEmail(
      { doc: docFor('order-confirmation'), to: 'a@b.test', data: orderData },
      { brand }
    );
    expect(transactional.html).not.toContain('Unsubscribe');
  });
});
