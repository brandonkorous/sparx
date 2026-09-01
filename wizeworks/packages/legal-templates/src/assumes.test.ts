// What a starter STATES about a business it knows nothing about.
//
// Three of these templates put a number in the prose — a return window, a packing
// time, a refund time. That is the right call: a policy page with a blank in it is
// worse than one with a sensible default, and issue 267 settled that nothing in
// these bodies may address the owner, because a shopper reads them.
//
// The cost is that a number on a published page is indistinguishable from a
// decision. A real shop published "orders are usually processed within one to two
// business days" while posting on Tuesdays and Fridays (issue 375). `assumes` is
// how the console names those sentences back to the owner, so it has to actually
// cover them.

import { describe, expect, it } from 'vitest';
import { LEGAL_TEMPLATES, type LegalTemplate } from './index';

/** Every string a template's body would put on the published page. */
function texts(node: unknown, out: string[] = []): string[] {
  if (!node || typeof node !== 'object') return out;
  const n = node as { text?: string; content?: unknown[] };
  if (typeof n.text === 'string') out.push(n.text);
  for (const child of n.content ?? []) texts(child, out);
  return out;
}

const body = (t: LegalTemplate) => texts(t.doc).join('\n');

/** A number the prose commits the business to, written as digits or as words. */
const NUMERIC_CLAIM =
  /\b(\d+ (?:business |working )?days?|one to two|two to three|five to ten|thirty|fourteen)\b/i;

describe('a starter that states a number says so in `assumes`', () => {
  for (const template of LEGAL_TEMPLATES) {
    const claims = NUMERIC_CLAIM.test(body(template));

    it(`${template.legalKind} ${claims ? 'declares its guesses' : 'has nothing to declare'}`, () => {
      if (claims) {
        expect(
          template.assumes?.length ?? 0,
          `${template.legalKind} states a period in its prose and must list it in \`assumes\``
        ).toBeGreaterThan(0);
      } else {
        // Privacy, terms and cookies describe the PLATFORM's behavior, which the
        // platform does know. Declaring guesses there would put a warning on a
        // page that has none, and the warning stops being worth reading.
        expect(template.assumes ?? []).toHaveLength(0);
      }
    });
  }
});

describe('the declared guesses are addressed to the owner, not to a shopper', () => {
  // The opposite of the body's rule, and deliberately so — these strings are
  // console-only. If one ever leaked into a doc it would read as the shop talking
  // to itself on its own policy page.
  for (const template of LEGAL_TEMPLATES) {
    for (const sentence of template.assumes ?? []) {
      it(`"${sentence.slice(0, 40)}…" is not in the ${template.legalKind} body`, () => {
        expect(body(template)).not.toContain(sentence);
      });
    }
  }

  it('reads as a claim about the business, so each one starts "that"', () => {
    // The console frames them with "so it still says:", and a list that completes
    // that sentence is one an owner can check without a second reading.
    for (const template of LEGAL_TEMPLATES) {
      for (const sentence of template.assumes ?? []) {
        expect(sentence, `${template.legalKind}: ${sentence}`).toMatch(/^that /);
      }
    }
  });
});

describe('every commerce starter has something to declare', () => {
  it('covers returns, shipping and refunds', () => {
    // These are the three that describe how THIS business operates rather than
    // how the platform does, and all three carry a period in their prose.
    for (const kind of ['returns', 'shipping', 'refund'] as const) {
      const template = LEGAL_TEMPLATES.find((t) => t.legalKind === kind);
      expect(template?.assumes?.length ?? 0, kind).toBeGreaterThan(0);
    }
  });
});
