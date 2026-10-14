// The report preview: groups by name, a table as a table, and columns that stack
// in a narrow pane (persona issues 247, 248 and 249).

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

const source = readFileSync(
  fileURLToPath(new URL('./report-builder.tsx', import.meta.url)),
  'utf8'
);

describe('the report preview', () => {
  it('names each group instead of printing the stored id or code (247)', () => {
    expect(source).toContain("from './report-group-words'");
    expect(source).not.toMatch(/formatCell\(row\[group\.key\]\)/);
  });

  it('draws "A table" as a table, not as bars (248)', () => {
    expect(source).toMatch(/visualization === 'table'\) return null/);
  });

  it('stacks its two columns by the PANE width, not the window (249)', () => {
    expect(source).not.toMatch(/max-\[\d+px\]:grid-cols-1/);
    expect(source).toMatch(/@4xl:grid-cols-\[minmax\(320px,380px\)_minmax\(0,1fr\)\]/);
  });

  it('says why an answer is empty, not always "loosen a filter" (255)', () => {
    expect(source).toContain('emptyAnswer(');
    expect(source).not.toContain(
      '<Text>Nothing matches yet. Loosen a filter, or widen the period.</Text>'
    );
  });
});
