// The words and the tick arithmetic of a fleet service record, staff side (sparx
// persona issue 086). Pure, so the booking pane, the account pane and the tests
// all read the same rules.

/** One part on a visit, as the API returns it. */
export interface ServiceRecordPart {
  orderId: string | null;
  orderItemId: string | null;
  orderNumber: string | null;
  variantId: string | null;
  sku: string | null;
  title: string;
  quantity: number;
}

type Tone = 'success' | 'info' | 'warning' | 'danger';

const STATUS: Record<string, { label: string; tone: Tone }> = {
  requested: { label: 'Waiting for you to confirm', tone: 'warning' },
  confirmed: { label: 'Booked', tone: 'info' },
  in_progress: { label: 'In the shop', tone: 'info' },
  completed: { label: 'Done', tone: 'success' },
  cancelled: { label: 'Canceled', tone: 'danger' },
  no_show: { label: 'Did not turn up', tone: 'danger' },
  waitlisted: { label: 'On the waiting list', tone: 'warning' },
};

/** A visit's state in words, with the color that carries it. */
export function visitStatus(status: string): { label: string; tone: Tone } {
  return STATUS[status] ?? { label: 'Booked', tone: 'info' };
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

/** "2 × Oil filter (LF3349)". */
export function partLine(p: Pick<ServiceRecordPart, 'sku' | 'title' | 'quantity'>): string {
  return `${p.quantity} × ${partName(p.title, p.sku)}`;
}

/** Order line id → how many of it are on the visit. */
export type PartTicks = Record<string, number>;

/** The ticks a saved visit starts from. A part without an order line (an older
 *  record) cannot be matched to a line, so it starts unticked. */
export function partsToTicks(parts: ServiceRecordPart[]): PartTicks {
  const ticks: PartTicks = {};
  for (const p of parts) {
    if (p.orderItemId) ticks[p.orderItemId] = (ticks[p.orderItemId] ?? 0) + p.quantity;
  }
  return ticks;
}

/** What is sent: only the lines ticked with a count. */
export function ticksToPicks(ticks: PartTicks): { orderItemId: string; quantity: number }[] {
  return Object.entries(ticks)
    .filter(([, quantity]) => quantity > 0)
    .map(([orderItemId, quantity]) => ({ orderItemId, quantity }));
}

/** Whether the ticks on screen differ from the saved ones. A line unticked to
 *  zero is the same as a line never ticked. */
export function partsChanged(saved: PartTicks, current: PartTicks): boolean {
  const keys = new Set([...Object.keys(saved), ...Object.keys(current)]);
  for (const key of keys) {
    if ((saved[key] ?? 0) !== (current[key] ?? 0)) return true;
  }
  return false;
}
