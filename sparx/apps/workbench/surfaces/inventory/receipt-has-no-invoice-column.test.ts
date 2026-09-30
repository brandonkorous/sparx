// A DELIVERY NOTE MUST NOT HAVE A COLUMN HEADED "INVOICED" (issue 891).
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary - which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What this guards ─────────────────────────────────────────────────────────
//
// There is no invoice when goods are booked in. That is the whole point of
// matching a delivery against a bill: the goods turn up, and the supplier's
// paperwork arrives afterwards and is checked against what actually came.
//
// A receipt line's `unitCostCents` is set in one of two ways
// (`goods-receipts.ts`):
//
//     input.unitCostCents !== undefined
//       ? toBaseUnitCost(input.unitCostCents, uom.unitsPerUom)   // what she typed
//       : poLine.unitCostCents;                                  // what was AGREED
//
// Neither is an invoice. The column over it said "Invoiced" anyway, and on the
// development database GR-000003 read:
//
//     Item                     Units   Invoiced   Plus getting it here   Really cost
//     Brass belt hardware        58      $3.60       $0.24 · $14.00         $3.84
//
// while the card four inches below it named the real invoice for that same
// delivery - FT-INV-2291 - which charges **$3.84** a unit and no freight at
// all. Fairfield billed the carriage inside the unit price; Devi booked it in
// at the agreed $3.60 with a separate $14.00 courier charge. Both documents are
// true about themselves, and the screen put the word "Invoiced" over the one
// that is not an invoice.
//
// The same file already had the right word 300 lines down: the cost card says
// "What the goods cost" for exactly this money.
// [[feedback_a_fix_leaves_its_neighbour_behind]]

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const PANE = join(__dirname, 'receipt-detail.tsx');

/** Every `<th>`'s text, with tags and whitespace flattened away. */
function columnHeadings(source: string): string[] {
  const out: string[] = [];
  const cell = new RegExp(String.raw`<th\b[^>]*>([\s\S]*?)<\/th>`, 'g');
  for (const match of source.matchAll(cell)) {
    const text = (match[1] ?? '')
      .replace(new RegExp(String.raw`\{[^}]*\}`, 'g'), '')
      .replace(new RegExp(String.raw`<[^>]*>`, 'g'), '')
      .replace(new RegExp(String.raw`\s+`, 'g'), ' ')
      .trim();
    if (text !== '') out.push(text);
  }
  return out;
}

describe('the receipt pane does not claim to show an invoice', () => {
  const source = readFileSync(PANE, 'utf8');
  const headings = columnHeadings(source);

  it('reads some column headings at all', () => {
    // The guard that stops this guard going blind. A regex that matches nothing
    // passes every assertion below while checking nothing at all.
    // [[feedback_structural_checks_go_blind]]
    expect(headings.length).toBeGreaterThan(3);
  });

  it('heads no column with the word invoiced', () => {
    // THE DEFECT. The price on a receipt line came off the ORDER, or off her
    // keyboard. The supplier's invoice is a different document with a different
    // number on it, and this pane links to it separately.
    const invoiceWord = new RegExp(String.raw`^invoiced?$`, 'i');
    const offenders = headings.filter((h) => invoiceWord.test(h));
    expect(offenders).toEqual([]);
  });

  it('still shows what the goods themselves cost', () => {
    // Not just "the wrong word is gone" - the column has to still be there.
    // Deleting it would pass the test above and lose the number that makes the
    // other two columns readable across.
    const goods = headings.filter((h) => new RegExp(String.raw`goods`, 'i').test(h));
    expect(goods.length).toBeGreaterThan(0);
  });

  it('still shows the delivery cost and the real cost beside it', () => {
    // The three read across as one sentence: what the goods cost, what getting
    // them here added, what that makes each unit worth. Any one of them missing
    // leaves the other two unexplained.
    expect(headings.some((h) => new RegExp(String.raw`getting it here`, 'i').test(h))).toBe(true);
    expect(headings.some((h) => new RegExp(String.raw`really cost`, 'i').test(h))).toBe(true);
  });

  it('uses the same word for this money as the cost card below it', () => {
    // The card says "What the goods cost" over the very same number. One screen,
    // one word for one fact - that is what went wrong here in the first place.
    expect(source).toContain('What the goods cost');
  });
});
