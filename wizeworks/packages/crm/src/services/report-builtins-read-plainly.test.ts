// THE EIGHT READY-MADE REPORTS ARE THE FIRST THING ANYBODY READS IN THE BUILDER.
//
// They are also the only user-facing sentences in this package that get WRITTEN
// INTO A TENANT'S DATABASE, which means a bad one is not a deploy away from
// being fixed — it needs a migration. That makes them worth a check the file
// cannot drift past.
//
// What went wrong, found on screen on 2026-09-25 while using the builder as a
// clothes maker:
//
//   • five em dashes, against a flat house rule, in rows seeded from a source
//     file that had already replaced every one of them with a colon
//   • "Closed-won value", "leads", "Open support requests" — sales vocabulary
//     on the screen that exists to teach a person to ask their own question
//   • "what your team should pick up first", on a console whose owner is a sole
//     trader with no team
//   • "Deals by stage" over a summary line reading "broken down by step"
//
// The slug list is asserted so a report that is renamed or dropped shows up
// here rather than slipping out of the check with it.

import { describe, expect, it } from 'vitest';

import { BUILTIN_REPORTS } from './report-builtins';

const SLUGS = [
  'deals-by-stage',
  'deals-won-by-month',
  'new-customers-by-month',
  'customers-by-stage',
  'spend-by-company',
  'requests-by-urgency',
  'requests-opened-by-week',
  'open-tasks-by-owner',
];

/** Words that belong to somebody who has worked in sales, or that assume the
 *  reader employs people. Each one was on this screen. */
const NOT_FOR_A_SHOP_OWNER = [
  'closed-won',
  'closed won',
  'lead',
  'your team',
  'support load',
  'pipeline',
];

describe('the ready-made reports', () => {
  it('are the eight this check knows about', () => {
    // The denominator. A file that had lost six of them would pass everything
    // below in silence.
    expect(BUILTIN_REPORTS.map((r) => r.slug).sort()).toEqual([...SLUGS].sort());
  });

  it('never reach for a dash instead of a word', () => {
    for (const report of BUILTIN_REPORTS) {
      expect(report.name, `the "${report.slug}" name`).not.toMatch(/[–—]/);
      expect(report.description, `the "${report.slug}" description`).not.toMatch(/[–—]/);
    }
  });

  it('say it in words a person who runs a shop already uses', () => {
    for (const report of BUILTIN_REPORTS) {
      const text = `${report.name} ${report.description}`.toLowerCase();
      for (const word of NOT_FOR_A_SHOP_OWNER) {
        expect(text.includes(word), `"${report.slug}" says "${word}"`).toBe(false);
      }
    }
  });

  it('give every report a name and a whole sentence under it', () => {
    for (const report of BUILTIN_REPORTS) {
      expect(report.name.trim().length, `the "${report.slug}" name`).toBeGreaterThan(0);
      // A description is what tells somebody whether to open it, so half of one
      // is worse than none: it reads as finished and answers nothing.
      expect(report.description.trim(), `the "${report.slug}" description`).toMatch(/\.$/);
      expect(report.description.trim().split(/\s+/).length).toBeGreaterThan(5);
    }
  });

  it('do not repeat their own name back in their description', () => {
    // "Open tasks by owner" was described as "Who is carrying what. Unfinished
    // tasks grouped by the person they belong to." The first sentence WAS the
    // better name, and printing both made the card say one thing twice.
    for (const report of BUILTIN_REPORTS) {
      expect(
        report.description.toLowerCase().startsWith(report.name.toLowerCase()),
        `"${report.slug}" opens its description with its own name`
      ).toBe(false);
    }
  });
});
