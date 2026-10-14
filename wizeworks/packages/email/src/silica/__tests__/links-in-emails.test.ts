// Content inside a clickable group (`link`) is painted in the brand and written into
// the plain-text copy (piggles persona issue 982). The newsletter's "Latest …" cards
// are a link around a picture, a title and a summary: their words kept the kit's
// fixed gray (dark text on a dark email) and were missing from the text copy.

import { describe, expect, it } from 'vitest';
import { contentCards, emailDoc } from '@wizeworks/builder-schemas';
import type { EmailDocument } from '@wizeworks/silicaui-builder/email';

import { applyBrandColors } from '../brand-colors';
import { emailDocumentToText } from '../to-text';
import { defaultBrand, type BrandTokens } from '../../index';

const marrow: BrandTokens = {
  ...defaultBrand,
  primary: '#bb0916',
  background: '#faf8f5',
  muted: '#f0eeea',
  foreground: '#0f0d0c',
};

/** One filled card: what the send's resolver leaves for a piece. */
function edition(): EmailDocument {
  const doc: EmailDocument = emailDoc('This week', '', [contentCards('cms.article')]);
  const fill = (node: { kind: string; children?: unknown[] } & Record<string, unknown>): void => {
    if (node.kind === 'link') node.href = 'https://the-marrow-review.piggles.site/articles/barley';
    if (node.kind === 'text') {
      const ref = (node.data as { ref?: string } | undefined)?.ref;
      node.html =
        ref === 'title' ? 'Who pays when the malting barley fails' : 'A malting contract.';
    }
    for (const child of node.children ?? []) fill(child as typeof node);
  };
  fill(doc.root as unknown as Parameters<typeof fill>[0]);
  return doc;
}

function textsUnder(node: unknown, out: { color: string; html: string }[] = []) {
  const n = node as { kind: string; children?: unknown[]; color?: string; html?: string };
  if (n.kind === 'text') out.push({ color: n.color ?? '', html: n.html ?? '' });
  for (const child of n.children ?? []) textsUnder(child, out);
  return out;
}

describe('a card made clickable', () => {
  it('paints its title and summary in the brand’s ink, not the kit’s gray', () => {
    const texts = textsUnder(applyBrandColors(edition(), marrow).root);
    const card = texts.filter((t) => /barley|malting contract/.test(t.html));
    expect(card).toHaveLength(2);
    for (const t of card) expect(t.color).toBe('#0f0d0c');
  });

  it('is written into the plain-text copy, words then where it goes', () => {
    const text = emailDocumentToText(edition());
    expect(text).toContain('Who pays when the malting barley fails');
    expect(text).toContain('A malting contract.');
    expect(text).toContain('<https://the-marrow-review.piggles.site/articles/barley>');
  });
});
