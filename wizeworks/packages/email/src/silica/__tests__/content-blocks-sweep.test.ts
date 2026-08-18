// Every block the email Insert palette offers, actually rendered.
//
// `email-content-blocks.test.ts` asserts the palette's SHAPE — unique `sx-` keys, and
// that `make()` mints fresh node ids — but never renders one. So a block could project
// to something no mail client can lay out (a bare `<div>` where Outlook needs a table),
// or trip sparx's own email lint, and the first person to find out would be an author
// who dropped it into a real email and sent it.
//
// This is the palette counterpart to `default-emails-silica.test.ts`, which covers the
// emails a tenant gets WITHOUT opening the editor. These are the pieces they add once
// they do.

import { describe, expect, it } from 'vitest';
import { EMAIL_CONTENT_BLOCKS, emailDoc } from '@wizeworks/builder-schemas';

import { lintEmailRender } from '../lint';
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

/** One block, alone in a document, through the real send path. */
const renderBlock = (item: (typeof EMAIL_CONTENT_BLOCKS)[number]) => {
  const doc = emailDoc('A subject that says what happened', 'A short preheader line', [
    item.make() as never,
  ]);
  return renderSilicaEmail({ doc, to: 'a@b.test', data: {} }, { brand });
};

describe('every email content block renders', () => {
  it('ships a palette worth sweeping', () => {
    // Guard on the guard: if the palette is ever restructured and this flattens to
    // nothing, every assertion below would pass by vacuity.
    expect(EMAIL_CONTENT_BLOCKS.length).toBeGreaterThanOrEqual(4);
  });

  it.each(EMAIL_CONTENT_BLOCKS.map((b) => [b.key, b] as const))('%s', (key, item) => {
    const out = renderBlock(item);

    // Email HTML is table-laid-out or it is broken in Outlook. This is the one
    // structural claim that holds for every block regardless of what it contains.
    expect(out.html, key).toContain('<table');
    expect(out.text.trim(), key).not.toBe('');

    // A palette block ships with placeholder COPY on purpose ("Add a heading"), but it
    // must never ship an unresolved merge token or a half-rendered value.
    expect(out.html, key).not.toContain('{{');
    expect(out.html, key).not.toContain('[object Object]');
    expect(out.html, key).not.toMatch(/\bundefined\b/);
  });

  // The blocks that carry a button ship it as `href: '#'` (three of the four — the
  // summary panel has none), so the links check reports "goes nowhere" the moment one
  // is inserted. That is CORRECT and must not be silenced: a
  // palette block cannot know where the author's button points, and telling them to
  // set it is the whole job of the check. What must not happen is a block arriving
  // with any OTHER error — a missing alt, an unreachable merge path, an image with no
  // source — because those are sparx's to get right, not the author's.
  const AUTHOR_SUPPLIED = 'goes nowhere';

  it('trips nothing beyond the destination the author has to supply', () => {
    const offenders = EMAIL_CONTENT_BLOCKS.flatMap((item) => {
      const out = renderBlock(item);
      const doc = emailDoc('A subject that says what happened', 'A short preheader line', [
        item.make() as never,
      ]);
      return lintEmailRender({
        doc,
        html: out.html,
        subject: out.subject,
        preheader: 'A short preheader line',
      })
        .filter((c) => c.level === 'error' && !c.detail.includes(AUTHOR_SUPPLIED))
        .map((c) => `${item.key} · ${c.id} — ${c.title}: ${c.detail}`);
    });
    // Joined, not an array compare: a failure then prints the findings themselves
    // rather than "expected [ …(3) ] to deeply equal []".
    expect(offenders.join('\n')).toBe('');
  });

  it('DOES report the placeholder destination — the exemption above stays honest', () => {
    // If the blocks ever ship a real href, or the links check stops firing, the
    // exemption above would start hiding real errors. Pin that it is still needed.
    const nowhere = EMAIL_CONTENT_BLOCKS.filter((item) => {
      const out = renderBlock(item);
      const doc = emailDoc('A subject that says what happened', 'A short preheader line', [
        item.make() as never,
      ]);
      return lintEmailRender({
        doc,
        html: out.html,
        subject: out.subject,
        preheader: 'A short preheader line',
      }).some((c) => c.level === 'error' && c.detail.includes(AUTHOR_SUPPLIED));
    });
    // Not "all of them": one block is a summary panel with no button, so it has no
    // destination to leave blank. The guard is that the exemption is still EARNED.
    expect(nowhere.length).toBeGreaterThan(0);
    expect(nowhere.length).toBeLessThan(EMAIL_CONTENT_BLOCKS.length + 1);
  });
});
