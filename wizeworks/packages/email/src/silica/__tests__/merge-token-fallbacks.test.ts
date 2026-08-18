// The `{{path ?? "fallback"}}` grammar, pinned on the path that actually delivers.
//
// This is the counterpart to a KNOWN gap rather than a suspicion of one: the email
// builder's CANVAS cannot render a token carrying a fallback. silica's own token regex
// matches bare `[a-zA-Z0-9_.]` paths, so `{{customer.firstName ?? "there"}}` never
// matches, passes through projection verbatim, and shows as raw braces while an author
// is looking at it. There is no seam to fix that from here — `EmailResolveHost` is
// `resolveBinding` / `resolveCollection` / `onDiagnostic`, and text tokens never reach
// the host — so it is a silicaui item.
//
// What sparx CAN guarantee, and what was being asserted in prose without a test behind
// it, is that the gap stops at the canvas: the delivered email and the server-rendered
// Preview both resolve fallbacks correctly, because both go through `renderSilicaEmail`
// (`renderPreview` in `@wizeworks/email-platform` calls exactly this). So the author's
// authoritative preview is right even while the canvas beside it is approximate.
//
// The three token shapes below are every fallback form the shipped defaults use — 29
// occurrences of the greeting, two of the full name with DIFFERENT fallbacks by context.
// If the grammar ever regresses, a nameless customer reads "Hi  — thanks", which is the
// exact sentence this file exists to prevent.

import { describe, expect, it } from 'vitest';
import { copyBlock, emailDoc, text } from '@wizeworks/builder-schemas';

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

const docWith = (body: string, subject = 'A subject') =>
  emailDoc(subject, 'A preheader line', [copyBlock([text(body)])]);

const render = (body: string, data: Record<string, unknown>, subject?: string) =>
  renderSilicaEmail({ doc: docWith(body, subject), to: 'a@b.test', data }, { brand });

describe('merge-token fallbacks, on the path that delivers', () => {
  it('uses the real value when the record has one', () => {
    const out = render('Hi {{customer.firstName ?? "there"}} — thanks for your order.', {
      customer: { firstName: 'Rosa' },
    });
    expect(out.html).toContain('Hi Rosa');
    expect(out.text).toContain('Hi Rosa');
    expect(out.html).not.toContain('there');
  });

  it('uses the fallback when the field is missing, empty, or null', () => {
    // All three are the same state to a recipient — nobody typed a first name — and all
    // three used to produce "Hi  — thanks" before the fallback pass existed.
    for (const customer of [{}, { firstName: '' }, { firstName: null }]) {
      const out = render('Hi {{customer.firstName ?? "there"}} — thanks for your order.', {
        customer,
      });
      expect(out.html, JSON.stringify(customer)).toContain('Hi there');
      expect(out.html, JSON.stringify(customer)).not.toContain('Hi  —');
      expect(out.text, JSON.stringify(customer)).toContain('Hi there');
    }
  });

  it('honours a DIFFERENT fallback for the same path in a different sentence', () => {
    // `customer.fullName` ships with two: "A customer" reads inside a sentence, "—"
    // reads in a table cell. This is why the fallback lives in the token rather than
    // being a per-path default — a single default cannot be both.
    const sentence = render('{{customer.fullName ?? "A customer"}} booked a table.', {
      customer: {},
    });
    expect(sentence.html).toContain('A customer booked a table.');

    const cell = render('Customer: {{customer.fullName ?? "—"}}', { customer: {} });
    expect(cell.html).toContain('Customer: —');
  });

  it('resolves fallbacks in the SUBJECT, not just the body', () => {
    // The subject is interpolated separately from the HTML. A raw `{{…}}` here is the
    // most visible failure there is — it is the line in the inbox list.
    const out = render(
      'Body copy.',
      { customer: {} },
      'Your order, {{customer.firstName ?? "there"}}'
    );
    expect(out.subject).toBe('Your order, there');
    expect(out.subject).not.toContain('{{');
  });

  it('leaves nothing unresolved in either body', () => {
    const out = render(
      'Hi {{customer.firstName ?? "there"}}, {{customer.fullName ?? "A customer"}} is on file.',
      { customer: {} }
    );
    for (const body of [out.html, out.text, out.subject]) {
      expect(body).not.toContain('{{');
      expect(body).not.toContain('??');
    }
  });
});
