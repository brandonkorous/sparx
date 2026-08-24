// Made to order — the rules a shop that MAKES the thing has to be able to state
// (issue 026): how much notice it needs, how much of the money it takes up
// front, and how many it can turn out in a day.
//
// Pure arithmetic and calendar work, no database and no clock of its own. Every
// caller passes the instant, so a test can place an order at 11:58pm in Denver
// and watch the day roll without waiting for it.
//
// The vocabulary is deliberately the CUSTOMER's, not the supply chain's. This
// file never touches `InventoryLevel.leadTimeDays`, which answers a different
// question with the same-looking number: how long a SUPPLIER takes to restock.

import type { ProductDeposit } from '@wizeworks/commerce-schemas';
import { localCalendarParts, localWallToUtc, formatLocalDate } from '@wizeworks/time';

/** The zone every calculation falls back to when the business has not said
 *  where it is. UTC is the only defensible guess: it is the one that does not
 *  quietly claim to know. */
export const FALLBACK_ZONE = 'UTC';

export type DepositType = 'none' | 'amount' | 'percent';

/** The made-to-order columns of one product, exactly as they come off the row. */
export interface MadeToOrderRule {
  /** Whole days of notice the customer must give. Null = none needed. */
  orderAheadDays: number | null;
  depositType: string;
  /** Per UNIT, in cents. Read only when depositType is 'amount'. */
  depositAmountCents: number | null;
  /** 1-100, of the line. Read only when depositType is 'percent'. */
  depositPercent: number | null;
  /** How many can be ordered in one day. Null = no ceiling. */
  dailyLimit: number | null;
}

export const NO_RULE: MadeToOrderRule = {
  orderAheadDays: null,
  depositType: 'none',
  depositAmountCents: null,
  depositPercent: null,
  dailyLimit: null,
};

/** One cart or order line, priced. `subtotalCents` is the GOODS total for the
 *  line before any order-level tax, delivery or discount. */
export interface MadeToOrderLine {
  quantity: number;
  subtotalCents: number;
  rule: MadeToOrderRule;
}

/* ── the row shape and the wire shape ───────────────────────────────────── */

/** The three deposit columns as they sit on the row. */
export interface DepositColumns {
  depositType: string;
  depositAmountCents: number | null;
  depositPercent: number | null;
}

/**
 * The wire's one-of-three deposit down onto the three columns.
 *
 * The unused columns are cleared rather than left standing. A `percent` left
 * behind an `amount` deposit is a number that describes nothing and reads as
 * fact to the next person who queries the table.
 */
export function depositToColumns(deposit: ProductDeposit): DepositColumns {
  if (deposit.type === 'amount') {
    return {
      depositType: 'amount',
      depositAmountCents: deposit.amountCents,
      depositPercent: null,
    };
  }
  if (deposit.type === 'percent') {
    return { depositType: 'percent', depositAmountCents: null, depositPercent: deposit.percent };
  }
  return { depositType: 'none', depositAmountCents: null, depositPercent: null };
}

/** And back. A row whose type and value disagree reads as no deposit — the DB
 *  CHECK makes that unreachable, and guessing would charge somebody. */
export function depositFromColumns(row: DepositColumns): ProductDeposit {
  if (row.depositType === 'amount' && row.depositAmountCents !== null) {
    return { type: 'amount', amountCents: row.depositAmountCents };
  }
  if (row.depositType === 'percent' && row.depositPercent !== null) {
    return { type: 'percent', percent: row.depositPercent };
  }
  return { type: 'none' };
}

/** Does this product carry any made-to-order rule at all? Used to decide
 *  whether a screen has anything to say, so it stays silent for the ordinary
 *  product taken off a shelf. */
export function isMadeToOrder(rule: MadeToOrderRule): boolean {
  return rule.orderAheadDays !== null || rule.depositType !== 'none' || rule.dailyLimit !== null;
}

/* ── money ──────────────────────────────────────────────────────────────── */

/**
 * What this line asks for up front.
 *
 * Capped at the line itself: a $30 deposit on a $20 cake is $20, not a shop
 * holding money against nothing. A line with no deposit rule asks for all of
 * it, which is what every ordinary product does.
 */
