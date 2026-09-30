// The small amount of plumbing every "take your records with you" export
// shares: orders, invoices, bookings and written content (the marketing site
// promises all four, in formats other software can open, without asking).
//
// The CSV itself is NOT written here. There is one writer on the platform,
// `toCsv` in @wizeworks/inventory, and it owns the details that break a
// round-trip (the BOM Excel needs, CRLF, quoting). A second writer would drift
// from it, and the failure would surface as a file sparx produced that sparx,
// or a spreadsheet, reads wrongly. These helpers only shape cells and send.

import type { FastifyReply } from 'fastify';
import { toCsv, type CsvTable } from '@wizeworks/inventory';

/** The most rows one export will hand over. Matches the customers export. */
export const EXPORT_ROW_CAP = 10_000;

/** Send a table as a file download named `<name>-export.csv`. */
export function sendCsvExport(reply: FastifyReply, table: CsvTable): FastifyReply {
  return reply
    .header('Content-Type', 'text/csv; charset=utf-8')
    .header('Content-Disposition', `attachment; filename="${table.name}-export.csv"`)
    .send(toCsv(table));
}

/**
 * A stored decimal amount as a spreadsheet number: two places, no symbol, no
 * grouping separator, so a column of them can be summed.
 *
 * For amounts stored in MAJOR units (Prisma `Decimal(12, 2)`: orders, invoices).
 * Amounts stored in cents go through `csvMoney` instead; dividing one of these by
 * a hundred would print a $48.00 order as 0.48.
 */
export function decimalAmount(
  value: { toFixed(places: number): string } | number | null | undefined
): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number') return Number.isFinite(value) ? value.toFixed(2) : null;
  return value.toFixed(2);
}

/**
 * An instant as the wall-clock time in a named zone, `YYYY-MM-DD HH:mm`.
 *
 * A booking at 10:00 in Denver is "10:00" to everybody who deals with it; the
 * UTC instant ("16:00Z") is a correct value nobody recognizes. The zone rides in
 * its own column so the sheet is still unambiguous. An unknown zone falls back
 * to UTC rather than failing the whole file.
 */
export function wallTime(instant: Date, timeZone: string): string {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    }).formatToParts(instant);
  } catch {
    return wallTime(instant, 'UTC');
  }
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '';
  return `${part('year')}-${part('month')}-${part('day')} ${part('hour')}:${part('minute')}`;
}

/**
 * Walk a paged list service until it runs out or the cap is reached.
 *
 * The list services cap one page at 250 rows, because a SCREEN should never ask
 * for more. An export is a different reader and wants all of them.
 */
export async function collectPages<T>(
  pageSize: number,
  cap: number,
  fetchPage: (skip: number, take: number) => Promise<{ items: T[]; total: number }>
): Promise<T[]> {
  const out: T[] = [];
  for (let skip = 0; out.length < cap; skip += pageSize) {
    const take = Math.min(pageSize, cap - out.length);
    const { items, total } = await fetchPage(skip, take);
    out.push(...items);
    if (items.length < take || skip + items.length >= total) break;
  }
  return out;
}
