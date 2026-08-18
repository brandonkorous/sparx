import { describe, expect, it } from 'vitest';
import { dedupeHeaders, parseCsv, parseDelimited, sniffDelimiter } from './csv';

describe('parseCsv', () => {
  it('reads a plain file', () => {
    const { headers, rows } = parseCsv('a,b\n1,2\n3,4\n');
    expect(headers).toEqual(['a', 'b']);
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
    ]);
  });

  it('strips a UTF-8 BOM off the first header', () => {
    // Every export that has been round-tripped through Excel arrives like this, and
    // an unstripped BOM makes `row['Handle']` undefined for the whole file.
    const { headers, rows } = parseCsv('﻿Handle,Title\nmug,Mug\n');
    expect(headers).toEqual(['Handle', 'Title']);
    expect(rows[0]).toEqual({ Handle: 'mug', Title: 'Mug' });
  });

  it('keeps newlines inside a quoted field', () => {
    // Shopify's Body (HTML) column, exactly.
    const text = 'Handle,Body (HTML)\nmug,"<p>Line one</p>\n<p>Line two</p>"\n';
    const { rows } = parseCsv(text);
    expect(rows).toHaveLength(1);
    expect(rows[0]!['Body (HTML)']).toBe('<p>Line one</p>\n<p>Line two</p>');
  });

  it('un-doubles escaped quotes', () => {
    const { rows } = parseCsv('Title\n"A 6"" ruler"\n');
    expect(rows[0]!.Title).toBe('A 6" ruler');
  });

  it('tolerates a bare quote inside an unquoted field', () => {
    // Etsy titles do this constantly.
    const { rows } = parseCsv('TITLE\n6" ruler\n');
    expect(rows[0]!.TITLE).toBe('6" ruler');
  });

  it('handles CRLF and mixed line endings', () => {
    const { rows } = parseCsv('a,b\r\n1,2\r\n3,4\n5,6\r\n');
    expect(rows).toEqual([
      { a: '1', b: '2' },
      { a: '3', b: '4' },
      { a: '5', b: '6' },
    ]);
  });

  it('drops padding rows of empty cells', () => {
    const { rows } = parseCsv('a,b\n1,2\n,\n\n');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });

  it('pads short rows rather than dropping columns', () => {
    const { rows } = parseCsv('a,b,c\n1,2\n');
    expect(rows[0]).toEqual({ a: '1', b: '2', c: '' });
  });

  it('honours a row limit', () => {
    const { rows } = parseCsv('a\n1\n2\n3\n4\n', { limit: 2 });
    expect(rows).toHaveLength(2);
  });

  it('reads a file with no trailing newline', () => {
    const { rows } = parseCsv('a,b\n1,2');
    expect(rows).toEqual([{ a: '1', b: '2' }]);
  });
});

describe('sniffDelimiter', () => {
  it('finds tabs', () => {
    expect(sniffDelimiter('a\tb\tc\n1\t2\t3')).toBe('\t');
  });

  it('finds semicolons', () => {
    expect(sniffDelimiter('a;b;c\n1;2;3')).toBe(';');
  });

  it('defaults to comma', () => {
    expect(sniffDelimiter('onlyonecolumn\nvalue')).toBe(',');
  });

  it('ignores a delimiter inside a quoted header', () => {
    expect(sniffDelimiter('"Name, legal"\tCity\n')).toBe('\t');
  });
});

describe('dedupeHeaders', () => {
  it('suffixes duplicates instead of overwriting', () => {
    expect(dedupeHeaders(['Tag', 'Tag', 'Tag'])).toEqual(['Tag', 'Tag (2)', 'Tag (3)']);
  });

  it('trims whitespace', () => {
    expect(dedupeHeaders([' Email ', 'Name'])).toEqual(['Email', 'Name']);
  });
});

describe('parseDelimited', () => {
  it('accepts an explicit delimiter', () => {
    const { rows } = parseDelimited('a|b\n1|2', { delimiter: '|' });
    expect(rows[0]).toEqual({ a: '1', b: '2' });
  });

  it('returns nothing for empty text', () => {
    expect(parseDelimited('')).toEqual({ headers: [], rows: [], delimiter: ',' });
  });
});
