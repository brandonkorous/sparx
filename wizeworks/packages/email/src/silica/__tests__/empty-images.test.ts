import { describe, expect, it } from 'vitest';
import { DEFAULT_EMAIL_TEMPLATES } from '@wizeworks/builder-schemas';

import { dropEmptyEmailImages } from '../empty-images';
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

/** An order whose line items carry NO photo — a service, a custom line, or a product
 *  nobody has photographed yet. This is the state that shipped the broken icon. */
const ORDER_WITHOUT_PICTURES = {
  site: { name: 'Northwind Supply', url: 'https://northwind.test' },
  customer: { firstName: 'Rosa', fullName: 'Rosa Iyer' },
  order: {
    number: '1042',
    total: '$88.00',
    items: [
      { name: 'Cedar planter', quantity: '2', lineTotal: '$60.00' },
      { name: 'Potting soil', quantity: '1', lineTotal: '$28.00' },
    ],
  },
};

describe('dropEmptyEmailImages', () => {
  it('removes an img with an empty src, in any attribute order', () => {
    expect(dropEmptyEmailImages('<p>a</p><img src="" alt="" width="64" /><p>b</p>')).toBe(
      '<p>a</p><p>b</p>'
    );
    expect(dropEmptyEmailImages('<img alt="x" src="" width="64">')).toBe('');
    expect(dropEmptyEmailImages('<IMG SRC="" >')).toBe('');
  });

  it('leaves a real picture completely alone', () => {
    const real = '<img src="https://cdn.test/a.jpg" alt="A planter" width="64" />';
    expect(dropEmptyEmailImages(real)).toBe(real);
    // Same string back, not a copy — the no-match path must not allocate.
    expect(dropEmptyEmailImages(real)).toBe(real);
  });

  it('does not touch an img that simply has no src attribute', () => {
    // Absent is a different state from empty, and some clients tolerate it. Only the
    // one that makes a client fetch the email itself is removed.
    const noSrc = '<img alt="" width="64" />';
    expect(dropEmptyEmailImages(noSrc)).toBe(noSrc);
  });

  it('no provisioned default ships a broken picture for an order with no photos', () => {
    // The regression itself. Before this, `order-confirmation`, `order-delivered` and
    // `post-purchase-review` each emitted `<img src="" alt="" width="64">` — a
    // broken-image icon in the one email every customer is guaranteed to get.
    const offenders: string[] = [];
    for (const t of DEFAULT_EMAIL_TEMPLATES) {
      const out = renderSilicaEmail(
        { doc: t.doc, to: 'a@b.test', data: ORDER_WITHOUT_PICTURES },
        { brand }
      );
      if (out.html.includes('src=""')) offenders.push(t.key);
    }
    expect(offenders.join(', ')).toBe('');
  });
});
