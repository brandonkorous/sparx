// A walk cannot be built from a line that names no product, and saying so is
// the whole job.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// Pressing "Send to the warehouse" on an order whose lines are free text — the
// shape every order converted from a quote has, because a quote is a price and
// nobody attaches a product to one — refused with this:
//
//     Every line on these orders is already picked, already on another walk,
//     or has nothing left to fulfill.
//
// None of those three was true. The order was an hour old, 12 units outstanding,
// on no walk at all. The real cause was a FOURTH the sentence never mentioned,
// and it is the one with a different remedy: put the product on the line, or
// send the order by hand. Somebody reading that message went looking for a walk
// that did not exist. [[feedback_one_outcome_two_causes]]
//
// MEASURED 2026-09-22 on the local database: 4 orders are entirely free-text
// lines, and every one of them answers the button that way.
//
// ── And the flag that was supposed to cover it ───────────────────────────────
//
// `includeUnstocked` put such a line on the walk unallocated. It could never
// have worked. The row it built carried `variantId: null` into
// `inventory_pick_list_lines.variant_id`, which is NOT NULL with a foreign key:
//
//     ERROR: null value in column "variant_id" of relation
//            "inventory_pick_list_lines" violates not-null constraint
//
// Nothing in either console set it, so nobody found out — and the MCP tool
// `generate_pick_list` offered the whole input schema, so an agent driving the
// server from outside could reach it. A comment in the row builder asserted
// free-text lines never got that far, which was the opposite of what the code
// did. [[feedback_verify_capability_in_code_not_docs]]
//
// ── Why the source, and not a behavioral test ────────────────────────────────
//
// Generating a walk needs a transaction, so a behavioral test is one of the DB
// suites CI skips — which is how a flag that cannot work survived a green run.
// This reads the file, the same way `pick-expiry-gate.test.ts` does, and asserts
// the source it found is not empty so it cannot quietly cover nothing.

import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(here, 'pick-lists.ts'), 'utf8');

/** Walk UP to find the sibling package rather than counting `..`s — a count is
 *  one directory move away from reading nothing and reporting green.
 *  [[feedback_structural_checks_go_blind]] */
function findUp(relative: string): string {
  let dir = here;
  for (let depth = 0; depth < 8; depth += 1) {
    const candidate = join(dir, relative);
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Could not find ${relative} above ${here}`);
}

const schema = readFileSync(findUp(join('commerce-schemas', 'src', 'picking.ts')), 'utf8');

/** Comments discuss the old flag on purpose; the code must not reinstate it. */
function stripComments(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');
}

const code = stripComments(source);
const schemaCode = stripComments(schema);

describe('a line with no product cannot reach the walk', () => {
  it('reads the files it is asserting about', () => {
    expect(source.length).toBeGreaterThan(2000);
    expect(code).toContain('generatePickList');
    expect(schema.length).toBeGreaterThan(500);
    expect(schemaCode).toContain('GeneratePickListInput');
  });

  it('collects a free-text line instead of staging it', () => {
    // The row builder writes `variantId: s.line.variantId!`, so anything that
    // reaches `staged` without a variant writes a null into a NOT NULL column.
    expect(code).toMatch(/if \(!line\.variantId\) \{\s*unstocked\.push\(line\);\s*continue;\s*\}/);
  });

  it('offers no flag for putting one on the walk anyway', () => {
    expect(code).not.toContain('includeUnstocked');
    expect(schemaCode).not.toContain('includeUnstocked');
  });

  it('refuses rather than building a walk that leaves a line out', () => {
    // The function's own header: "A pick list that quietly leaves something out
    // is worse than one that will not generate." The refusal has to come BEFORE
    // the list is written, and it must not wait for `staged` to be empty — a
    // mixed order stages some lines and would otherwise ship short.
    const refusal = code.indexOf('unstocked.length > 0');
    const writes = code.indexOf('pickList.create');
    expect(refusal).toBeGreaterThan(-1);
    expect(writes).toBeGreaterThan(-1);
    expect(refusal).toBeLessThan(writes);
  });

  it('names the remedy this cause actually has', () => {
    const sentence = /no shelf to walk to[\s\S]{0,200}?send (it|the whole order) by hand/;
    expect(source).toMatch(sentence);
    // And never answers this cause with the three that are all "already in hand".
    const alreadyInHand = source.indexOf('already on another walk');
    const thisCause = source.indexOf('no shelf to walk to');
    expect(thisCause).toBeGreaterThan(-1);
    expect(alreadyInHand).toBeGreaterThan(thisCause);
  });
});
