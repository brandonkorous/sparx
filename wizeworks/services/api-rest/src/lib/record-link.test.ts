// Sparx persona issue 331: "High-value order: O-000034 · $640.96" arrived as one
// line with nothing to click.

import { describe, expect, it } from 'vitest';

import { withLinkLine } from './record-link.js';

describe('withLinkLine', () => {
  it('adds the link under an alert that had text only', () => {
    const out = withLinkLine(
      { html: '', text: 'Marisol Vega paid $640.96 for order O-000034.' },
      'Open the order',
      'https://app.example/commerce/orders/abc'
    );
    expect(out.html).toBe(
      '<p>Marisol Vega paid $640.96 for order O-000034.</p><p><a href="https://app.example/commerce/orders/abc">Open the order</a></p>'
    );
    expect(out.text).toBe(
      'Marisol Vega paid $640.96 for order O-000034.\n\nOpen the order: https://app.example/commerce/orders/abc'
    );
  });

  it('keeps an alert’s own HTML and escapes what it adds', () => {
    const out = withLinkLine({ html: '<p>Hi</p>', text: 'Hi' }, 'Open <it>', 'https://x/?a=1&b=2');
    expect(out.html).toBe('<p>Hi</p><p><a href="https://x/?a=1&amp;b=2">Open &lt;it&gt;</a></p>');
  });

  it('escapes the text it turns into HTML', () => {
    expect(withLinkLine({ html: '', text: 'A <b> & C' }, 'Go', 'https://x').html).toContain(
      '<p>A &lt;b&gt; &amp; C</p>'
    );
  });
});
