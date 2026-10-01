// A PROMISED DAY THAT HAS GONE BY MUST SAY SO.
//
// EDIT THIS FILE WITH AN EDITOR, NEVER THROUGH A SHELL HEREDOC. A heredoc eats
// a backslash, and `\b` inside a template literal is a BACKSPACE character, not
// a word boundary — which is how a spelling guard once scanned 686 files and
// reported everything clean over four real drifts (issue 583). Every pattern
// below is `String.raw`.
//
// ── What she saw ────────────────────────────────────────────────────────────
//
// On the thirtieth of September, one row on her orders list:
//
//     O-000018   Tamsin Vale   Sep 20, 2026   Part paid   To collect   $52.00
//     Due Fri, Sep 25
//
// and, on the order's own pane, in the same unhurried color it would wear for a
// day next month:
//
//     Due Friday, September 25
//     Something on this order has to be made first, so this is the earliest day
//     it can be collected.
//
// Present tense, about a day five days gone. Nothing on either screen said the
// promise had been missed (issue 896).
//
// The console already says this everywhere else. A bill she owes says "3 days
// late". A deal she is chasing says "2 days late". Stock she is waiting on from
// a supplier has an entire screen called What is overdue, sorted by money. The
// one promise it would not call late was the one made to a CUSTOMER.
// [[feedback_a_fix_leaves_its_neighbour_behind]]
//
// ── Why these tests ─────────────────────────────────────────────────────────
//
// The first group drives the rule itself from both sides of today, because the
// bug was that one side of today rendered as the other. The second group reads
// the two SOURCE files, because a rule kept in a shared helper is only kept
// while the screens keep calling it — the defect this replaces was a screen
// formatting its own date, and nothing about a hand-rolled
// `toLocaleDateString` fails a type check or a render test.
// [[feedback_structural_checks_go_blind]]

import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

import { dueDaySignal } from './days';

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKBENCH = resolve(HERE, '..', '..');
const COMMERCE = join(WORKBENCH, 'surfaces', 'commerce');

/** The day the defect was found, at a moment that is the 30th in Denver and
 *  ALREADY the 1st in UTC — so a rule that quietly counts on the server's
 *  calendar gives a different answer here and the timezone test can see it. */
const DENVER_EVENING = new Date('2026-10-01T02:00:00.000Z');
const ZONE = 'America/Denver';

/** The call that proves a screen is using the shared rule rather than its own.
 *  The open bracket is load-bearing: an unused import left behind by a deleted
 *  call satisfies a name-only check, which is exactly how a guard of mine
 *  stayed green over a fix I had just removed. [[feedback_a_test_that_cannot_go_red]] */
const SIGNAL_CALL = String.raw`\bdueDaySignal\s*\(`;

/** A date formatted by hand in a place that should be asking the shared rule
 *  what the day MEANS. Finding one is not automatically wrong — the orders row
 *  still prints the day itself beside the count — so this is asserted together
 *  with the call above, never instead of it. */
const HAND_ROLLED = String.raw`toLocaleDateString\s*\(`;

function read(file: string): string {
  const text = readFileSync(join(COMMERCE, file), 'utf8');
  // Refuse rather than pass over nothing. If either file is moved or renamed,
  // every assertion below would otherwise be asked of an empty string.
  expect(
    text.length,
    `${file} is empty or unreadable — this guard is reading nothing`
  ).toBeGreaterThan(500);
  return text;
}

describe('a promised day says whether it has gone by', () => {
  it('counts a day that has passed, and names it', () => {
    const five = dueDaySignal('2026-09-25', DENVER_EVENING, ZONE);
    expect(five).not.toBeNull();
    expect(five?.label).toBe('5 days late');
    expect(five?.tone).toBe('danger');
    expect(five?.late).toBe(true);
    expect(five?.days).toBe(5);
  });

  it('says "1 day late", never "1 days late"', () => {
    expect(dueDaySignal('2026-09-29', DENVER_EVENING, ZONE)?.label).toBe('1 day late');
  });

  it('does not call today late, and does not call tomorrow a date', () => {
    const today = dueDaySignal('2026-09-30', DENVER_EVENING, ZONE);
    expect(today?.label).toBe('Due today');
    expect(today?.late).toBe(false);
    expect(dueDaySignal('2026-10-01', DENVER_EVENING, ZONE)?.label).toBe('Due tomorrow');
  });

  it('warns for the week ahead and then stops warning', () => {
    expect(dueDaySignal('2026-10-05', DENVER_EVENING, ZONE)?.label).toBe('Due in 5 days');
    expect(dueDaySignal('2026-10-07', DENVER_EVENING, ZONE)?.tone).toBe('warning');
    // Beyond the week it hands back no words at all, so the caller prints the
    // date. An empty label is the signal, and it must not be mistaken for late.
    const far = dueDaySignal('2026-11-30', DENVER_EVENING, ZONE);
    expect(far?.label).toBe('');
    expect(far?.tone).toBe('module');
    expect(far?.late).toBe(false);
  });

  it('counts on the shop’s calendar, not the server’s', () => {
    // It is the 30th in Denver and the 1st in UTC. An order due on the 30th is
    // due TODAY for her and would be "1 day late" counted in UTC — which is the
    // whole reason the zone is threaded through.
    expect(dueDaySignal('2026-09-30', DENVER_EVENING, ZONE)?.label).toBe('Due today');
    expect(dueDaySignal('2026-09-30', DENVER_EVENING, 'UTC')?.label).toBe('1 day late');
  });

  it('keeps "no day was promised" apart from "the day has not come"', () => {
    // Null is not zero. A day nobody set must render nothing, never "Due today".
    expect(dueDaySignal(null, DENVER_EVENING, ZONE)).toBeNull();
    expect(dueDaySignal(undefined, DENVER_EVENING, ZONE)).toBeNull();
    expect(dueDaySignal('', DENVER_EVENING, ZONE)).toBeNull();
  });
});

describe('the two screens that show a promised day ask the shared rule', () => {
  it('the orders row asks it', () => {
    expect(read('orders-table.tsx')).toMatch(new RegExp(SIGNAL_CALL));
  });

  it('the order pane asks it', () => {
    expect(read('order-detail-due-day.tsx')).toMatch(new RegExp(SIGNAL_CALL));
  });

  it('the order pane does not go back to formatting its own day', () => {
    // The pane has no reason to format a date itself: `readyOnLabel` spells the
    // day and `dueDaySignal` says what it means. A `toLocaleDateString` here is
    // the fingerprint of the rule being worked around again.
    expect(read('order-detail-due-day.tsx')).not.toMatch(new RegExp(HAND_ROLLED));
  });

  it('neither screen leaves the promised day in one fixed color', () => {
    // The original defect was not only silence. It was that `text-module` was
    // hard-coded on the line, so late and not-late could not look different
    // even once something said which was which.
    const row = read('orders-table.tsx');
    expect(row, 'the due line is pinned to one ink again').toMatch(
      new RegExp(String.raw`DUE_INK\s*\[`)
    );
    expect(read('order-detail-due-day.tsx'), 'the alert color no longer moves').toMatch(
      new RegExp(String.raw`late\s*\?\s*'danger'`)
    );
  });
});
