// Minimal RFC-4180 CSV parser for a local inventory export. Standalone (the agent
// shares no code with the server worker), mirroring the same column contract:
//   sku       — required: external SKU
//   quantity  — required: on-hand integer (aliases: qty, on_hand)
//   location  — optional: external location (aliases: warehouse, location_id)

import type { BridgeRow } from './readers/types.js';

function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      cells.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells;
}

export function parseCsv(text: string): BridgeRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitRow(lines[0]!).map((h) => h.trim().toLowerCase());
  const skuIdx = headers.indexOf('sku');
  const qtyIdx = headers.findIndex((h) => h === 'quantity' || h === 'qty' || h === 'on_hand');
  const locIdx = headers.findIndex(
    (h) => h === 'location' || h === 'warehouse' || h === 'location_id'
  );
  if (skuIdx === -1 || qtyIdx === -1) {
    throw new Error('CSV is missing required columns (sku, quantity)');
  }

  const rows: BridgeRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitRow(lines[i]!);
    const sku = cells[skuIdx]?.trim();
    if (!sku) continue;
    const quantity = Number.parseInt(cells[qtyIdx]?.trim() ?? '', 10);
    if (Number.isNaN(quantity)) continue;
    const rawLoc = locIdx !== -1 ? (cells[locIdx]?.trim() ?? '') : '';
    rows.push({
      sku,
      location: rawLoc.length > 0 ? rawLoc : null,
      quantity: Math.max(0, quantity),
    });
  }
  return rows;
}
