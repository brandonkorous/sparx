// THE SPREADSHEET SHE IS EMAILED IS WRITTEN FOR HER, NOT FOR THE DATABASE.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// A shop owner sets up "What the rail is worth this month", and once a month a
// spreadsheet lands in her inbox. Its columns read:
//
//     total_units, total_allocated, total_available, total_cost_cents,
//     total_retail_cents, non_owned_units, non_owned_value_cents, currency
//
// MEASURED 2026-09-19: 19 reports, 169 header cells, 95 of them with an
// underscore in, 24 of them ending `_cents`. The console spends its whole
// vocabulary keeping a database word off the screen, and then mails her one.
//
// `_cents` was worse than a name. The value was the stored integer, so a
// business with 1,934.56 of stock got a column called `total_cost_cents`
// holding `193456`, and the number she wanted was the one thing the file did
// not contain. Money goes through `csvMoney` now, which writes `1934.56`: a
// plain decimal with no symbol and no grouping, because a spreadsheet reads
// that as a number and `GBP 1,934.56` as text, and text cannot be summed.
//
// ── Why the source, and not a behavioral test ────────────────────────────────
//
// Running the reports needs a database, so those suites are the ones CI skips,
// and a case per report would only cover the ones somebody remembered. This
// reads the registry: a report added next year is covered the moment its
// headers are written, and the check cannot silently cover nothing, because it
// asserts how many reports and how many cells it found.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { toCsv } from '../csv';
import { REPORTS } from './report-registry';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'report-registry.ts'),
  'utf8'
);

/** Every `headers: [...]` list in the registry, with the report it belongs to. */
function headerLists(): { report: string; cells: string[] }[] {
  const out: { report: string; cells: string[] }[] = [];
  const blocks = source.split(/\n(?= {2}key: ')/);
  for (const block of blocks) {
    const key = /key: '([a-z_]+)'/.exec(block);
    const headers = /headers: \[([\s\S]*?)\]/.exec(block);
    if (key?.[1] === undefined || headers?.[1] === undefined) continue;
    out.push({
      report: key[1],
      cells: [...headers[1].matchAll(/'([^']+)'/g)].flatMap((m) =>
        m[1] === undefined ? [] : [m[1]]
      ),
    });
  }
  return out;
}

const lists = headerLists();
const cells = lists.flatMap((l) => l.cells);

describe('the report registry', () => {
  it('found the reports and their columns', () => {
    // The denominator. A refactor that moves the registry must fail here rather
    // than pass over nothing. [[feedback_structural_checks_go_blind]]
    expect(lists.length).toBeGreaterThanOrEqual(19);
    expect(cells.length).toBeGreaterThanOrEqual(160);
  });

  it.each(lists)('$report writes its columns in words', ({ report, cells: own }) => {
    expect(own.length, `${report} exports a CSV with no columns`).toBeGreaterThan(0);
    for (const cell of own) {
      expect(cell, `${report} has a column called "${cell}", which is a database name`).not.toMatch(
        /_/
      );
      expect(cell, `${report}'s "${cell}" is in the smallest unit, so it reads 193456`).not.toMatch(
        /cents$/i
      );
      // A heading starts like a sentence, because that is what it is.
      expect(cell[0], `${report}'s "${cell}" does not start with a capital`).toBe(
        cell[0]?.toUpperCase()
      );
    }
  });

  it('sends money through csvMoney, every time', () => {
    // 24 money columns, 24 conversions. A new one added raw would land in her
    // spreadsheet as an integer nobody can read.
    const conversions = [...source.matchAll(/csvMoney\(/g)].length;
    expect(conversions).toBeGreaterThanOrEqual(24);
    // No bare `…Cents` value left standing as its own cell in a rows array.
    const bare = [...source.matchAll(/^\s+[A-Za-z_$][\w.?]*Cents,?$/gm)].map((m) => m[0].trim());
    expect(bare, 'a money cell is still written in the smallest unit').toEqual([]);
  });
});

/**
 * The bytes, not the source. Juniper Row's own figures, which is where this
 * started: 193456 stored, 1,934.56 of stock, and a column heading that said
 * neither.
 */
describe('the file that lands in her inbox', () => {
  it('reads as money, under headings she would use', () => {
    const valuation = REPORTS.find((report) => report.key === 'valuation');
    if (valuation === undefined) throw new Error('the valuation report left the registry');
    const csv = toCsv(
      valuation.csv({
        totalUnits: 498,
        totalAllocated: 12,
        totalAvailable: 486,
        totalCostCents: 193456,
        totalRetailCents: 4106600,
        currency: 'USD',
        nonOwnedUnits: 0,
        nonOwnedValueCents: 0,
        uncostedUnits: 375,
      })
    ).replace(/^\uFEFF/, '');

    const [heading, row] = csv.trim().split(/\r?\n/);
    expect(heading).toBe(
      'Units on hand,Units spoken for,Units free to sell,Total cost,Total retail value,Units not owned by you,Value not owned by you,Currency'
    );
    expect(row).toBe('498,12,486,1934.56,41066.00,0,0.00,USD');
  });
});
