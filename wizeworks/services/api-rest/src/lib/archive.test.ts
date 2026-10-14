// A journal's archive by month (persona P09, The Marrow Review): months on the
// business's own clock, newest first, each piece with its section and address.

import { describe, expect, it } from 'vitest';

import { archiveMonths, archiveYears, monthOn } from './archive';
import { servedKinds } from './author-credits';

const kinds = servedKinds([
  {
    key: 'article',
    name: 'Article',
    pluralName: 'Articles',
    urlPattern: '/articles/{slug}',
    schemaJson: {
      fields: [
        { key: 'title', type: 'text', label: 'Title' },
        { key: 'standfirst', type: 'long_text', label: 'Standfirst' },
        {
          key: 'section',
          type: 'enum',
          label: 'Section',
          options: [
            { label: 'Field', value: 'field' },
            { label: 'Ledger', value: 'ledger' },
          ],
        },
      ],
    },
  },
  { key: 'memo', name: 'Memo', pluralName: 'Memos', urlPattern: null, schemaJson: { fields: [] } },
]);

const piece = (
  slug: string,
  title: string,
  iso: string,
  section = 'field',
  typeKey = 'article'
) => ({
  typeKey,
  slug,
  body: { title, section },
  publishedAt: new Date(iso),
});

describe('monthOn', () => {
  it('reads the month on the business’s clock, not the server’s', () => {
    // 00:30 on 1 October in London is still 30 September in UTC.
    expect(monthOn(new Date('2026-09-30T23:30:00Z'), 'Europe/London')).toBe('2026-10');
    expect(monthOn(new Date('2026-09-30T23:30:00Z'), 'UTC')).toBe('2026-09');
  });
});

describe('archiveYears', () => {
  it('counts each year, newest first', () => {
    const dates = ['2026-10-01T05:00:00Z', '2026-09-20T05:00:00Z', '2025-03-01T05:00:00Z'].map(
      (d) => new Date(d)
    );
    expect(archiveYears(dates, 'Europe/London')).toEqual([
      { year: 2026, count: 2 },
      { year: 2025, count: 1 },
    ]);
  });
});

describe('archiveMonths', () => {
  const rows = [
    piece('the-seed-library', 'The seed library that outlived its village', '2026-09-28T05:00:00Z'),
    piece('the-last-mill', 'The last mill on the Nene', '2026-10-01T05:00:00Z'),
    piece('wet-june', 'What a wet June does to a wheat contract', '2026-10-03T05:00:00Z', 'ledger'),
    piece('old', 'A piece from last year', '2025-06-01T05:00:00Z'),
    piece('memo', 'A memo nobody can open', '2026-10-02T05:00:00Z', 'field', 'memo'),
  ];

  it('lists one year by month, newest first, each piece with its section and address', () => {
    const months = archiveMonths(rows, kinds, 'Europe/London', 2026);
    expect(months.map((m) => m.month)).toEqual(['2026-10', '2026-09']);
    expect(months[0]?.pieces.map((p) => p.title)).toEqual([
      'What a wet June does to a wheat contract',
      'The last mill on the Nene',
    ]);
    expect(months[0]?.pieces[0]).toMatchObject({
      path: '/articles/wet-june',
      section: 'Ledger',
      kindName: 'Article',
    });
  });

  it('leaves out another year and anything a reader cannot open', () => {
    const titles = archiveMonths(rows, kinds, 'Europe/London', 2026).flatMap((m) =>
      m.pieces.map((p) => p.title)
    );
    expect(titles).not.toContain('A piece from last year');
    expect(titles).not.toContain('A memo nobody can open');
  });
});
