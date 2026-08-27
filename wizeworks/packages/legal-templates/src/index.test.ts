import { describe, expect, it } from 'vitest';
import { LEGAL_TEMPLATES, legalEntryBody } from './index';

/** Every string a template's body would put on the published page. */
function texts(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === 'string') out.push(n.text);
  for (const child of n.content ?? []) texts(child, out);
  return out;
}

/** Sentences that are addressed to the OWNER, not to the person reading the policy. */
const TO_THE_OWNER = [
  /not legal advice/i,
  /starter wording/i,
  /before you publish/i,
  /read it through/i,
  /make it fit your business/i,
  /replace this/i,
  /your own advice/i,
  // A note to the owner does not stop being one because it is inside a sentence:
  // "You may request a return within the period stated here (for example, 30 days
  // of delivery)" tells a customer nothing and reads as unedited.
  /stated here/i,
  /\(for example, \d/i,
];

describe('a legal starter says nothing to the owner that a customer will read', () => {
  for (const template of LEGAL_TEMPLATES) {
    it(`${template.legalKind} speaks only to the visitor`, () => {
      // The warning used to be the first thing in every one of these bodies, and
      // Publish is one click — so a clothing label's privacy page opened with
      // "This is starter wording, not legal advice … take your own advice on it
      // before you publish this page", in the shop's own voice, on the page a
      // shopper reads to decide whether to hand over an address (issue 267).
      // It belongs in the console, where only the owner sees it.
      const body = texts(template.doc).join('\n');
      for (const pattern of TO_THE_OWNER) {
        expect(body, `${template.legalKind} body matches ${pattern}`).not.toMatch(pattern);
      }
    });
  }

  it('carries every kind through the body the entry actually stores', () => {
    // `legalEntryBody` is what lands in the row, so checking the template alone
    // would miss a wrapper that put the sentence back on the way through.
    for (const template of LEGAL_TEMPLATES) {
      const stored = texts(legalEntryBody(template).body).join('\n');
      for (const pattern of TO_THE_OWNER) {
        expect(stored, `${template.legalKind} stored body matches ${pattern}`).not.toMatch(pattern);
      }
    }
  });
});
