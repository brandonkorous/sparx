'use server';

import ExcelJS from 'exceljs';

export interface XlsxParseResult {
  headers: string[];
  rows: Record<string, string>[];
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
        headers.push(
          String(cell.value ?? '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, '_')
        );
      });
      return;
    }

    const obj: Record<string, string> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber - 1];
      if (header !== undefined) {
        const raw = cell.value;
        obj[header] =
          raw === null || raw === undefined
            ? ''
            : typeof raw === 'object' && 'text' in raw
              ? String((raw as { text: string }).text)
              : String(raw);
      }
    });

    if (Object.values(obj).some((v) => v !== '')) {
      rows.push(obj);
    }
  });

  return { headers, rows };
}
