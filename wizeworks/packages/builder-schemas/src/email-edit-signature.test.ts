// An email nobody edited read "unsaved changes", and after Preview, "Unpublished
// changes": opening the designer repaints brand-following colors and backfills `ord`
// (sparx persona issue 152). Neither changes what a recipient gets.

import { describe, expect, it } from 'vitest';

import { emailEditSignature } from './email-silica';

function doc(over: {
  bg?: string;
  bgAuto?: boolean;
  color?: string;
  ord?: string;
  label?: string;
}) {
  return {
    version: '1',
    subject: 'Welcome to {{site.name}}',
    preheader: '',
    root: {
      id: 'b',
      kind: 'body',
      bg: over.bg ?? '#f4f4f5',
      bgAuto: over.bgAuto ?? true,
      contentBg: '#ffffff',
      contentBgAuto: true,
      children: [
        {
          id: 's1',
          kind: 'section',
          ...(over.ord ? { ord: over.ord } : {}),
          bg: '#ffffff',
          bgAuto: true,
          children: [
            {
              id: 't1',
              kind: 'text',
              html: over.label ?? 'Thanks for joining',
              color: over.color ?? '#18181b',
              colorAuto: true,
            },
          ],
        },
      ],
    },
  };
}

describe('what an email says to its recipients', () => {
  it('does not change when the brand repaints its brand-following colors', () => {
    expect(emailEditSignature(doc({ bg: '#e9ebee', color: '#0c1014' }))).toBe(
      emailEditSignature(doc({}))
    );
  });

  it('does not change when ordering keys are filled in', () => {
    expect(emailEditSignature(doc({ ord: 'a0' }))).toBe(emailEditSignature(doc({})));
  });

  it('does not change with key order (the database returns its own)', () => {
    const a = doc({});
    const reordered = {
      root: a.root,
      preheader: a.preheader,
      subject: a.subject,
      version: a.version,
    };
    expect(emailEditSignature(reordered)).toBe(emailEditSignature(a));
  });

  it('changes when an author edits the words', () => {
    expect(emailEditSignature(doc({ label: 'Thanks for signing up' }))).not.toBe(
      emailEditSignature(doc({}))
    );
  });

  it('changes when an author picks a color, which ends brand-following', () => {
    expect(emailEditSignature(doc({ bg: '#000000', bgAuto: false }))).not.toBe(
      emailEditSignature(doc({}))
    );
  });
});
