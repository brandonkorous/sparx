// Folding orders into one row per channel — the arithmetic half of
// GET /v1/finance/channels, kept apart from the route so it can be tested
// without a database.
//
// The invariant this exists to hold:
//
//     gross − refunds − owed = net
//
// It did not hold before, because `owed` was not computed. The three figures
// that were returned looked like a chain and were not one: a real shop read
// $2,140.50 sold, $212.00 refunded and $325.00 received, and the $1,603.50
// between them — seven orders nobody had paid for — was in none of them.

import type { Prisma } from '@wizeworks/db';

/** The fields of an order this fold needs. Narrower than the model on purpose. */
export interface FoldableOrder {
  channel: string | null;
  source: string | null;
  total: Prisma.Decimal | number | null;
  amountPaid: Prisma.Decimal | number | null;
  refundTotal: Prisma.Decimal | number | null;
}

export interface ChannelBucket {
  key: string;
  channel: string | null;
  source: string | null;
  orders: number;
  /** Order value placed. */
  gross: number;
  /** Money actually received. */
  net: number;
  refunds: number;
  /** Sold, not refunded, and not paid for. */
  owed: number;
}

export interface ChannelTotals {
  orders: number;
  gross: number;
  net: number;
  refunds: number;
  owed: number;
}

export function num(value: Prisma.Decimal | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** The bucket a sale is counted under. A marketplace order keeps its specific
 *  marketplace (source) so "Etsy" and "Amazon" don't collapse into one row; every
 *  other channel is its own bucket. */
export function channelKey(channel: string | null, source: string | null): string {
  if (channel === 'marketplace') return source ?? 'marketplace';
  return channel ?? 'other';
}

/**
 * What one order has not been paid for.
 *
 * Clamped at zero PER ORDER, never on the total. An overpaid order would
 * otherwise cancel out a different order's debt, and "someone paid us twice" is
 * not the same fact as "someone has paid" — netting them hides both.
 */
export function owedOn(order: FoldableOrder): number {
  return Math.max(0, num(order.total) - num(order.amountPaid) - num(order.refundTotal));
}

/** One row per channel, biggest takings first, with the totals beside them. */
export function foldChannels(orders: FoldableOrder[]): {
  rows: ChannelBucket[];
  totals: ChannelTotals;
} {
  const buckets = new Map<string, ChannelBucket>();

  for (const o of orders) {
    const key = channelKey(o.channel, o.source);
    const b = buckets.get(key) ?? {
      key,
      channel: o.channel,
      source: o.source,
      orders: 0,
      gross: 0,
      net: 0,
      refunds: 0,
      owed: 0,
    };
    b.orders += 1;
    b.gross = round2(b.gross + num(o.total));
    b.net = round2(b.net + num(o.amountPaid));
    b.refunds = round2(b.refunds + num(o.refundTotal));
    b.owed = round2(b.owed + owedOn(o));
    buckets.set(key, b);
  }

  const rows = [...buckets.values()].sort((a, b) => b.net - a.net);
  const totals = rows.reduce<ChannelTotals>(
    (acc, r) => ({
      orders: acc.orders + r.orders,
      gross: round2(acc.gross + r.gross),
      net: round2(acc.net + r.net),
      refunds: round2(acc.refunds + r.refunds),
      owed: round2(acc.owed + r.owed),
    }),
    { orders: 0, gross: 0, net: 0, refunds: 0, owed: 0 }
  );

  return { rows, totals };
}
