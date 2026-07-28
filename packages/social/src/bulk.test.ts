import { describe, expect, it } from 'vitest';

import { parseSocialCsv, splitCsvLine } from './bulk.js';

// The parser's job is to be HONEST about a messy file: a spreadsheet exported from
// anywhere, with quoted commas, blank rows and a date somebody typed by hand. It must
// never throw — a file with three bad rows should import the other twenty-seven and say
// exactly which three.

describe('splitCsvLine', () => {
  it('splits on commas', () => {
    expect(splitCsvLine('a,b,c')).toEqual(['a', 'b', 'c']);
  });

  it('keeps a comma inside quotes — the normal case for a post body', () => {
    expect(splitCsvLine('"Open late, all week",2026-08-01')).toEqual([
      'Open late, all week',
      '2026-08-01',
    ]);
  });

  it('reads a doubled quote as one quote', () => {
    expect(splitCsvLine('"He said ""hi""",x')).toEqual(['He said "hi"', 'x']);
  });

  it('keeps empty cells so column positions stay aligned', () => {
    expect(splitCsvLine('a,,c')).toEqual(['a', '', 'c']);
  });
});

describe('parseSocialCsv', () => {
  it('reads the common shape', () => {
    const csv = ['body,when,accounts', '"Open late tonight",2026-08-01T17:00:00Z,My Page'].join(
      '\n'
    );
    const { rows, problems } = parseSocialCsv(csv);
    expect(problems).toEqual([]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      line: 2,
      body: 'Open late tonight',
      targetNames: ['My Page'],
    });
    expect(rows[0]?.scheduledAt?.toISOString()).toBe('2026-08-01T17:00:00.000Z');
  });

  it('accepts the column names people actually use', () => {
    const csv = ['Text,Date,Channels', 'Hello,2026-08-01T09:00:00Z,A;B'].join('\n');
    const { rows } = parseSocialCsv(csv);
    expect(rows[0]).toMatchObject({ body: 'Hello', targetNames: ['A', 'B'] });
  });

  it('splits several accounts on a semicolon or a pipe', () => {
    const csv = ['body,accounts', 'Hi,"A; B | C"'].join('\n');
    const { rows } = parseSocialCsv(csv);
    expect(rows[0]?.targetNames).toEqual(['A', 'B', 'C']);
  });

  it('refuses a file with no body column, and says what is missing', () => {
    const { rows, problems } = parseSocialCsv('when,accounts\n2026-08-01,A');
    expect(rows).toEqual([]);
    expect(problems[0]?.message).toContain('body');
  });

  it('reports an unreadable date on its own line rather than dropping the row silently', () => {
    const csv = ['body,when', 'Hello,next tuesday-ish'].join('\n');
    const { rows, problems } = parseSocialCsv(csv);
    expect(problems).toEqual([
      { line: 2, message: '"next tuesday-ish" isn\'t a date we could read.' },
    ]);
    // The row still imports — as a draft, with no time.
    expect(rows).toHaveLength(1);
    expect(rows[0]?.scheduledAt).toBeNull();
  });

  it('skips a row with no text and says which line', () => {
    const csv = ['body,when', ',2026-08-01T09:00:00Z'].join('\n');
    const { rows, problems } = parseSocialCsv(csv);
    expect(rows).toEqual([]);
    expect(problems[0]).toMatchObject({ line: 2 });
  });

  it('ignores blank lines rather than counting them as rows', () => {
    const csv = ['body', 'One', '', 'Two', ''].join('\n');
    const { rows } = parseSocialCsv(csv);
    expect(rows.map((r) => r.body)).toEqual(['One', 'Two']);
  });

  it('tolerates Windows line endings', () => {
    const { rows } = parseSocialCsv('body\r\nHello\r\n');
    expect(rows).toHaveLength(1);
  });

  it('says so plainly when the file is empty', () => {
    const { problems } = parseSocialCsv('   ');
    expect(problems[0]?.message).toContain('empty');
  });
});
