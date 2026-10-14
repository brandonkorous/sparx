// The return pages link to the shop's own returns policy (sparx persona issue
// 210). Both linked to "/returns-policy", which is only the template's default
// address: Gillett's is "/refund-policy", so Brynn's link went to a page that does
// not exist.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { returnsPolicyLink } from './policy-link';

const link = (legalKind: string | null, href: string) => ({
  label: href,
  href,
  legalKind,
  columnKey: 'legal',
});

describe('returnsPolicyLink', () => {
  it('is the page the shop published as its returns policy', () => {
    expect(
      returnsPolicyLink([link('privacy', '/privacy-policy'), link('returns', '/returns')])
    ).toBe('/returns');
  });

  it('is the refund policy when the shop has no returns policy', () => {
    expect(
      returnsPolicyLink([link('privacy', '/privacy-policy'), link('refund', '/refund-policy')])
    ).toBe('/refund-policy');
  });

  it('prefers the returns policy when the shop has both', () => {
    expect(
      returnsPolicyLink([link('refund', '/refund-policy'), link('returns', '/our-returns')])
    ).toBe('/our-returns');
  });

  it('is null when the shop has published neither', () => {
    expect(returnsPolicyLink([link('privacy', '/privacy-policy')])).toBeNull();
    expect(returnsPolicyLink([])).toBeNull();
  });
});

describe('the return pages', () => {
  const read = (f: string) => readFileSync(fileURLToPath(new URL(f, import.meta.url)), 'utf8');
  const pages = [
    '../app/account/(authed)/orders/[orderId]/return/page.tsx',
    '../app/account/(authed)/returns/[returnId]/page.tsx',
  ];

  it('never hard-code a policy address', () => {
    for (const page of pages) expect(read(page)).not.toMatch(/href="\/(returns|refund)-policy"/);
  });

  it('use the shop’s own policy link', () => {
    for (const page of pages) expect(read(page)).toContain('<ReturnsPolicyNote');
  });
});
