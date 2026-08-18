// RFC 4180 delimited-text reader.
//
// Hand-written rather than pulled from npm for two reasons. First, this package is
// deliberately dependency-free: it runs in the browser (the workbench parses the
// tenant's file locally, so nothing has to be uploaded anywhere) and in Node (tests,
// and the live connectors' fixtures), and a zero-dep package can never drag a Node
// built-in into a browser bundle. Second, every real export file breaks a general
// parser in a vendor-specific way, and those quirks are the whole job:
//
//   - Shopify's `Body (HTML)` column contains raw HTML with embedded newlines AND
//     doubled quotes, inside a quoted field. A line-splitting parser shreds it.
//   - Anything that has been opened in Excel comes back with a UTF-8 BOM on the first
//     header, so the literal U+FEFF prefix makes `row['Handle']` undefined for the
//     whole file while the header still LOOKS right in a spreadsheet.
//   - Wix and Magento emit CRLF; Ghost and Framer emit LF; some Etsy exports mix them
//     inside one file.
//   - HubSpot exports of a list with two identically-named custom properties produce
//     duplicate headers, and the second must not silently erase the first.
//
// The reader is a character-level state machine, which is the only shape that gets
// all of the above right at once.

/** One parsed record, keyed by header. Values are always strings — coercion is the
 *  adapter's job, because "0" means different things in different columns. */
export type SourceRow = Record<string, string>;

export interface ParsedDelimited {
  /** Headers in file order, de-duplicated (see `dedupeHeaders`). */
  headers: string[];
  rows: SourceRow[];
  /** The delimiter that was used, whether given or sniffed. */
  delimiter: string;
}

export interface ParseOptions {
  /** Force a delimiter. Omit to sniff between `,`, `\t`, `;` and `|`. */
  delimiter?: string;
  /** Stop after this many data rows. Used by the detection preview. */
  limit?: number;
}

const BOM = '\ufeff';

/**
 * Split delimited text into raw string cells, honouring quotes.
 *
 * Returns rows of cells with no header interpretation — `parseDelimited` layers that
 * on top. Kept separate so the header sniffer can look at row 0 without paying for
 * the whole file.
 */
export function splitRecords(text: string, delimiter: string, limit?: number): string[][] {
  const records: string[][] = [];
  let cells: string[] = [];
  let cell = '';
  let inQuotes = false;
  let sawAnyChar = false;

  const endCell = (): void => {
    cells.push(cell);
    cell = '';
  };
  const endRecord = (): void => {
    endCell();
    // A trailing newline at end-of-file produces one empty cell; that is not a record.
    const empty = cells.length === 1 && cells[0] === '';
    if (!empty) records.push(cells);
    cells = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote inside a quoted field is one literal quote.
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cell += ch;
      }
      continue;
    }

    if (ch === '"' && !sawAnyChar) {
      inQuotes = true;
      continue;
    }
    if (ch === '"') {
      // A quote mid-cell in an unquoted field is a literal character. Etsy does this
      // in TITLE ("6" ruler"), and rejecting the file over it would be absurd.
      cell += ch;
      continue;
    }
    if (ch === delimiter) {
      endCell();
      sawAnyChar = false;
      continue;
    }
    if (ch === '\r') {
      // CRLF or a lone CR — both end the record.
      if (text[i + 1] === '\n') i++;
      endRecord();
      sawAnyChar = false;
      if (limit !== undefined && records.length > limit) return records;
      continue;
    }
    if (ch === '\n') {
      endRecord();
      sawAnyChar = false;
      if (limit !== undefined && records.length > limit) return records;
      continue;
    }

    cell += ch;
    sawAnyChar = true;
  }

  // Whatever is left when the text runs out is the last record.
  if (cell !== '' || cells.length > 0) endRecord();

  return records;
}

/**
 * Pick the delimiter by counting candidates in the header line.
 *
 * The header line is the right sample precisely because it is the one line guaranteed
 * to have no free text in it — counting commas across a whole Shopify export would be
 * dominated by prose inside `Body (HTML)`.
 */
export function sniffDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? '';
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestCount = 0;
  for (const candidate of candidates) {
    // Count outside quotes only, so a header like `"Name, legal"` does not win it.
    let count = 0;
    let inQuotes = false;
    for (const ch of firstLine) {
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === candidate && !inQuotes) count++;
    }
    if (count > bestCount) {
      best = candidate;
      bestCount = count;
    }
  }
  return best;
}

/**
 * Make headers unique and stable.
 *
 * A duplicate becomes `Header (2)`, `Header (3)`, … rather than overwriting, because
 * losing a column silently is the one failure mode a tenant cannot see. Adapters key
 * off the first occurrence, which is the one the vendor intended.
 */
export function dedupeHeaders(raw: string[]): string[] {
  const seen = new Map<string, number>();
  return raw.map((header) => {
    const name = header.trim();
    const count = seen.get(name) ?? 0;
    seen.set(name, count + 1);
    return count === 0 ? name : `${name} (${count + 1})`;
  });
}

/** Parse delimited text into header-keyed rows. */
export function parseDelimited(text: string, options: ParseOptions = {}): ParsedDelimited {
  const body = text.startsWith(BOM) ? text.slice(BOM.length) : text;
  const delimiter = options.delimiter ?? sniffDelimiter(body);
  const records = splitRecords(body, delimiter, options.limit);

  if (records.length === 0) return { headers: [], rows: [], delimiter };

  const headers = dedupeHeaders(records[0]!);
  const rows: SourceRow[] = [];

  for (let r = 1; r < records.length; r++) {
    const record = records[r]!;
    // A row of nothing but empty cells is padding, not data — Excel adds these.
    if (record.every((cell) => cell.trim() === '')) continue;
    const row: SourceRow = {};
    for (let c = 0; c < headers.length; c++) row[headers[c]!] = (record[c] ?? '').trim();
    rows.push(row);
    if (options.limit !== undefined && rows.length >= options.limit) break;
  }

  return { headers, rows, delimiter };
}

/** Convenience alias — the overwhelmingly common case. */
export function parseCsv(text: string, options: ParseOptions = {}): ParsedDelimited {
  return parseDelimited(text, options);
}
