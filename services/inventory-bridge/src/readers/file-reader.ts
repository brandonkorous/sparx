// File reader — the universal, production path. The local ERP (Fishbowl included)
// is configured to drop a scheduled on-hand export (CSV or JSON) to a folder; the
// bridge reads it and pushes. The file's mtime is the snapshot's observation time,
// so re-reading the same unchanged file is a harmless idempotent re-push and a
// newer export always wins under sparx's last-writer ordering.

import { readFile, stat } from 'node:fs/promises';

import { parseCsv } from '../csv.js';
import type { BridgeRow, InventoryReader, InventorySnapshot } from './types.js';

export class FileReader implements InventoryReader {
  constructor(
    private readonly path: string,
    private readonly format: 'csv' | 'json'
  ) {}

  async readSnapshot(): Promise<InventorySnapshot> {
    const [text, info] = await Promise.all([readFile(this.path, 'utf8'), stat(this.path)]);
    const rows = this.format === 'json' ? parseJson(text) : parseCsv(text);
    return { rows, observedAt: info.mtime.toISOString() };
  }
}

/** Accepts either a bare array of rows or an `{ items: [...] }` envelope; each row
 *  is `{ sku, quantity, location? }` (quantity may be a numeric string). */
function parseJson(text: string): BridgeRow[] {
  const parsed: unknown = JSON.parse(text);
  const items = Array.isArray(parsed)
    ? parsed
    : isRecord(parsed) && Array.isArray(parsed.items)
      ? parsed.items
      : null;
  if (!items) throw new Error('JSON export must be an array of rows or an { items: [...] } object');

  const rows: BridgeRow[] = [];
  for (const item of items) {
    if (!isRecord(item)) continue;
    const sku = typeof item.sku === 'string' ? item.sku.trim() : '';
    if (!sku) continue;
    const quantity = toInt(item.quantity ?? item.qty ?? item.on_hand);
    if (quantity === null) continue;
    const location =
      typeof item.location === 'string' && item.location.trim().length > 0
        ? item.location.trim()
        : null;
    rows.push({ sku, location, quantity: Math.max(0, quantity) });
  }
  return rows;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function toInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? Math.trunc(value) : null;
  if (typeof value === 'string') {
    const n = Number.parseInt(value, 10);
    return Number.isNaN(n) ? null : n;
  }
  return null;
}
