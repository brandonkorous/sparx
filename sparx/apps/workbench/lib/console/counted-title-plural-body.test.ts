// A BAND THAT COUNTS IN ITS HEADING MUST NOT ASSUME "MORE THAN ONE" IN ITS BODY.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary (issue 583). Every pattern below is `String.raw`.
//
// ── What went wrong ──────────────────────────────────────────────────────────
//
// Seventeen warning bands in the inventory module counted correctly in the
// title and then spoke as if there were many:
//
//     1 shipment was due and have not arrived
//     The supplier believes they have sent these.
//
//     1 commitment is past the date you gave
//     These customers were told a date that has now gone by.
//
//     1 item is sharing a barcode with something else
//     These codes were left off the scan list.
//
// A small business is the one that lands on 1, which is exactly the reader this
// console is written for. The titles were all careful — every one of them used
// `plural()` — and the sentence underneath threw it away.
//
// ── What this checks ─────────────────────────────────────────────────────────
//
// An `<Alert>` whose TITLE counts (a `plural(...)` or a `=== 1 ?`) and whose
// BODY carries a bare plural pronoun (they/them/their/these/those) with no
// conditional of its own. That is the shape, and nothing else.
//
// Fixing it is usually not a conditional. Number-neutral wording reads at least
// as well and cannot come back: "They are listed below" becomes "Listed below",
// and "Those units are counted but not valued" becomes "That stock is counted
// but not valued".

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SURFACES = join(__dirname, '..', '..', 'surfaces');

/** A number-bearing word that a body cannot use when the count may be one. */
const PLURAL_WORD = String.raw`\b(they|them|their|these|those)\b`;

/** The title counted, so the body has to as well. Newline-tolerant, because
 *  prettier breaks a ternary across lines and a pattern that assumed one line
 *  reported an already-correct band as broken. */
const COUNTS = String.raw`plural\(|===\s*1\s*\?|>\s*1\s*\?`;

/**
 * Bands read and judged correct, with the reason.
 *
 * Keyed by file AND by a phrase from the body, so a NEW band in the same file
 * is not excused by an old decision — which is the way an allowlist normally
 * goes blind.
 */
const REVIEWED: { file: string; phrase: string; because: string }[] = [
  {
    file: 'inventory/backorders.tsx',
    phrase: 'Nobody has told them anything',
    because: '"them" is a person, and singular they is correct English for one.',
  },
  {
    file: 'inventory/pick-list-detail.tsx',
    phrase: 'Those units have gone back into stock',
    because: 'The count is of LINES; one line still holds several units.',
  },
  {
    file: 'inventory/supplier-scorecards.tsx',
    phrase: 'each of those needs something to',
    because: '"those" is the four measures, and there are always four of them.',
  },
  {
    file: 'inventory/planning-holding.tsx',
    phrase: 'higher than these figures say',
    because: '"these figures" is the three stats above the band, never one.',
  },
  {
    file: 'staff/timesheets.tsx',
    phrase: 'Open their record and add a rate',
    because: '"their" is one person here, and singular they is correct for one.',
  },
];

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...tsxFiles(full));
      continue;
    }
    if (entry.endsWith('.tsx') && !entry.endsWith('.test.tsx')) out.push(full);
  }
  return out;
}

interface Band {
  where: string;
  title: string;
  body: string;
}

/** Every `<Alert>` block in the tree, with its title and body separated. */
function alertBands(): Band[] {
  const bands: Band[] = [];
  for (const file of tsxFiles(SURFACES)) {
    const lines = readFileSync(file, 'utf8').split('\n');
    const rel = file.slice(SURFACES.length + 1).replace(/\\/g, '/');
    for (let i = 0; i < lines.length; i += 1) {
      if (!/<Alert\b/.test(lines[i] ?? '')) continue;
      let end = i;
      while (end < lines.length && !(lines[end] ?? '').includes('</Alert>')) end += 1;
      const block = lines.slice(i, Math.min(end + 1, lines.length)).join('\n');
      const split = block.indexOf('</AlertTitle>');
      bands.push({
        where: `${rel}:${String(i + 1)}`,
        title: split === -1 ? '' : block.slice(0, split),
        body: split === -1 ? block : block.slice(split),
      });
      i = end;
    }
  }
  return bands;
}

function mismatched(): { where: string; said: string }[] {
  const counting = new RegExp(COUNTS);
  // Case-INSENSITIVE. Without the flag this missed every sentence that opened
  // with "These" or "They", which is most of them. The matcher self-test below
  // is what caught it.
  const plural = new RegExp(PLURAL_WORD, 'i');
  const out: { where: string; said: string }[] = [];
  for (const band of alertBands()) {
    if (!counting.test(band.title)) continue;
    if (!plural.test(band.body)) continue;
    // A body that counts for itself has been thought about.
    if (counting.test(band.body)) continue;
    const excused = REVIEWED.some(
      (entry) => band.where.startsWith(entry.file) && band.body.includes(entry.phrase)
    );
    if (excused) continue;
    out.push({
      where: band.where,
      said: new RegExp(PLURAL_WORD, 'i').exec(band.body)?.[0] ?? '',
    });
  }
  return out;
}

describe('a band that counts in its title counts in its body', () => {
  it('finds the shape it is looking for', () => {
    // The matcher, tested before anything trusts what it reports.
    expect(new RegExp(COUNTS).test("{plural(overdue, 'item is', 'items are')} overdue")).toBe(true);
    expect(new RegExp(COUNTS).test('{paused.length === 1\n  ? ')).toBe(true);
    expect(new RegExp(PLURAL_WORD, 'i').test('These codes were left off the scan list.')).toBe(
      true
    );
    expect(new RegExp(PLURAL_WORD, 'i').test('Listed below rather than left out.')).toBe(false);
    // "it" and "theirs-free" prose must not trip it.
    expect(new RegExp(PLURAL_WORD, 'i').test('That stock is counted but not valued.')).toBe(false);
  });

  it('reads enough of the tree to mean anything', () => {
    // The denominators, asserted. A scan whose root moved finds nothing and
    // reports everything clean ([[feedback_structural_checks_go_blind]]).
    expect(tsxFiles(SURFACES).length).toBeGreaterThan(150);
    expect(alertBands().length).toBeGreaterThan(60);
  });

  it('has a reason recorded for every band it excuses', () => {
    for (const entry of REVIEWED) {
      expect(entry.because.length, entry.file).toBeGreaterThan(20);
    }
  });

  it('never says "these" about something there may be one of', () => {
    expect(mismatched()).toEqual([]);
  });
});
