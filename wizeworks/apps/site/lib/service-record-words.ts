// The words a fleet buyer reads on their vehicles' service records (sparx persona
// issue 086). Shared by the account's Service page and every vehicle card on the
// Fleet page, so a visit is called the same thing in both places.

import { formatMoney } from './format';

type Tone = 'success' | 'info' | 'warning' | 'danger';

const STATUS: Record<string, { words: string; tone: Tone }> = {
  requested: { words: 'Waiting for the shop to confirm', tone: 'warning' },
  confirmed: { words: 'Booked', tone: 'info' },
  in_progress: { words: 'In the shop', tone: 'info' },
  completed: { words: 'Done', tone: 'success' },
  cancelled: { words: 'Canceled', tone: 'danger' },
  no_show: { words: 'Missed', tone: 'danger' },
  waitlisted: { words: 'On the waiting list', tone: 'warning' },
};

/** A visit's state in words. An unknown code reads as booked rather than as the
 *  code: the visit exists, and that is the one thing certain about it. */
export function serviceStatusWords(status: string): string {
  return STATUS[status]?.words ?? 'Booked';
}

export function serviceStatusTone(status: string): Tone {
  return STATUS[status]?.tone ?? 'info';
}

/** "1 hr 30 min". */
export function durationWords(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} hr` : `${h} hr ${m} min`;
}

/** "1 hr 30 min · $149.00": the length, and the price when the shop set one. */
export function serviceTypeSummary(s: {
  durationMinutes: number;
  priceCents: number;
  currency: string;
}): string {
  const length = durationWords(s.durationMinutes);
  if (s.priceCents <= 0) return length;
  return `${length} · ${formatMoney(s.priceCents, s.currency.toUpperCase())}`;
}

interface PartLike {
  orderId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
}

/**
 * A part's name, with its part number when the name does not already say it.
 *
 * The shop's own titles often END in the part number ("Crossover Tube O-Ring
 * (4062328)"), and adding the SKU again printed it twice (sparx persona issue
 * 086). The number counts as already said only when it stands on its own in the
 * name, so "40623281" does not swallow "4062328".
 */
export function partName(title: string, sku: string | null | undefined): string {
  const number = sku?.trim();
  if (!number) return title;
  const escaped = number.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const standsAlone = new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i');
  return standsAlone.test(title) ? title : `${title} (${number})`;
}

/** "2 × Oil filter (LF3349)". The part number only when it says something the
 *  name does not. */
export function partLine(p: PartLike): string {
  return `${p.quantity} × ${partName(p.title, p.sku)}`;
}

/** Where a part's order opens. The reader's own order opens on their order page;
 *  an order a colleague placed for the account is on the account's order list,
 *  because their order page only opens their own. Null when no order is named. */
export function partOrderHref(
  p: Pick<PartLike, 'orderId'>,
  accountId: string,
  myOrderIds: readonly string[]
): string | null {
  if (!p.orderId) return null;
  if (myOrderIds.includes(p.orderId)) return `/account/orders/${encodeURIComponent(p.orderId)}`;
  return `/account/b2b/${encodeURIComponent(accountId)}/orders`;
}

/** The visits filed under one vehicle, in the order they were given (newest
 *  first from the server). */
export function recordsForVehicle<T extends { vehicle: { vehicleId: string } | null }>(
  records: readonly T[],
  vehicleId: string
): T[] {
  return records.filter((r) => r.vehicle?.vehicleId === vehicleId);
}
