// A minimal, correct RFC-4180 CSV reader/writer.
//
// Zero dependencies on purpose: this is the fallback path that has to work when
// nothing else does, and an accountant's export is not the place to discover a
// transitive dependency changed its quoting rules. Same stance @sparx/migration
// took for its own readers.
//
// Handles what real accounting exports actually contain: quoted fields, embedded
// commas and newlines, doubled quotes, and CRLF.

/** Quote a field only when it needs it — an unquoted file is easier for a human
 *  to eyeball, and half the point of the CSV path is that a person can check it. */
function encodeField(value: string): string {
  if (value === '') return '';
  if (/[",\r\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly (string | number | null | undefined)[])[],
  delimiter = ','
): string {
  const line = (cells: readonly (string | number | null | undefined)[]): string =>
    cells.map((c) => encodeField(c === null || c === undefined ? '' : String(c))).join(delimiter);

  // CRLF: Excel on Windows is the single most common destination for this file,
  // and it is the one that cares.
  return [line(headers), ...rows.map(line)].join('\r\n') + '\r\n';
}

/**
 * Parse CSV into rows of raw strings. Does not coerce types — the caller knows
 * what a column means, and guessing is how a leading-zero account code becomes a
 * number.
 */
export function parseCsv(text: string, delimiter = ','): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  let i = 0;

  // Strip a UTF-8 BOM — Excel writes one, and it otherwise becomes part of the
  // first header name, so "Date" silently stops matching.
  if (text.charCodeAt(0) === 0xfeff) i = 1;

  const endField = (): void => {
    row.push(field);
    field = '';
  };
  const endRow = (): void => {
    endField();
    // Skip the trailing blank row a final newline produces.
    if (row.length > 1 || row[0] !== '') rows.push(row);
    row = [];
  };

  while (i < text.length) {
    const char = text[i]!;

    if (quoted) {
      if (char === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 2;
          continue;
        }
        quoted = false;
        i += 1;
        continue;
      }
      field += char;
      i += 1;
      continue;
    }

    if (char === '"' && field === '') {
      quoted = true;
      i += 1;
      continue;
    }
    if (char === delimiter) {
      endField();
      i += 1;
      continue;
    }
    if (char === '\r') {
      // Consume CRLF as one terminator.
      if (text[i + 1] === '\n') i += 1;
      endRow();
      i += 1;
      continue;
    }
    if (char === '\n') {
      endRow();
      i += 1;
      continue;
    }

    field += char;
    i += 1;
  }

  if (field !== '' || row.length > 0) endRow();
  return rows;
}

/** Rows keyed by header name, which is how every importer below wants them. */
export function parseCsvObjects(text: string, delimiter = ','): Record<string, string>[] {
  const rows = parseCsv(text, delimiter);
  const [headers, ...body] = rows;
  if (!headers) return [];
  const keys = headers.map((h) => h.trim());
  return body.map((cells) => {
    const out: Record<string, string> = {};
    keys.forEach((key, index) => {
      out[key] = cells[index] ?? '';
    });
    return out;
  });
}
