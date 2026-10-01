// A COLUMN THAT NAMES A DISTINCTION MUST NAME BOTH SIDES OF IT.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary — which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What she saw ────────────────────────────────────────────────────────────
//
// Groups of customers, nine rows, under a column headed **State**:
//
//     At Risk                      No members yet    Built-in
//     B2B Fleet                    No members yet    Built-in
//     Early Access                 No members yet    Built-in
//     High Value                   No members yet    Built-in
//     New Customers                6 customers       Built-in
//     Newsletter Subscribers       23 customers      Built-in
//     Bought in the last 90 days   8 customers       Active
//     Email engaged                No members yet    Active
//     VIP customers                No members yet    Active
//
// Six say one word and three say another, in one column, under a header asking
// what state they are in. Read down it and the six look like the ones that are
// NOT active — four of them with no members, which only confirms it. All nine
// were running. "Built-in" is not a state; it is where a group came from, and it
// was sitting in the only slot that could have said whether the thing was on.
//
// The badge could only ever show ONE of the two facts, so whichever it showed,
// the other was unavailable: a built-in never said it was in use, and a custom
// one never said it was hers.
//
// ── The answer was already next door ────────────────────────────────────────
//
// `crm/object-types-list.tsx`, one row down the same menu, had settled this: its
// column is headed **Kind**, it always names BOTH sides, and it lets the put-away
// mark ride beside the NAME where a state belongs. Its comment even says why —
// "Built-in vs yours is a real distinction ... so it wears a real color rather
// than a grey chip." This is that pattern, applied here (issue 895).
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Why a source guard ──────────────────────────────────────────────────────
//
// The defect is the PAIRING of a header with a set of values. Each badge was
// correct about the row it sat on; nothing rendered wrongly. Only reading the
// header and the values together catches it, which is what this does.

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SOURCE = resolve(dirname(fileURLToPath(import.meta.url)), 'segments-list.tsx');

/** The badge function, from its name to the closing brace of its declaration.
 *  Scoped deliberately: the words banned inside it are perfectly fine elsewhere
 *  in the file — this console's scope filter is allowed to say "Active". */
const KIND_BADGE = String.raw`function KindBadge\([\s\S]*?\n\}`;

/** Every `<th>` cell, so the header can be read as the list of questions the
 *  table claims to answer. */
const HEADERS = String.raw`<th[^>]*>([^<]+)</th>`;

function source(): string {
  return readFileSync(SOURCE, 'utf8');
}

function kindBadge(): string {
  const found = new RegExp(KIND_BADGE).exec(source());
  // Refuse rather than pass over nothing. A rename of this function must redden
  // here with a sentence, not quietly make every assertion below vacuous.
  // [[feedback_structural_checks_go_blind]]
  expect(
    found,
    'KindBadge is gone from segments-list.tsx — this guard is reading nothing'
  ).not.toBeNull();
  return found![0];
}

function headers(): string[] {
  return [...source().matchAll(new RegExp(HEADERS, 'g'))].map((m) => m[1]!.trim());
}

describe('the customer groups list says which side a group is on', () => {
  it('still has a table of headed columns to read', () => {
    // The denominator. Four columns were there when this was written; a rewrite
    // that drops the table must redden here rather than leave the questions
    // below asked of an empty list.
    expect(headers().length, `headers found: ${headers().join(' | ')}`).toBeGreaterThanOrEqual(4);
  });

  it('does not head a column "State" and then answer with an origin', () => {
    expect(headers()).not.toContain('State');
    expect(headers()).toContain('Kind');
  });

  it('names both sides, so neither is left to be inferred', () => {
    const badge = kindBadge();
    // The side she made. Fixed here because it is the same word on both
    // consoles and it is the half that used to be missing entirely.
    expect(badge, 'the custom side has no name').toContain('Yours');
    // The side that came with the app. The word itself is the console's to
    // choose, so what is pinned is that the branch renders SOMETHING rather
    // than falling through to nothing.
    expect(badge).toMatch(new RegExp(String.raw`segment\.isBuiltIn\s*\?`));
    expect(badge, 'a branch renders nothing, so that side goes unnamed').not.toMatch(
      new RegExp(String.raw`:\s*null`)
    );
  });

  it('keeps state words out of the column that answers a different question', () => {
    const badge = kindBadge();
    for (const word of ['Active', 'Archived', 'Put away', 'archivedAt']) {
      expect(badge, `"${word}" is a state, and this column is not about state`).not.toContain(word);
    }
  });

  it('puts the put-away mark beside the name, where a state belongs', () => {
    // Within a few lines of the name, not in the kind column. The number is
    // generous on purpose: this pins WHERE the mark lives, not how the cell is
    // laid out.
    const text = source();
    const nameAt = text.indexOf('{segment.name}');
    expect(nameAt, 'the name cell is gone').toBeGreaterThan(-1);
    const nearName = text.slice(nameAt, nameAt + 400);
    expect(nearName, 'nothing beside the name says a group has been put away').toContain(
      'segment.archivedAt'
    );
  });

  it('is reading a real file and not an empty one', () => {
    // If the path ever stops resolving, `readFileSync` throws rather than
    // returning '' — but a file that has been emptied would not, and every
    // regex above would simply find nothing.
    expect(source().length).toBeGreaterThan(1000);
    expect(source()).toContain('SegmentsListSurface');
  });
});
