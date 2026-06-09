// Minimal RFC-4180 CSV parser for inventory feed files.
//
// Expected columns (case-insensitive, trims whitespace):
//   sku          — required: external SKU matching an inventory_source_link.external_sku
//   quantity     — required: on-hand integer
//   location     — optional: location identifier (external_location)
//
// Rows with missing/invalid quantity are skipped with a warning.

export interface CsvInventoryRow {
  externalSku: string;
  externalLocation: string | null;
  quantity: number;
}

function splitCsvRow(line: string): string[] {
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

export function parseCsvInventory(
  csvText: string,
  logger: { warn(msg: string, ctx?: object): void }
): CsvInventoryRow[] {
  const lines = csvText.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = splitCsvRow(lines[0]).map((h) => h.trim().toLowerCase());
  const skuIdx = headers.indexOf('sku');
  const qtyIdx = headers.findIndex((h) => h === 'quantity' || h === 'qty' || h === 'on_hand');
  const locIdx = headers.findIndex(
    (h) => h === 'location' || h === 'warehouse' || h === 'location_id'
  );

  if (skuIdx === -1 || qtyIdx === -1) {
    logger.warn('inventory-worker: CSV missing required columns (sku, quantity)');
    return [];
  }

  const rows: CsvInventoryRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitCsvRow(lines[i]);
    const rawSku = cells[skuIdx]?.trim();
    const rawQty = cells[qtyIdx]?.trim();
    if (!rawSku) continue;
    const quantity = parseInt(rawQty ?? '', 10);
    if (isNaN(quantity)) {
      logger.warn(`inventory-worker: row ${i + 1} — invalid quantity "${rawQty}", skipping`);
      continue;
    }
    const externalLocation = locIdx !== -1 ? cells[locIdx]?.trim() || null : null;
    rows.push({ externalSku: rawSku, externalLocation, quantity: Math.max(0, quantity) });
  }
  return rows;
}
