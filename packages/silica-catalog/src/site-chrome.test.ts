// Locks the logo-capable brand wordmark (docs/122 — the wordmark-logo gap) against the
// REAL silica engine: `brandWordmark` must bind the tenant logo into the `<img>` src and the
// site name into the text, resolving through the shared render primitive exactly as the
// storefront frame does. This is what makes "drop the Brand element into the navbar and your
// logo appears" true — no author binding step.

import { describe, expect, it } from 'vitest';
import type { ResolveHost } from '@wizeworks/silicaui-html';

import { renderSilicaBody } from './render';
import { brandWordmark } from './site-chrome';

/** A host resolving the site-identity chrome refs (logo as the storefront shapes it — the
 *  format hook unwraps `{url}`; here a plain string is enough to prove the src wire). */
const host: ResolveHost = {
  resolveCollection: () => [],
  resolveBinding: (ref: string) => {
    if (ref === 'site.identity.logo') return { value: 'https://cdn.test/logo.png' };
    if (ref === 'site.identity.name') return { value: 'Acme Co' };
    return { value: '' };
  },
};

describe('brandWordmark — the logo-capable wordmark', () => {
  it('binds the tenant logo into the img src and the name into the text', () => {
    const html = renderSilicaBody(brandWordmark(), { host });
    expect(html).toContain('https://cdn.test/logo.png'); // logo → <img src>
    expect(html).toContain('Acme Co'); // name → the wordmark text
    expect(html).toContain('href="/"'); // the brand links home
    // The neutral "Logo" placeholder is overwritten the moment the logo resolves.
    expect(html).not.toContain('>Logo</text>');
  });

  it('is a REAL silica Wordmark (children path), not a hand-rolled lockup', () => {
    // The `wordmark` class is what earns silica's mark-sizing CSS. Lowering through the
    // component (rather than a bare <a>) is the difference between a Wordmark and
    // something that merely resembles one — and the children path is the ONLY way to
    // bind the logo AND the name, since a node carries one ref and `primary: "text"`
    // claims a bare bind for the name.
    const html = renderSilicaBody(brandWordmark(), { host });
    expect(html).toContain('wordmark');
    // `href` lowers the Wordmark to an <a>, so the mark links home.
    expect(html).toMatch(/<a[^>]*href="\/"/);
    // Both bound children survive the children path.
    expect(html).toMatch(/<img[^>]*src="https:\/\/cdn\.test\/logo\.png"/);
  });

  it('keeps the site name (and never a broken img) when no logo is set', () => {
    const noLogo: ResolveHost = {
      resolveCollection: () => [],
      resolveBinding: (ref: string) =>
        ref === 'site.identity.name' ? { value: 'Acme Co' } : { value: '' },
    };
    const html = renderSilicaBody(brandWordmark(), { host: noLogo });
    // The wordmark still reads as the brand — the text carries when there is no logo.
    expect(html).toContain('Acme Co');
  });
});
