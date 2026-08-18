import { describe, expect, it } from 'vitest';
import type { EmailDocument } from '@wizeworks/silicaui-builder/email';

import { renderSilicaEmail } from '../render-silica-email';

/** A minimal but real silica email: a greeting with a `{{token}}`, a section bound
 *  to `order.items` that repeats a bound row, all inside one section. */
function fixtureDoc(): EmailDocument {
  return {
    version: '1',
    subject: 'Hi {{customer.firstName}}',
    preheader: 'Your order',
    root: {
      id: 'body',
      kind: 'body',
      width: 600,
      bg: '#eeeeee',
      contentBg: '#ffffff',
      fontFamily: 'Arial, sans-serif',
      children: [
        {
          id: 's1',
          kind: 'section',
          bg: '#ffffff',
          paddingX: 24,
          paddingY: 24,
          children: [
            {
              id: 't1',
              kind: 'text',
              html: 'Hello {{customer.firstName}}',
              align: 'left',
              color: '#111111',
              fontSize: 16,
              fontWeight: 'normal',
              lineHeight: 1.5,
            },
          ],
        },
        {
          // The line-item list — a section can't nest in a section (LayoutChild is
          // columns|content), so the repeat lives on a top-level section, whose
          // content children clone once per resolved item.
          id: 'items',
          kind: 'section',
          bg: '#ffffff',
          paddingX: 24,
          paddingY: 0,
          data: { kind: 'collection', ref: 'order.items' },
          children: [
            {
              id: 'row',
              kind: 'text',
              html: 'placeholder',
              align: 'left',
              color: '#111111',
              fontSize: 14,
              fontWeight: 'normal',
              lineHeight: 1.4,
              data: { kind: 'value', ref: 'name' },
            },
          ],
        },
      ],
    },
  };
}

const data = {
  customer: { firstName: 'Alex' },
  order: { items: [{ name: 'Widget' }, { name: 'Gadget' }] },
};

const brand = {
  primary: '#6366f1',
  foreground: '#111111',
  muted: '#f5f5f5',
  border: '#e5e5e5',
  background: '#ffffff',
  siteName: 'Acme',
};

describe('renderSilicaEmail', () => {
  it('resolves {{tokens}} in the subject and body', () => {
    const out = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    expect(out.subject).toBe('Hi Alex');
    expect(out.html).toContain('Hello Alex');
    expect(out.html).not.toContain('{{customer.firstName}}');
  });

  it('repeats a bound collection once per item', () => {
    const out = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    expect(out.html).toContain('Widget');
    expect(out.html).toContain('Gadget');
    // The authored placeholder is replaced, not left behind.
    expect(out.html).not.toContain('placeholder');
  });

  it('injects the branded wordmark header', () => {
    const out = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    expect(out.html).toContain('Acme');
  });

  it('injects the legal footer only for marketing sends', () => {
    const marketing = renderSilicaEmail(
      {
        doc: fixtureDoc(),
        to: 'a@b.com',
        data,
        marketing: true,
        compliance: { unsubscribeUrl: 'https://x.test/u/abc', physicalAddress: '1 Main St' },
      },
      { brand }
    );
    expect(marketing.html).toContain('Unsubscribe');
    expect(marketing.html).toContain('https://x.test/u/abc');
    expect(marketing.html).toContain('1 Main St');

    const transactional = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    expect(transactional.html).not.toContain('Unsubscribe');
  });

  it('produces a non-empty plain-text alternative that mirrors the body', () => {
    const out = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    expect(out.text.trim().length).toBeGreaterThan(0);
    expect(out.text).toContain('Hello Alex');
    expect(out.text).toContain('Widget');
    expect(out.text).toContain('Gadget');
  });

  it('falls back to the document subject when no override is given', () => {
    const out = renderSilicaEmail({ doc: fixtureDoc(), to: 'a@b.com', data }, { brand });
    // subject came from doc.subject, interpolated
    expect(out.subject).toBe('Hi Alex');
  });
});
