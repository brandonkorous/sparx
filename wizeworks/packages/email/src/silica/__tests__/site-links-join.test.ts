// `{{site.url}}/book` sends one slash, not two (sparx persona issue 154).
//
// MEASURED 2026-10-08 on Gillett Diesel's fleet email: the plain-text copy read
// "Book a winter check <https://gillettdiesel.sparx.zone//book?…>". The site's
// home carries a trailing slash on purpose, and the page an owner writes after
// it starts with its own.

import { describe, expect, it } from 'vitest';
import type { EmailDocument } from '@wizeworks/silicaui-builder/email';

import { renderSilicaEmail } from '../render-silica-email';

const brand = {
  primary: '#ce333c',
  foreground: '#101633',
  muted: '#f5f5f5',
  border: '#e5e5e5',
  background: '#ffffff',
  siteName: 'Gillett Diesel Service',
  siteNameIsPlatformDefault: false,
};

function fleetEmail(): EmailDocument {
  return {
    version: '1',
    subject: 'Winter’s coming: get your fleet checked early',
    preheader: 'Glow plugs, injectors, batteries and anti-gel. Book by November 20.',
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
              html: 'Book by November 20: <a href="{{site.url}}/book">book a winter check</a>. Old link: <a href="https://example.test/a//b">kept</a>.',
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

function send() {
  return renderSilicaEmail(
    {
      doc: fleetEmail(),
      to: 'renee.castaneda@wasatchutility.test',
      data: { site: { url: 'https://gillettdiesel.test/' } },
    },
    { brand }
  );
}

describe('a link written after {{site.url}}', () => {
  it('has one slash after the site, in the HTML', () => {
    const { html } = send();
    expect(html).toContain('href="https://gillettdiesel.test/book"');
    expect(html).not.toContain('gillettdiesel.test//');
  });

  it('has one slash after the site, in the plain text', () => {
    const { text } = send();
    expect(text).toContain('https://gillettdiesel.test/book');
    expect(text).not.toContain('gillettdiesel.test//');
  });

  it('leaves a doubled slash further down a path alone', () => {
    expect(send().html).toContain('https://example.test/a//b');
  });
});