export function depositForLine(line: MadeToOrderLine): number {
  const { rule } = line;
  const full = Math.max(0, Math.round(line.subtotalCents));
  if (rule.depositType === 'amount' && rule.depositAmountCents !== null) {
    return Math.min(full, Math.max(0, rule.depositAmountCents) * Math.max(0, line.quantity));
  }
  if (rule.depositType === 'percent' && rule.depositPercent !== null) {
    const pct = Math.min(100, Math.max(0, rule.depositPercent));
    return Math.min(full, Math.round((full * pct) / 100));
  }
  return full;
}

/** What this line leaves owing until collection. Zero for everything ordinary. */
export function deferredForLine(line: MadeToOrderLine): number {
  if (line.rule.depositType === 'none') return 0;
  return Math.max(0, Math.round(line.subtotalCents) - depositForLine(line));
}

/**
 * The split of one basket into what is paid at checkout and what is owed later.
 *
 * Tax, delivery and every line without a deposit rule are taken in full now —
 * only the REST of a deposit line waits. The deposits themselves are a FLOOR:
 * however the discounts fall, a checkout never collects less than the deposits
 * the shop asked for, because that is the number she agreed to hold.
 */
export function splitDue(
  lines: MadeToOrderLine[],
  totalCents: number
): { dueNowCents: number; balanceCents: number; depositCents: number } {
  const total = Math.max(0, Math.round(totalCents));
  const depositCents = lines
    .filter((line) => line.rule.depositType !== 'none')
    .reduce((sum, line) => sum + depositForLine(line), 0);
  const wanted = lines.reduce((sum, line) => sum + deferredForLine(line), 0);
  const balanceCents = Math.min(wanted, Math.max(0, total - depositCents));
  return { dueNowCents: total - balanceCents, balanceCents, depositCents };
}

/* ── notice ─────────────────────────────────────────────────────────────── */

/**
 * The longest notice any line on this basket asks for, or null when none does.
 *
 * The longest and not the sum: five days' notice on the cake and three on the
 * bread means the whole order is ready in five, because they are being made
 * alongside each other rather than one after the next.
 */
export function noticeDays(lines: MadeToOrderLine[]): number | null {
  let most: number | null = null;
  for (const line of lines) {
    const days = line.rule.orderAheadDays;
    if (days !== null && days > 0 && (most === null || days > most)) most = days;
  }
  return most;
}

/**
 * The earliest DAY an order placed at `placedAt` can be handed over, as
 * `YYYY-MM-DD` in the shop's own zone. Null when nothing asked for notice —
 * which is not the same as "ready today" and must never be rendered as one.
 */
export function readyOnDate(placedAt: Date, days: number | null, zone: string): string | null {
  if (days === null || days <= 0) return null;
  const here = localCalendarParts(placedAt.getTime(), zone);
  const rolled = new Date(Date.UTC(here.year, here.month1 - 1, here.day + days));
  return formatLocalDate({
    year: rolled.getUTCFullYear(),
    month1: rolled.getUTCMonth() + 1,
    day: rolled.getUTCDate(),
    weekday: rolled.getUTCDay(),
  });
}

/** A `YYYY-MM-DD` back as the instant its local midnight falls at, which is what
 *  a DATE column wants storing and what a reader wants to format. */
export function dayToInstant(day: string, zone: string): Date {
  const [year, month1, date] = day.split('-').map(Number);
  return new Date(localWallToUtc(year ?? 1970, month1 ?? 1, date ?? 1, 0, zone));
}

/* ── the daily allowance ────────────────────────────────────────────────── */

/** The UTC window covering one local calendar day in `zone` — the bounds the
 *  daily allowance is counted between. */
export function localDayBounds(at: Date, zone: string): { startUtc: Date; endUtc: Date } {
  const here = localCalendarParts(at.getTime(), zone);
  const start = localWallToUtc(here.year, here.month1, here.day, 0, zone);
  const tomorrow = new Date(Date.UTC(here.year, here.month1 - 1, here.day + 1));
  const end = localWallToUtc(
    tomorrow.getUTCFullYear(),
    tomorrow.getUTCMonth() + 1,
    tomorrow.getUTCDate(),
    0,
    zone
  );
  return { startUtc: new Date(start), endUtc: new Date(end) };
}

/** How many more of this product today's allowance still has room for, given
 *  what has already gone. Null when there is no ceiling. */
export function remainingToday(dailyLimit: number | null, soldToday: number): number | null {
  if (dailyLimit === null) return null;
  return Math.max(0, dailyLimit - Math.max(0, soldToday));
}
