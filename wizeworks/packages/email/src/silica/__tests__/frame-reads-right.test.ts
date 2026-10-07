// The frame around every send reads right in the plain-text copy, and declares
// every token it writes (sparx persona issue 143).
//
// MEASURED 2026-10-06 on Gillett Diesel's overdue reminder to Wasatch Front: the
// text copy ended "Gillett Diesel Service ()" and "Your account (…) &middot;
// Privacy Policy (…)". The name links to `{{site.url}}`, which nothing looked up
// because the body never names the site; and the converter did not know
// `&middot;`, the separator the frame itself writes.

import { describe, expect, it } from 'vitest';
import type { EmailDocument } from '@wizeworks/silicaui-builder/email';

import { defaultBrand } from '../../components/brand';
import { buildEmailFrame, EMAIL_FRAME_TOKENS } from '../frame';
import { renderSilicaEmail } from '../render-silica-email';
import { emailDocumentToText } from '../to-text';

const brand = {
  primary: '#ce333c',
  foreground: '#101633',
  muted: '#f5f5f5',
  border: '#e5e5e5',
  background: '#ffffff',
  siteName: 'Gillett Diesel Service',
  siteNameIsPlatformDefault: false,
};

/** An overdue notice's shape: copy that never mentions the site. */
function notice(): EmailDocument {
  return {
    version: '1',
    subject: 'Invoice {{invoice.number}} is overdue',
    preheader: 'Invoice {{invoice.number}}',
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
              html: 'Invoice {{invoice.number}} is now {{invoice.overdueDays}} days overdue.',
              align: 'left',
              color: '#111111',
              fontSize: 16,
              fontWeight: 'normal',
              lineHeight: 24,
            },
          ],
        },
      ],
    },
  };
}

const footerLinks = [
  { label: 'Your account', href: 'https://gillettdiesel.test/account' },
  { label: 'Privacy Policy', href: 'https://gillettdiesel.test/privacy-policy' },
];

describe('the plain-text copy of the frame', () => {
  it('separates the footer links with a dot, not an HTML entity', () => {
    const out = renderSilicaEmail(
      {
        doc: notice(),
        to: 'renee.castaneda@wasatchutility.test',
        data: {
          invoice: { number: '4459', overdueDays: '7' },
          site: { url: 'https://gillettdiesel.test' },
        },
        footerLinks,
      },
      { brand }
    );
    expect(out.text).toContain(
      'Your account (https://gillettdiesel.test/account) · Privacy Policy (https://gillettdiesel.test/privacy-policy)'
    );
    expect(out.text).not.toMatch(/&[a-z]+;/i);
  });

  it('links the business name home once the site is looked up', () => {
    const out = renderSilicaEmail(
      {
        doc: notice(),
        to: 'renee.castaneda@wasatchutility.test',
        data: {
          invoice: { number: '4459', overdueDays: '7' },
          site: { url: 'https://gillettdiesel.test' },
        },
      },
      { brand }
    );
    expect(out.text).toContain('Gillett Diesel Service (https://gillettdiesel.test)');
  });

  it('decodes numeric entities too', () => {
    const doc = notice();
    const section = doc.root.children[0]!;
    if (section.kind !== 'section') throw new Error('fixture');
    section.children = [
      { ...(section.children[0] as object), html: 'Net&#160;30 &#x2014; due' } as never,
    ];
    expect(emailDocumentToText(doc)).toBe('Net 30 — due');
  });
});

describe('the tokens the frame writes', () => {
  // Whatever resolves a send's data adds these to what the body asks for. A token
  // the frame writes but does not declare is a blank link on every send whose
  // body happens not to mention it.
  it('are all declared in EMAIL_FRAME_TOKENS', () => {
    const frame = buildEmailFrame({
      brand: { ...defaultBrand, ...brand },
      marketing: true,
      footerLinks,
    });
    const written = JSON.stringify(frame).match(/\{\{[^}]+\}\}/g) ?? [];
    expect(written.length).toBeGreaterThan(0);
    for (const token of written) expect(EMAIL_FRAME_TOKENS).toContain(token);
  });
});
