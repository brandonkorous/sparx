import { describe, expect, it } from 'vitest';
import { SILICA_EMAIL_BODIES, silicaDefaultEmail } from '@wizeworks/builder-schemas';
import { renderSilicaEmail } from '../render-silica-email';
import { lintEmailRender } from '../lint';

const brand = { siteName: 'Acme Supply', primary: '#e04631' };

function checksFor(key: string) {
  const doc = silicaDefaultEmail(key, `Subject for ${key}`, `Preview for ${key}`);
  const html = renderSilicaEmail({ doc, to: 'a@b.test', data: {} }, { brand }).html;
  return lintEmailRender({
    doc,
    html,
    subject: `Subject for ${key}`,
    preheader: `Preview for ${key}`,
  });
}

describe('lintEmailRender', () => {
  // The false-positive tripwire: a pre-send check that flags our OWN shipped templates is
  // worse than no check. If a future catalog/vocabulary change (e.g. re-enabling
  // field-level merge-tag validation) makes this fail, the vocabulary is wrong — not the
  // template.
  it('every shipped default passes clean (no error or warning)', () => {
    const offenders: string[] = [];
    for (const key of Object.keys(SILICA_EMAIL_BODIES)) {
      const issues = checksFor(key).filter((c) => c.level !== 'pass');
      if (issues.length > 0) offenders.push(`${key}: ${issues.map((c) => c.title).join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });

  it('returns one entry per category, most-severe first', () => {
    const checks = checksFor('order-confirmation');
    expect(checks.map((c) => c.id).sort()).toEqual(
      [
        'image-text',
        'images',
        'link-text',
        'links',
        'merge-tags',
        'preheader',
        'size',
        'subject',
      ].sort()
    );
    // pass-only email → every entry is a pass.
    expect(checks.every((c) => c.level === 'pass')).toBe(true);
  });

  it('catches a missing subject, a dead link, a missing image description, and an unknown tag source', () => {
    const doc = {
      version: '1' as const,
      subject: '',
      preheader: '',
      root: {
        id: 'b',
        kind: 'body' as const,
        width: 600,
        bg: '#fff',
        contentBg: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        children: [
          {
            id: 's1',
            kind: 'section' as const,
            bg: '#ffffff',
            paddingX: 24,
            paddingY: 24,
            children: [
              {
                id: 't1',
                kind: 'text' as const,
                html: 'Hi {{oder.total}}',
                align: 'left' as const,
                color: '#000',
              },
              {
                id: 'i1',
                kind: 'image' as const,
                src: 'https://x/y.png',
                alt: '',
                width: 200,
                align: 'left' as const,
              },
              { id: 'b1', kind: 'button' as const, label: 'Shop', href: '#', bg: '#000' },
            ],
          },
        ],
      },
    };
    const html = renderSilicaEmail({ doc: doc as never, to: 'a@b.test', data: {} }, { brand }).html;
    const checks = lintEmailRender({ doc: doc as never, html, subject: '', preheader: '' });
    const level = (id: string) => checks.find((c) => c.id === id)?.level;
    expect(level('subject')).toBe('error');
    expect(level('links')).toBe('error');
    expect(level('images')).toBe('warning');
    expect(level('preheader')).toBe('warning');
    expect(level('merge-tags')).toBe('error'); // {{oder.total}} — unknown source root
  });

  it('catches a field typo on a real source (Slice 3 field-level validation)', () => {
    const doc = silicaDefaultEmail('welcome-customer', 'Hi', 'yo');
    // A REAL source (`customer`) with a MISSPELLED field — renders blank in the inbox,
    // exactly like an unknown source, so it's an error too.
    const bad = {
      ...doc,
      root: {
        ...(doc.root as unknown as Record<string, unknown>),
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
                html: 'Hi {{customer.frstName}}',
                align: 'left',
                color: '#000',
              },
            ],
          },
        ],
      },
    };
    const html = renderSilicaEmail({ doc: bad as never, to: 'a@b.test', data: {} }, { brand }).html;
    const checks = lintEmailRender({ doc: bad as never, html, subject: 'Hi', preheader: 'yo' });
    expect(checks.find((c) => c.id === 'merge-tags')?.level).toBe('error');
    // A loop alias (`item.*`) is NOT a real object source, so its fields are never
    // checked — an authored repeater token must stay clean.
    const looped = {
      ...doc,
      root: {
        ...(doc.root as unknown as Record<string, unknown>),
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
                html: '{{item.anything}} {{order.total}}',
                align: 'left',
                color: '#000',
              },
            ],
          },
        ],
      },
    };
    const loopedHtml = renderSilicaEmail(
      { doc: looped as never, to: 'a@b.test', data: {} },
      { brand }
    ).html;
    const loopedChecks = lintEmailRender({
      doc: looped as never,
      html: loopedHtml,
      subject: 'Hi',
      preheader: 'yo',
    });
    expect(loopedChecks.find((c) => c.id === 'merge-tags')?.level).toBe('pass');
  });

  it('flags a body over Gmail’s clipping limit', () => {
    const big = 'x'.repeat(110 * 1024);
    const doc = silicaDefaultEmail('welcome-customer', 'Hi', 'yo');
    const checks = lintEmailRender({ doc, html: big, subject: 'Hi', preheader: 'yo' });
    expect(checks.find((c) => c.id === 'size')?.level).toBe('error');
  });

  it('warns on an over-long subject (tokens counted at their rendered size)', () => {
    const doc = silicaDefaultEmail('welcome-customer', 'Hi', 'yo');
    const longSubject =
      'Your order is confirmed and will ship soon — thank you so much for shopping with our little store today';
    const html = renderSilicaEmail({ doc, to: 'a@b.test', data: {} }, { brand }).html;
    const long = lintEmailRender({ doc, html, subject: longSubject, preheader: 'yo' });
    expect(long.find((c) => c.id === 'subject')?.level).toBe('warning');
    // A token-heavy but visually short subject is NOT flagged — the token expands at send.
    const tokenSubject = 'Hi {{customer.firstName ?? "there"}}, your order is ready';
    const short = lintEmailRender({ doc, html, subject: tokenSubject, preheader: 'yo' });
    expect(short.find((c) => c.id === 'subject')?.level).toBe('pass');
  });

  it('warns on a vague link label but not a descriptive one', () => {
    const make = (label: string) => ({
      version: '1' as const,
      subject: 'Hi',
      preheader: 'yo',
      root: {
        id: 'b',
        kind: 'body' as const,
        width: 600,
        bg: '#fff',
        contentBg: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        children: [
          {
            id: 's1',
            kind: 'section' as const,
            bg: '#ffffff',
            paddingX: 24,
            paddingY: 24,
            children: [
              {
                id: 't1',
                kind: 'text' as const,
                html: 'Some real copy here so the email is not image-only or empty.',
                align: 'left' as const,
                color: '#000',
              },
              {
                id: 'b1',
                kind: 'button' as const,
                label,
                href: 'https://shop.test/orders',
                bg: '#000',
              },
            ],
          },
        ],
      },
    });
    const linkLevel = (label: string) => {
      const doc = make(label);
      const html = renderSilicaEmail(
        { doc: doc as never, to: 'a@b.test', data: {} },
        { brand }
      ).html;
      return lintEmailRender({ doc: doc as never, html, subject: 'Hi', preheader: 'yo' }).find(
        (c) => c.id === 'link-text'
      )?.level;
    };
    expect(linkLevel('Click here')).toBe('warning');
    expect(linkLevel('View your order')).toBe('pass');
  });

  it('warns on an image-only email with almost no text', () => {
    const doc = {
      version: '1' as const,
      subject: 'Hi',
      preheader: 'yo',
      root: {
        id: 'b',
        kind: 'body' as const,
        width: 600,
        bg: '#fff',
        contentBg: '#fff',
        fontFamily: 'Arial, Helvetica, sans-serif',
        children: [
          {
            id: 's1',
            kind: 'section' as const,
            bg: '#ffffff',
            paddingX: 24,
            paddingY: 24,
            children: [
              {
                id: 'i1',
                kind: 'image' as const,
                src: 'https://cdn.test/promo.png',
                alt: 'Big spring sale',
                width: 552,
                align: 'center' as const,
              },
            ],
          },
        ],
      },
    };
    const html = renderSilicaEmail({ doc, to: 'a@b.test', data: {} }, { brand }).html;
    const checks = lintEmailRender({ doc, html, subject: 'Hi', preheader: 'yo' });
    expect(checks.find((c) => c.id === 'image-text')?.level).toBe('warning');
  });
});
