import { describe, expect, it } from 'vitest';
import {
  tagTrackedUrl,
  tagEmailHtmlLinks,
  tagEmailTextLinks,
  type EmailLinkTracking,
} from '../link-tracking';

const tracking: EmailLinkTracking = {
  campaign: 'Welcome email',
  source: 'welcome-customer',
  hosts: ['acme.com', 'shop.acme.com'],
};

function params(url: string): URLSearchParams {
  return new URL(url).searchParams;
}

describe('tagTrackedUrl', () => {
  it('tags an on-site absolute link with the email utm trio', () => {
    const out = tagTrackedUrl('https://acme.com/products/widget', tracking);
    const p = params(out);
    expect(p.get('utm_source')).toBe('welcome-customer');
    expect(p.get('utm_medium')).toBe('email');
    expect(p.get('utm_campaign')).toBe('Welcome email');
  });

  it('matches a host regardless of www. and case', () => {
    expect(params(tagTrackedUrl('https://WWW.Acme.com/x', tracking)).get('utm_medium')).toBe(
      'email'
    );
  });

  it('tags a secondary tenant host', () => {
    expect(params(tagTrackedUrl('https://shop.acme.com/cart', tracking)).get('utm_medium')).toBe(
      'email'
    );
  });

  it('preserves existing query params and the fragment', () => {
    const out = tagTrackedUrl('https://acme.com/p?ref=x#reviews', tracking);
    expect(params(out).get('ref')).toBe('x');
    expect(out).toContain('#reviews');
    expect(params(out).get('utm_campaign')).toBe('Welcome email');
  });

  it('leaves an OFF-SITE link untouched (can’t be tracked by the tenant’s analytics)', () => {
    const off = 'https://ups.com/track?num=1Z999';
    expect(tagTrackedUrl(off, tracking)).toBe(off);
  });

  it('leaves mailto/tel/relative/anchor links untouched', () => {
    for (const raw of ['mailto:hi@acme.com', 'tel:+15551234', '/account', '#top']) {
      expect(tagTrackedUrl(raw, tracking)).toBe(raw);
    }
  });

  it('never overwrites an author-set utm_source', () => {
    const authored = 'https://acme.com/sale?utm_source=flyer&utm_medium=print';
    expect(tagTrackedUrl(authored, tracking)).toBe(authored);
  });

  it('is a no-op when there are no tracked hosts (no site context)', () => {
    const url = 'https://acme.com/x';
    expect(tagTrackedUrl(url, { ...tracking, hosts: [] })).toBe(url);
  });

  it('is idempotent — re-tagging an already-tagged url does not duplicate params', () => {
    const once = tagTrackedUrl('https://acme.com/x', tracking);
    // an author-set utm_source now exists → second pass is a no-op
    expect(tagTrackedUrl(once, tracking)).toBe(once);
    expect(once.match(/utm_medium/g)).toHaveLength(1);
  });
});

describe('tagEmailHtmlLinks', () => {
  it('rewrites on-site hrefs and leaves off-site ones alone', () => {
    const html = [
      '<a href="https://acme.com/order/123">View your order</a>',
      '<a href="https://ups.com/track">Track shipment</a>',
    ].join('');
    const out = tagEmailHtmlLinks(html, tracking);
    // URLSearchParams uses form encoding: a space is `+` (round-trips via
    // searchParams.get on the capture side).
    expect(out).toContain('utm_campaign=Welcome+email');
    expect(out).toContain('href="https://ups.com/track"'); // untouched
    // exactly one link tagged
    expect(out.match(/utm_medium=email/g)).toHaveLength(1);
  });

  it('handles an href whose query is HTML-entity-encoded (&amp;) without corrupting it', () => {
    const html = '<a href="https://acme.com/p?a=1&amp;b=2">x</a>';
    const out = tagEmailHtmlLinks(html, tracking);
    const href = (/href="([^"]*)"/.exec(out)?.[1] ?? '').replace(/&amp;/g, '&');
    const p = new URL(href).searchParams;
    expect(p.get('a')).toBe('1');
    expect(p.get('b')).toBe('2');
    expect(p.get('utm_medium')).toBe('email');
    // the written attribute re-encodes & as &amp; (valid HTML)
    expect(out).toContain('&amp;');
  });

  it('is a no-op with no tracked hosts', () => {
    const html = '<a href="https://acme.com/x">x</a>';
    expect(tagEmailHtmlLinks(html, { ...tracking, hosts: [] })).toBe(html);
  });
});

describe('tagEmailTextLinks', () => {
  it('tags an on-site bare url in plain text, excluding trailing punctuation', () => {
    const text = 'Shop the sale: https://acme.com/sale. See you there.';
    const out = tagEmailTextLinks(text, tracking);
    expect(out).toContain('https://acme.com/sale?utm_source=');
    expect(out).toMatch(/utm_campaign=Welcome\+email\. See you there\.$/);
  });

  it('leaves an off-site url in plain text untouched', () => {
    const text = 'Track: https://ups.com/track?n=1';
    expect(tagEmailTextLinks(text, tracking)).toBe(text);
  });
});
