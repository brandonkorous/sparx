// CSV, both directions, in one place (docs/146 Phase 10.3 + 10.6).
//
// 10.6 asks that every export re-import without editing. That is not a testing
// requirement, it is a structural one: it holds only if the writer and the
// reader share a definition of what a CSV is. Two implementations — even two
// good ones — will disagree about a quoted comma, a leading BOM, or a trailing
// blank line within a month of each other, and the failure surfaces as "your
// file is invalid" pointing at a file this platform produced.
//
// So there is one writer, one reader, and one place that names the columns.
//
// ── The details that actually break round-trips ──────────────────────────────
//
//   BOM        Excel writes a UTF-8 byte-order mark and will mis-decode
//              accented characters without one. It is written on export and
//              stripped on import; a BOM left on the first header turns `sku`
//              into a header nothing matches.
//   CRLF       Excel writes \r\n. The reader accepts either; the writer emits
//              \r\n because the reader on the other end is usually Excel.
//   Quotes     A field containing a comma, a quote or a newline is quoted, and
//              inner quotes are doubled. The reader honours quoted newlines,
//              so a note field with a line break survives the trip.
//   Blank rows A trailing newline is normal and must not parse as an empty row.
//   Headers    Compared case-insensitively and trimmed. A spreadsheet that
//              capitalises "SKU" is not a different file.

export type CsvValue = string | number | boolean | Date | null | undefined;

const BOM = '﻿';
const EOL = '\r\n';

/** One cell, escaped. Dates go out as ISO-8601 so the value survives a locale. */
export function csvCell(value: CsvValue): string {
  if (value === null || value === undefined) return '';
  const text =
    value instanceof Date
      ? value.toISOString()
      : typeof value === 'boolean'
        ? value
          ? 'true'
          : 'false'
        : String(value);
  // A leading space or a value that Excel would read as a formula both need
  // quoting; the formula case (=, +, -, @) is also prefixed, see below.
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Neutralise a cell a spreadsheet would execute.
 *
 * A value beginning `=`, `+`, `-` or `@` is a formula to Excel, and a SKU or a
 * note is a place a person can type one. Prefixing a single quote is the
 * standard defence and is invisible in the sheet. Applied only to free-text
 * columns — doing it to numbers would break the round-trip.
 */
export function csvSafeText(value: string | null | undefined): string | null {
  if (value === null || value === undefined || value === '') return value ?? null;
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

export interface CsvTable {
  /** Without the `.csv` — the route adds the extension and the tenant prefix. */
  name: string;
  headers: string[];
  rows: CsvValue[][];
}

/** Serialise a table. Includes the BOM, so the file opens correctly by
 *  double-click on Windows, which is how most of these will be opened. */
export function toCsv(table: CsvTable): string {
  const lines = [table.headers, ...table.rows].map((row) => row.map(csvCell).join(','));
  return BOM + lines.join(EOL) + EOL;
}

// ─── Reading ─────────────────────────────────────────────────────────────────

export interface CsvParseResult {
  /** Lower-cased, trimmed header names, in file order — the keys of `records`. */
  headers: string[];
  /** The headings EXACTLY as the file wrote them, in the same order.
   *
   *  Kept because a mapping screen has to show a person their own column names.
   *  "Qty On Hand" rendered back as "qty on hand" reads as sparx having mangled
   *  their file, and it is the first thing they see. */
  rawHeaders: string[];
  /** One record per data row, keyed by header. Missing trailing cells read as
   *  empty strings rather than undefined, so a short row is a row with blanks
   *  and not a row with a different shape. */
  records: Record<string, string>[];
  /** 1-based line numbers, parallel to `records`, counting the header as 1.
   *  Reported back to the operator so "row 148 has no SKU" names the line they
   *  will actually find when they open the file. */
  lines: number[];
}

/**
 * Parse a CSV document.
 *
 * A character-at-a-time reader rather than a split-on-comma, because the
 * fields that break the naive version — a note containing a comma, an address
 * containing a newline — are exactly the fields people put commas and newlines
 * in. Quoted newlines are honoured, so `lines` tracks the PHYSICAL line the
 * record started on.
 */
export function parseCsv(text: string): CsvParseResult {
  const source = text.startsWith(BOM) ? text.slice(1) : text;
  const rows: { cells: string[]; line: number }[] = [];

  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let line = 1;
  let rowStartLine = 1;
  let rowHasContent = false;

  const endCell = (): void => {
    cells.push(cell);
    cell = '';
  };
  const endRow = (): void => {
    endCell();
    // A row of nothing but empty cells is blank padding, not a record. Trailing
    // newlines and the blank line Excel likes to leave at the end both land here.
    if (rowHasContent) rows.push({ cells, line: rowStartLine });
    cells = [];
    rowHasContent = false;
    rowStartLine = line + 1;
  };

  for (let i = 0; i < source.length; i++) {
    const ch = source[i];
    if (inQuotes) {
      if (ch === '"' && source[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        if (ch === '\n') line++;
        cell += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
      rowHasContent = true;
    } else if (ch === ',') {
      endCell();
    } else if (ch === '\r') {
      // Swallowed; the \n that follows ends the row. A lone \r also ends it.
      if (source[i + 1] !== '\n') {
        endRow();
        line++;
      }
    } else if (ch === '\n') {
      endRow();
      line++;
    } else {
      if (ch !== undefined && ch.trim() !== '') rowHasContent = true;
      cell += ch;
    }
  }
  if (cell !== '' || cells.length > 0) endRow();

  const header = rows.shift();
  if (!header) return { headers: [], rawHeaders: [], records: [], lines: [] };

  const rawHeaders = header.cells.map((h) => h.trim());
  const headers = rawHeaders.map((h) => h.toLowerCase());
  const records: Record<string, string>[] = [];
  const lines: number[] = [];
  for (const row of rows) {
    const record: Record<string, string> = {};
    headers.forEach((name, index) => {
      record[name] = (row.cells[index] ?? '').trim();
    });
    records.push(record);
    lines.push(row.line);
  }
  return { headers, rawHeaders, records, lines };
}

/** Read one column under any of its accepted spellings, or null when blank.
 *  Aliases exist because the file a tenant re-imports may have come from their
 *  old system, and `warehouse` / `location` / `warehouse_code` all mean one
 *  thing to the person who typed them. */
export function csvField(
  record: Record<string, string>,
  ...names: readonly string[]
): string | null {
  for (const name of names) {
    const value = record[name];
    if (value !== undefined && value !== '') return value;
  }
  return null;
}

/** Read a column as an integer, distinguishing "absent" from "zero" — the
 *  distinction the whole import turns on, since a blank count must not adjust a
 *  level to nothing. Returns `undefined` when absent and `null` when present
 *  but not a number, so the caller can report the row rather than skip it. */
export function csvInt(
  record: Record<string, string>,
  ...names: readonly string[]
): number | null | undefined {
  const raw = csvField(record, ...names);
  if (raw === null) return undefined;
  // Tolerate thousands separators and a leading + — a spreadsheet writes both.
  const cleaned = raw.replace(/[,\s]/g, '').replace(/^\+/, '');
  if (!/^-?\d+$/.test(cleaned)) return null;
  return Number(cleaned);
}
