// Every column the import OFFERS must be a column the import READS.
//
// ── The defect this exists for ───────────────────────────────────────────────
//
// `COLUMNS` is the import's public vocabulary. The template Piggles hands out is
// built from it, the mapping screen lists it, and the parser recognises each
// heading under two or three spellings. It is, in effect, a promise: put a value
// in this column and the import will use it.
//
// `note` sat in that list from the beginning. The template wrote the heading.
// The parser knew `note`, `notes` and `comment`. And `COLUMNS.note` was passed
// to `read()` exactly never, so the value was dropped at parse time and every
// movement said "Imported from <file>, row N" however carefully somebody had
// explained the difference.
//
// On a stock-take that is the whole point of the column. A shop owner counts a
// rail, finds two missing, writes "two went to the window display" beside it,
// and months later the stock history says only that a spreadsheet was imported.
// The one explanation anybody would ever want was typed, uploaded, parsed and
// thrown away. [[feedback_fetched_but_never_rendered]]
//
// ── Why the source, and not a behavioral test ────────────────────────────────
//
// A behavioral test needs a database, so it is one of the suites CI skips, and
// it would only cover the columns somebody remembered to write a case for. This
// reads the file: a column added to `COLUMNS` next year is covered the moment it
// is added, and the check cannot silently cover nothing, because it asserts the
// list it found is not empty and names every key it checked.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), 'adjustment-import.ts'),
  'utf8'
);

/** The keys declared in the `COLUMNS` literal. */
function declaredColumns(): string[] {
  const start = source.indexOf('const COLUMNS = {');
  expect(start, 'the COLUMNS literal moved or was renamed').toBeGreaterThan(-1);
  const end = source.indexOf('} as const;', start);
  expect(end, 'the COLUMNS literal is no longer closed with `} as const;`').toBeGreaterThan(start);
  // flatMap rather than map: the capture group is typed `string | undefined`,
  // and a `?? ''` would put an unnamed column in the list that every assertion
  // below would then quietly pass over.
  return [...source.slice(start, end).matchAll(/^\s{2}(\w+):/gm)].flatMap((m) =>
    m[1] === undefined ? [] : [m[1]]
  );
}

describe('the import column vocabulary', () => {
  const columns = declaredColumns();

  it('declares the columns the template and the mapping screen are built from', () => {
    // A denominator, so a refactor that empties the list fails here rather than
    // passing over nothing. [[feedback_structural_checks_go_blind]]
    expect(columns.length).toBeGreaterThanOrEqual(8);
    expect(columns).toContain('sku');
    expect(columns).toContain('note');
  });

  it.each(columns)('reads the value a person puts in the %s column', (key) => {
    // `read(record, '<key>', COLUMNS.<key>)` is the only way a column's value
    // enters the plan. A key that never appears in one is a heading the import
    // offers and then discards in silence.
    const reads = new RegExp(`read\\(\\s*record,\\s*'[\\w]+',\\s*COLUMNS\\.${key}\\b`);
    expect(
      reads.test(source),
      `COLUMNS.${key} is offered in the template and recognised by the parser, ` +
        `but its value is never read into the plan. Either read it, or take it out ` +
        `of COLUMNS so the import stops promising it.`
    ).toBe(true);
  });
});

/**
 * EVERY HEADING THE TEMPLATE WRITES MUST BE ONE THE PARSER READS BACK.
 *
 * 10.6 says an export re-imports without editing, and the only thing holding
 * that up is that the two lists agree. They agree by hand: the template writes
 * a heading, `COLUMNS` lists the spellings the parser accepts, and nothing
 * checked that the first is in the second.
 *
 * It came within one commit of breaking. The counting sheet's headings were
 * rewritten for the person who prints it (`on_hand` to "On the shelf"), which
 * is right, and it is exactly the change that silently ends the round trip if
 * the parser is not taught the new word at the same time.
 *
 * `Item` and `Version` are informational and deliberately not in `COLUMNS`:
 * a person needs to see what they are counting and the parser needs to not
 * care. Custom-field columns are keyed `cf_<key>` and read by their own path.
 */
describe('the counting sheet re-imports', () => {
  /** The literal headings `adjustmentTemplate` writes. */
  function templateHeaders(): string[] {
    const at = source.indexOf("name: 'stock-count'");
    expect(at, 'the stock-count template moved or was renamed').toBeGreaterThan(-1);
    const start = source.indexOf('headers: [', at);
    const end = source.indexOf('],', start);
    expect(end, 'the template headers list is no longer closed').toBeGreaterThan(start);
    return [...source.slice(start, end).matchAll(/'([^']+)'/g)].flatMap((m) =>
      m[1] === undefined ? [] : [m[1]]
    );
  }

  /** Every spelling in the `COLUMNS` literal, lower-cased the way `parseCsv` keys. */
  function acceptedSpellings(): string[] {
    const start = source.indexOf('const COLUMNS = {');
    const end = source.indexOf('} as const;', start);
    return [...source.slice(start, end).matchAll(/'([^']+)'/g)].flatMap((m) =>
      m[1] === undefined ? [] : [m[1].toLowerCase()]
    );
  }

  /** Written for the person carrying the sheet, not for the database. */
  const INFORMATIONAL = new Set(['item', 'version']);

  const headers = templateHeaders();
  const accepted = acceptedSpellings();

  it('writes a sheet with headings on it', () => {
    // The denominator, so a refactor that empties either list fails here rather
    // than passing over nothing. [[feedback_structural_checks_go_blind]]
    expect(headers.length).toBeGreaterThanOrEqual(6);
    expect(accepted.length).toBeGreaterThanOrEqual(20);
  });

  it.each(headers.filter((h) => !INFORMATIONAL.has(h.toLowerCase())))(
    'reads the "%s" column back in',
    (header) => {
      expect(
        accepted.includes(header.toLowerCase()),
        `The counting sheet writes a "${header}" column and COLUMNS does not accept ` +
          `that spelling, so a sheet exported today no longer re-imports. Add it as ` +
          `the first alias for its field.`
      ).toBe(true);
    }
  );

  it('says the headings in words a person carrying the sheet would use', () => {
    for (const header of headers) {
      expect(
        header,
        `"${header}" is a database column name on a sheet somebody prints`
      ).not.toMatch(/_/);
    }
  });
});
