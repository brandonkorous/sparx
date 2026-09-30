// A scan's verdict is carried, never read back out of its own sentence.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `scanToPick` and `scanToPack` decide the outcome INSIDE the transaction and
// write it to `inventory_scan_events`, correctly. Then they threw it away, and
// outside the transaction rebuilt it from the message they had just written:
//
//     outcome: recorded.message?.includes('catalogue') ? 'not_found' : 'rejected',
//
// The message it was looking for says:
//
//     `Nothing in the catalog matches ${resolution.scanned}.`
//
// "catalog" does not contain "catalogue". The test was therefore NEVER true, in
// either function, for any scan. A barcode nobody has ever registered was
// answered `rejected` while the row saved a millisecond earlier said
// `not_found` — the database and the answer disagreed about the same event.
//
// It reaches the floor as color. `scanTone` in the console gives `not_found`
// **warning** and everything else **danger**, so an unknown code lit up red at
// the pick face, in the same red as "you are at the wrong shelf" and "that item
// is not on this order". One says the code is unknown to us; the others say the
// picker is holding the wrong thing. Two causes, one signal, and the remedies
// are not the same. [[feedback_one_outcome_two_causes]]
//
// Nothing went red when the spelling was Americanized, because nothing was
// asserting on it: the string was copy to every check in the repo and an
// identity to exactly one line of code.
// [[feedback_copy_edit_breaks_identity_lookups]]
//
// ── The rule ─────────────────────────────────────────────────────────────────
//
// A decision must not be keyed on a sentence we wrote ourselves, because our own
// copy is edited, translated and shortened as a matter of routine, and every one
// of those is a silent break. Matching somebody ELSE's fixed string is a
// different thing and stays allowed: `events/consumer.ts` matches a NATS server
// error and `scheduling/errors.ts` matches a Postgres constraint name. Neither
// is ours to reword.
//
// ── Why the source, and not a behavioral test ────────────────────────────────
//
// Both functions need a transaction, a pick list and a resolvable barcode, so a
// behavioral test is one of the DB suites CI skips - which is exactly how a
// classifier that can never fire survives a green run. This reads the file, the
// way `pick-expiry-gate.test.ts` does, and asserts the source it read is not
// empty so it cannot quietly cover nothing.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const HERE = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(join(HERE, 'pick-scan.ts'), 'utf8');
const workflows = readFileSync(join(HERE, 'scan-workflows.ts'), 'utf8');

/** The comments describe the old classifier on purpose; the code must not have
 *  it. Blanking them keeps this asserting about code alone. */
const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/[^\n]*$/gm, '');

/**
 * Every `outcome:` value ASSIGNED in the file, in order.
 *
 * A property, not a type member: `outcome: ScanOutcome;` inside an interface is
 * a declaration, and reading it as an assignment makes the rule below demand
 * that a type be one of the four literals. The trailing comma or brace is what
 * tells them apart: a type member ends in a semicolon.
 */
function outcomeValues(text: string): string[] {
  return [...text.matchAll(/\boutcome:\s*([^;,\n}]+)\s*[,}]/g)].map((m) => (m[1] ?? '').trim());
}

/** The outcome each `recordScan` writes, in source order. */
function recordedOutcomes(text: string): string[] {
  return [...text.matchAll(/recordScan\(tx,[\s\S]{0,400}?outcome: '(\w+)'/g)].map(
    (m) => m[1] ?? ''
  );
}

/** The outcome each transaction return hands back, in source order. */
function carriedOutcomes(text: string): string[] {
  return [...text.matchAll(/return \{[\s\S]{0,300}?outcome: '(\w+)',?\s*\} as const;/g)].map(
    (m) => m[1] ?? ''
  );
}

describe('a scan outcome is carried out of the transaction', () => {
  it('reads the files it is asserting about', () => {
    // The denominator. A moved or renamed file would make every assertion below
    // pass over nothing at all. [[feedback_structural_checks_go_blind]]
    expect(source.length).toBeGreaterThan(4000);
    expect(code).toContain('export async function scanToPick');
    expect(code).toContain('export async function scanToPack');
    expect(outcomeValues(code).length).toBeGreaterThanOrEqual(20);
  });

  it('never decides an outcome by reading the message it just wrote', () => {
    // The defect, stated as the rule. Any shape of it: includes, startsWith,
    // match, a regex search.
    const readsOwnMessage = /\bmessage\s*\??\.\s*(includes|startsWith|endsWith|match|search)\s*\(/;
    expect(readsOwnMessage.test(code), 'pick-scan classifies on its own copy').toBe(false);

    // And every assigned outcome is either a literal the code chose or the value
    // carried back from the transaction - never an expression that reads prose.
    for (const value of outcomeValues(code)) {
      expect(value, 'an outcome derived from something other than a decision').toMatch(
        /^('(applied|duplicate|not_found|rejected)'|recorded\.outcome)$/
      );
    }
  });

  it('returns the outcome the transaction decided, on every branch', () => {
    // Every branch records an outcome AND hands the SAME one back, in the same
    // order. Four branches each in `scanToPick` and `scanToPack`: the barcode is
    // unknown, the item is not wanted here, the shelf or the box is wrong, and
    // it worked. If a branch ever stops carrying its outcome, `recorded.outcome`
    // is `undefined` on that path and the answer becomes no outcome rather than
    // the wrong one, which is quieter and not better.
    const recorded = recordedOutcomes(code);
    expect(recorded).toEqual([
      'not_found',
      'rejected',
      'rejected',
      'applied',
      'not_found',
      'rejected',
      'rejected',
      'applied',
    ]);
    expect(carriedOutcomes(code)).toEqual(recorded);
  });

  it('still writes the message the classifier used to read', () => {
    // Not a spelling assertion. If this sentence disappears the scan has stopped
    // telling a picker why nothing happened, which is the complaint the whole
    // module exists to answer.
    expect(code).toContain('Nothing in the catalog matches');
    expect(workflows).toContain('Nothing in the catalog matches');
    // And the British spelling must not come back as a load-bearing string.
    expect(code).not.toContain('catalogue');
  });
});
