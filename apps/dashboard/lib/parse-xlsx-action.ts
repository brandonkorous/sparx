'use server';

import ExcelJS from 'exceljs';

export interface XlsxParseResult {
  headers: string[];
  rows: Record<string, string>[];
}

// ExcelJS cell values can be primitives, Dates, or objects (rich text,
// hyperlinks, formula results, errors). A bare String() on those objects yields
// "[object Object]", so coerce each shape explicitly.
function cellToString(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if (typeof v.text === 'string') return v.text; // hyperlink / shared string
    if (Array.isArray(v.richText)) {
      return v.richText.map((r) => (r as { text?: string }).text ?? '').join('');
    }
    if ('result' in v) return cellToString(v.result); // formula → its computed result
    if (typeof v.error === 'string') return v.error; // e.g. "#VALUE!"
    return '';
  }
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  return '';
}

// Server action: parse an Excel (.xlsx) file into rows matching the CSV
// import format. Headers are normalized the same way the client CSV parser
// normalizes them (lower-case, underscores for spaces).
export async function parseXlsxAction(file: File): Promise<XlsxParseResult> {
  const arrayBuffer = await file.arrayBuffer();
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(arrayBuffer);

  const worksheet = workbook.worksheets[0];
  if (!worksheet) throw new Error('No worksheets found in the Excel file.');

  const headers: string[] = [];
  const rows: Record<string, string>[] = [];
  let isHeaderRow = true;

  worksheet.eachRow((row) => {
    if (isHeaderRow) {
      isHeaderRow = false;
      row.eachCell((cell) => {
        headers.push(cellToString(cell.value).trim().toLowerCase().replace(/\s+/g, '_'));
      });
      return;
    }

    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header !== undefined) {
        obj[header] = cellToString(cell.value);
      }
    });

    if (Object.values(obj).some((v) => v !== '')) {
      rows.push(obj);
    }
  });

  return { headers, rows };
}
