import { describe, expect, it } from 'vitest';
import { failingRows, importableRows, summarize, validateRows } from './validate';

describe('validateRows — file-level', () => {
  it('blocks a file whose required column is absent everywhere', () => {
    const report = validateRows('inventory_levels', [{ location: 'Main', quantity: '4' }]);
    expect(report.blocked).toBe(true);
    expect(report.okCount).toBe(0);
    expect(report.issues.some((i) => i.code === 'missing_column' && i.column === 'sku')).toBe(true);
  });

  it('blocks a file with nothing that identifies a record', () => {
    const report = validateRows('customers', [{ first_name: 'Sam' }, { first_name: 'Alex' }]);
    expect(report.blocked).toBe(true);
    expect(report.issues.some((i) => i.code === 'missing_natural_key')).toBe(true);
  });

  it('does not block when one of several key fields is present', () => {
    const report = validateRows('customers', [{ phone: '555-0100', first_name: 'Sam' }]);
    expect(report.blocked).toBe(false);
  });

  it('lists columns no field claims, without failing them', () => {
    const report = validateRows('customers', [{ email: 'a@b.com', 'Accepts Klaviyo SMS': 'yes' }]);
    expect(report.unmappedColumns).toEqual(['Accepts Klaviyo SMS']);
    expect(report.errorCount).toBe(0);
  });
});

describe('validateRows — row-level', () => {
  it('errors on a blank required value', () => {
    const report = validateRows('products', [
      { handle: 'mug', title: 'Mug', sku: 'MUG' },
      { handle: 'cup', title: '', sku: 'CUP' },
    ]);
    const issue = report.issues.find((i) => i.code === 'required_blank');
    expect(issue?.rowIndex).toBe(1);
    expect(report.okCount).toBe(1);
  });

  it('errors on a row with no natural key at all', () => {
    const report = validateRows('products', [{ title: 'Mug' }]);
    expect(report.issues.some((i) => i.code === 'no_key')).toBe(true);
  });

  it('warns — not errors — on an unreadable optional value', () => {
    const report = validateRows('products', [
      { handle: 'mug', title: 'Mug', sku: 'MUG', price: 'call for price' },
    ]);
    const issue = report.issues.find((i) => i.code === 'unreadable_value');
    expect(issue?.severity).toBe('warning');
    expect(report.okCount).toBe(1);
  });

  it('errors on an unreadable natural-key value', () => {
    // A customer whose only identifier is a malformed email cannot be matched later,
    // so importing it creates a record nobody can ever update.
    const report = validateRows('customers', [{ email: 'sam at example.com' }]);
    const issue = report.issues.find((i) => i.code === 'unreadable_value');
    expect(issue?.severity).toBe('error');
    expect(report.okCount).toBe(0);
  });

  it('warns on a value outside an enum and keeps the row', () => {
    const report = validateRows('products', [
      { handle: 'mug', title: 'Mug', sku: 'MUG', status: 'unlisted' },
    ]);
    expect(report.issues.find((i) => i.code === 'unknown_value')?.severity).toBe('warning');
    expect(report.okCount).toBe(1);
  });

  it('warns once per column about ambiguous dates, not once per row', () => {
    const rows = Array.from({ length: 50 }, (_, n) => ({
      handle: `h${n}`,
      title: 'T',
      sku: `S${n}`,
      published_at: '03/04/2026',
    }));
    const report = validateRows('products', rows);
    expect(report.issues.filter((i) => i.code === 'ambiguous_date')).toHaveLength(1);
  });

  it('warns on an over-long value', () => {
    const report = validateRows('products', [
      { handle: 'mug', title: 'x'.repeat(300), sku: 'MUG' },
    ]);
    expect(report.issues.some((i) => i.code === 'too_long')).toBe(true);
  });
});

describe('validateRows — duplicates', () => {
  it('flags a repeated customer email', () => {
    const report = validateRows('customers', [
      { email: 'sam@example.com' },
      { email: 'alex@example.com' },
      { email: 'SAM@example.com' },
    ]);
    expect(report.duplicates).toHaveLength(1);
    expect(report.duplicates[0]!.rows).toEqual([0, 2]);
    expect(report.issues.some((i) => i.code === 'duplicate_key')).toBe(true);
  });

  it('does not flag repeated product handles — that is a variant matrix', () => {
    const report = validateRows('products', [
      { handle: 'tee', title: 'Tee', sku: 'TEE-S', option1_value: 'S' },
      { handle: 'tee', title: 'Tee', sku: 'TEE-M', option1_value: 'M' },
    ]);
    expect(report.issues.some((i) => i.code === 'duplicate_key')).toBe(false);
  });
});

describe('report helpers', () => {
  it('reports every failing row even when the issue list is capped', () => {
    // 900 broken rows exceeds the 500-issue display cap; the import path must still
    // skip all 900, which is why errorRows is tracked separately.
    const rows = Array.from({ length: 900 }, () => ({ email: 'not-an-email' }));
    const report = validateRows('customers', rows);
    expect(report.truncated).toBe(true);
    expect(report.errorRows).toHaveLength(900);
    expect(failingRows(report).size).toBe(900);
    expect(importableRows(rows, report)).toHaveLength(0);
  });

  it('drops only the failing rows', () => {
    const rows = [{ email: 'sam@example.com' }, { email: 'broken' }, { email: 'alex@example.com' }];
    const report = validateRows('customers', rows);
    expect(importableRows(rows, report)).toEqual([rows[0], rows[2]]);
  });

  it('imports nothing from a blocked file', () => {
    const rows = [{ location: 'Main', quantity: '4' }];
    const report = validateRows('inventory_levels', rows);
    expect(importableRows(rows, report)).toEqual([]);
  });

  it('summarises in plain language, and gets the plural right', () => {
    const one = validateRows('customers', [{ email: 'sam@example.com' }]);
    expect(summarize(one)).toBe('1 customer ready to import.');

    const many = validateRows('customers', [
      { email: 'sam@example.com' },
      { email: 'alex@example.com' },
    ]);
    expect(summarize(many)).toBe('2 customers ready to import.');

    const blocked = validateRows('customers', [{ first_name: 'Sam' }]);
    expect(summarize(blocked)).toContain('cannot be imported yet');
  });
});

describe('a required field that is simply not there', () => {
  // Canonical rows drop empty values, so "no title" almost always arrives as a
  // MISSING key rather than a blank one. Checking only the keys a row carries meant
  // a product with no name passed validation and failed at the processor — the worst
  // possible place to find out, because by then the tenant has pressed Import.
  it('is an error on that row, not a pass', () => {
    const report = validateRows('products', [
      { handle: 'mug', title: 'Stoneware mug', sku: 'MUG' },
      { handle: 'nameless', sku: 'X' },
    ]);
    expect(report.okCount).toBe(1);
    expect(report.errorRows).toEqual([1]);
    expect(report.issues.some((issue) => issue.code === 'required_missing')).toBe(true);
  });

  it('does not block the whole file, because the column is there', () => {
    // Blocked is for "no row anywhere has this column" — one bad row is one bad row.
    const report = validateRows('products', [
      { handle: 'mug', title: 'Stoneware mug' },
      { handle: 'nameless' },
    ]);
    expect(report.blocked).toBe(false);
  });

  it('says it once per row, not once per required field it already reported blank', () => {
    const report = validateRows('inventory_levels', [{ sku: 'MUG', location: 'Studio' }]);
    // quantity is required and absent — one error, not two.
    expect(report.errorRows).toEqual([0]);
    expect(report.issues.filter((issue) => issue.rowIndex === 0)).toHaveLength(1);
  });
});
