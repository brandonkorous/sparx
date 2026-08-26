// The sentences a shopper reads about a thing that has to be MADE before it can
// be handed over (issue 026), in one place because four surfaces say them.
//
// They were written once, inside a React component that only the sample-data
// preview path ever rendered (issue 184). The live product page is composed from
// the silica catalog and binds plain values, so it needs the same sentences as
// STRINGS rather than as JSX — and the moment two places build the same sentence
// from the same fields, they drift. So the words live here and everything that
// says them reads them from here.

import { formatMoney } from './format';
import type { PublicMadeToOrder } from './commerce';

/** How the shop can be paid, as the storefront learns it from the site payload.
 *  `card` takes money on this website; the other two do not. */
export type StorefrontPaymentMode = 'card' | 'in_person' | 'unavailable';

export interface MadeToOrderCopy {
  /** "Made to order. Ready from Saturday, August 29 — we need 5 days to make it." */
  ready: string | null;
  /** What happens to the money. Null when nothing about it can be said honestly. */
  deposit: string | null;
  /** Today's allowance, and only when it is genuinely running out. */
  scarce: string | null;
}

export interface MadeToOrderCopyOptions {
  /** The resolved variant's price, or null while a choice is still open. Only a
   *  percentage deposit needs it — a range cannot become one honest number. */
  priceCents?: number | null;
  currency?: string;
  locale?: string;
  /** Absent on a surface that has not learned it, which reads as `card` — the
   *  behavior every storefront had before the mode was carried. */
  paymentMode?: StorefrontPaymentMode;
}

/** A `YYYY-MM-DD` as a day a person recognises. Built from the parts rather than
 *  parsed as an instant: `new Date('2026-08-29')` is UTC midnight, which prints
 *  as the 28th anywhere west of Greenwich. */
export function readyDayLabel(day: string, locale?: string): string | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function readyLine(madeToOrder: PublicMadeToOrder, locale?: string): string | null {
  if (!madeToOrder.readyOn) return null;
  const day = readyDayLabel(madeToOrder.readyOn, locale);
  if (!day) return null;
  const days = madeToOrder.orderAheadDays;
  if (days === null) return `Made to order. Ready from ${day}.`;
  return `Made to order. Ready from ${day} — we need ${String(days)} day${days === 1 ? '' : 's'} to make it.`;
}

/**
 * What the shopper's money does, which depends on whether this website can take
 * any.
 *
 * A shop on MANUAL payments charges no card here, so "Pay $30.00 today" would
 * describe a transaction that does not happen. It does NOT follow that the money
 * changes hands over a counter — a mail-order maker with no shop is on manual
 * payments too — so this line says what is true of every one of them and names
 * no room (issue 215). A shop with no working gateway at all cannot say anything
 * about money either, and saying nothing is the honest answer rather than a
 * promise it cannot keep.
 */
function depositLine(
  madeToOrder: PublicMadeToOrder,
  { priceCents = null, currency, locale, paymentMode = 'card' }: MadeToOrderCopyOptions
): string | null {
  const { deposit } = madeToOrder;
  if (deposit.type === 'none') return null;
  if (paymentMode === 'unavailable') return null;
  if (paymentMode === 'in_person') {
    return 'This shop does not take card payments on this website, so nothing is charged here.';
  }
  const money = (cents: number) => formatMoney(cents, currency, locale);
  if (deposit.type === 'amount') {
    return `Pay ${money(deposit.amountCents)} today, the rest when you collect.`;
  }
  if (priceCents === null) {
    return `Pay ${String(deposit.percent)}% today, the rest when you collect.`;
  }
  const now = Math.round((priceCents * deposit.percent) / 100);
  return `Pay ${money(now)} today (${String(deposit.percent)}%), the rest when you collect.`;
}

/** Only when it is actually running out. "24 left" on the first order of the day
 *  is a number nobody needed, and it is one step from manufactured urgency. */
function scarceLine(madeToOrder: PublicMadeToOrder): string | null {
  const left = madeToOrder.remainingToday;
  if (left === null || left > 5) return null;
  if (left === 0) return 'Sold out for today. There will be more tomorrow.';
  return `Only ${String(left)} left for today.`;
}

/**
 * Everything there is to say, or null when there is nothing.
 *
 * Every line is conditional on the shop having said so. Nothing here invents a
 * date, a number or a promise — a product with none of the three rules returns
 * null, which is every product that existed before this.
 */
export function madeToOrderCopy(
  madeToOrder: PublicMadeToOrder,
  options: MadeToOrderCopyOptions = {}
): MadeToOrderCopy | null {
  const copy: MadeToOrderCopy = {
    ready: readyLine(madeToOrder, options.locale),
    deposit: depositLine(madeToOrder, options),
    scarce: scarceLine(madeToOrder),
  };
  if (!copy.ready && !copy.deposit && !copy.scarce) return null;
  return copy;
}
