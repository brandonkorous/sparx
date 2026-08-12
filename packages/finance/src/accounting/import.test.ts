// Reading a bank or card export.
//
// These two parsers decide whether an owner's statement imports correctly or
// silently becomes wrong numbers, and both have to cope with files nobody
// designed for us. The rule they follow: never guess. A value that cannot be read
// returns null and gets flagged, because a silently-zero row is far worse than a
// row someone has to look at.

import { describe, expect, it } from 'vitest';

import { parseAmountCents, parseImportDate, previewImport } from './import';

describe('parseAmountCents', () => {
  it('reads a plain decimal', () => {
    expect(parseAmountCents('12.50')).toBe(1250);
  });

  it('reads whole numbers', () => {
    expect(parseAmountCents('12')).toBe(1200);
  });

  it('strips a currency symbol', () => {
    expect(parseAmountCents('$1,234.56')).toBe(123456);
  });

  it('reads European separators', () => {
    // "1.234,56" is one thousand two hundred, not one point two three.
    expect(parseAmountCents('1.234,56')).toBe(123456);
  });

  it('reads US separators', () => {
    expect(parseAmountCents('1,234.56')).toBe(123456);
  });

  it('reads accounting parentheses as negative', () => {
    expect(parseAmountCents('(45.00)')).toBe(-4500);
  });

  it('reads a trailing minus as negative', () => {
    expect(parseAmountCents('45.00-')).toBe(-4500);
  });

  it('reads a leading minus as negative', () => {
    expect(parseAmountCents('-45.00')).toBe(-4500);
  });

  it('returns null rather than zero for something unreadable', () => {
    // The whole point: a row that quietly becomes $0.00 corrupts the month and
    // nobody finds out. A null is flagged in the preview and seen.
    expect(parseAmountCents('n/a')).toBeNull();
    expect(parseAmountCents('')).toBeNull();
    expect(parseAmountCents('   ')).toBeNull();
  });

  it('rounds to whole cents rather than carrying a float', () => {
    expect(parseAmountCents('0.1')).toBe(10);
    expect(parseAmountCents('19.99')).toBe(1999);
  });

  it('rounds a third decimal WITHOUT float error', () => {
    // `Math.round(0.145 * 100)` is 14, because 0.145×100 is 14.499999999999998.
    // Two-decimal files survive that; a three-decimal one (fuel prices, FX'd
    // lines, some fee columns) quietly loses a cent per row. Parsed as a string.
    expect(parseAmountCents('0.145')).toBe(15);
    expect(parseAmountCents('1.005')).toBe(101);
    expect(parseAmountCents('8.115')).toBe(812);
  });

  it('carries a rounded-up fraction into the whole units', () => {
    expect(parseAmountCents('0.999')).toBe(100);
    expect(parseAmountCents('12.999')).toBe(1300);
  });

  it('keeps large amounts exact', () => {
    expect(parseAmountCents('1234567.89')).toBe(123456789);
  });
});

describe('parseImportDate', () => {
  const utc = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

  it('reads ISO exactly', () => {
    expect(parseImportDate('2027-03-04')).toEqual(utc('2027-03-04'));
  });

  it('reads ISO with a time component, keeping the day', () => {
    expect(parseImportDate('2027-03-04T14:22:00Z')).toEqual(utc('2027-03-04'));
  });

  it('reads an unambiguous day-first date', () => {
    // 25 cannot be a month, so this can only be 25 March.
    expect(parseImportDate('25/03/2027')).toEqual(utc('2027-03-25'));
  });

  it('reads a two-digit year', () => {
    expect(parseImportDate('25/03/27')).toEqual(utc('2027-03-25'));
  });

  it('reads dot separators', () => {
    expect(parseImportDate('25.03.2027')).toEqual(utc('2027-03-25'));
  });

  it('returns null for something unreadable', () => {
    expect(parseImportDate('not a date')).toBeNull();
    expect(parseImportDate('')).toBeNull();
  });
});

describe('previewImport', () => {
  const base = {
    columns: { date: 'Date', description: 'Description', amount: 'Amount' },
    fallbackCategoryId: '00000000-0000-0000-0000-000000000001',
    sourceKey: 'statement.csv',
  };

  it('writes nothing and reports what WOULD be written', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,45.00\r\n2027-03-05,Parts,120.00\r\n',
    });
    expect(preview.validCount).toBe(2);
    expect(preview.errorCount).toBe(0);
    expect(preview.totalCents).toBe(16500);
    expect(preview.headers).toEqual(['Date', 'Description', 'Amount']);
  });

  it('numbers lines the way a spreadsheet does, so an error can be found', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,45.00\r\n',
    });
    // Row 1 is the header, so the first data row is line 2.
    expect(preview.rows[0]?.line).toBe(2);
  });

  it('flags an unreadable amount instead of importing zero', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,oops\r\n',
    });
    expect(preview.errorCount).toBe(1);
    expect(preview.rows[0]?.error).toMatch(/amount/i);
    expect(preview.totalCents).toBe(0);
  });

  it('flags an unreadable date', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\nwhenever,Fuel,45.00\r\n',
    });
    expect(preview.rows[0]?.error).toMatch(/date/i);
  });

  it('flags a row with no description — an unlabelled number is unusable later', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,,45.00\r\n',
    });
    expect(preview.rows[0]?.error).toMatch(/description/i);
  });

  it('inverts amounts for a bank export that lists money out as negative', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,-45.00\r\n',
      invertAmounts: true,
    });
    expect(preview.rows[0]?.amountCents).toBe(4500);
  });

  it('picks up the optional columns when mapped', () => {
    const preview = previewImport({
      ...base,
      columns: { ...base.columns, vendor: 'Payee', reference: 'Ref', category: 'Type' },
      csv: 'Date,Description,Amount,Payee,Ref,Type\r\n2027-03-04,Fuel,45.00,Shell,TX-9,Vehicle & fuel\r\n',
    });
    expect(preview.rows[0]?.vendorName).toBe('Shell');
    expect(preview.rows[0]?.reference).toBe('TX-9');
    expect(preview.rows[0]?.categoryName).toBe('Vehicle & fuel');
  });

  it('leaves unmapped optional columns null rather than inventing blanks', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,45.00\r\n',
    });
    expect(preview.rows[0]?.vendorName).toBeNull();
    expect(preview.rows[0]?.categoryName).toBeNull();
  });

  it('counts only the valid rows in the total', () => {
    const preview = previewImport({
      ...base,
      csv: 'Date,Description,Amount\r\n2027-03-04,Fuel,45.00\r\nbad,Parts,oops\r\n',
    });
    expect(preview.validCount).toBe(1);
    expect(preview.errorCount).toBe(1);
    expect(preview.totalCents).toBe(4500);
  });
});
