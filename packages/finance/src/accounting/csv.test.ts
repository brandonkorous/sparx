// RFC-4180 round-tripping.
//
// This is the fallback path that has to work when nothing else does — an
// accountant's export is not the place to discover a quoting bug — so the cases
// here are the ones real accounting files actually contain rather than the happy
// path: embedded commas and newlines, doubled quotes, CRLF, and Excel's BOM.

import { describe, expect, it } from 'vitest';

import { parseCsv, parseCsvObjects, toCsv } from './csv';

describe('toCsv', () => {
  it('quotes only what needs it, so a human can still read the file', () => {
    const out = toCsv(['Date', 'Description'], [['2027-03-04', 'Brake pads']]);
    expect(out).toBe('Date,Description\r\n2027-03-04,Brake pads\r\n');
  });

  it('quotes a field containing the delimiter', () => {
    expect(toCsv(['A'], [['Smith, John']])).toBe('A\r\n"Smith, John"\r\n');
  });

  it('doubles embedded quotes', () => {
    expect(toCsv(['A'], [['He said "hi"']])).toBe('A\r\n"He said ""hi"""\r\n');
  });

  it('quotes a field containing a newline', () => {
    expect(toCsv(['A'], [['line one\nline two']])).toBe('A\r\n"line one\nline two"\r\n');
  });

  it('renders null and undefined as empty, not as the words', () => {
    // `null` reaching a spreadsheet as the literal text "null" is the classic
    // export bug, and an accountant reading it has no way to know what happened.
    expect(toCsv(['A', 'B'], [[null, undefined]])).toBe('A,B\r\n,\r\n');
  });

  it('uses CRLF, because Excel on Windows is where this file is going', () => {
    expect(toCsv(['A'], [['1'], ['2']])).toBe('A\r\n1\r\n2\r\n');
  });
});

describe('parseCsv', () => {
  it('reads a quoted field containing the delimiter', () => {
    expect(parseCsv('A,B\r\n"Smith, John",5\r\n')).toEqual([
      ['A', 'B'],
      ['Smith, John', '5'],
    ]);
  });

  it('reads doubled quotes back as one', () => {
    expect(parseCsv('A\r\n"He said ""hi"""\r\n')).toEqual([['A'], ['He said "hi"']]);
  });

  it('reads a quoted field spanning a newline as ONE field', () => {
    expect(parseCsv('A,B\r\n"line one\nline two",5\r\n')).toEqual([
      ['A', 'B'],
      ['line one\nline two', '5'],
    ]);
  });

  it('accepts LF-only files', () => {
    expect(parseCsv('A,B\n1,2\n')).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ]);
  });

  it('strips the UTF-8 BOM Excel writes', () => {
    // Without this the first header parses as "<BOM>Date", so every lookup on
    // "Date" silently misses and the whole import maps to nothing.
    //
    // Written as an ESCAPE, never a literal: an invisible U+FEFF in source is
    // exactly the character that survives a copy-paste and confuses the next
    // reader — and eslint's no-irregular-whitespace rejects it outright.
    const bom = String.fromCharCode(0xfeff);
    const rows = parseCsv(`${bom}Date,Amount\r\n2027-03-04,10\r\n`);
    expect(rows[0]).toEqual(['Date', 'Amount']);
    // Guard the guard: if the BOM ever stopped reaching the parser this test
    // would pass for the wrong reason.
    expect(bom.charCodeAt(0)).toBe(0xfeff);
  });

  it('does not emit a trailing blank row for a final newline', () => {
    expect(parseCsv('A\r\n1\r\n')).toHaveLength(2);
  });

  it('keeps empty fields rather than collapsing them', () => {
    expect(parseCsv('A,B,C\r\n1,,3\r\n')[1]).toEqual(['1', '', '3']);
  });

  it('round-trips anything toCsv produced', () => {
    const headers = ['Date', 'Vendor', 'Note'];
    const rows = [
      ['2027-03-04', 'Smith, John', 'He said "hi"'],
      ['2027-03-05', 'NAPA', 'line one\nline two'],
    ];
    expect(parseCsv(toCsv(headers, rows))).toEqual([headers, ...rows]);
  });
});

describe('parseCsvObjects', () => {
  it('keys rows by header name', () => {
    expect(parseCsvObjects('Date,Amount\r\n2027-03-04,10\r\n')).toEqual([
      { Date: '2027-03-04', Amount: '10' },
    ]);
  });

  it('is empty for a headers-only file rather than throwing', () => {
    expect(parseCsvObjects('Date,Amount\r\n')).toEqual([]);
  });

  it('fills missing trailing cells with empty strings', () => {
    // A short row is common in hand-edited exports; it must not shift columns.
    expect(parseCsvObjects('A,B,C\r\n1,2\r\n')).toEqual([{ A: '1', B: '2', C: '' }]);
  });

  it('supports a semicolon delimiter', () => {
    expect(parseCsvObjects('A;B\r\n1;2\r\n', ';')).toEqual([{ A: '1', B: '2' }]);
  });
});
