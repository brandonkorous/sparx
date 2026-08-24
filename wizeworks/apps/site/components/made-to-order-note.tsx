// What a shopper is told BEFORE they commit to something that has to be made
// (issue 026): how long the wait is, what they will actually be charged today,
// and whether today's batch has any left.
//
// Every line is conditional on the shop having said so. Nothing here invents a
// date, a number or a promise — a product with none of the three rules renders
// nothing at all, which is every product that existed before this.

import type { PublicMadeToOrder } from '@/lib/commerce';
import { formatMoney } from '@/lib/format';

/** A `YYYY-MM-DD` as a day a person recognises. Built from the parts rather
 *  than parsed as an instant: `new Date('2026-08-29')` is UTC midnight, which
 *  prints as the 28th anywhere west of Greenwich. */
function dayLabel(day: string, locale: string): string | null {
  const [year, month, date] = day.split('-').map(Number);
  if (!year || !month || !date) return null;
  return new Date(year, month - 1, date).toLocaleDateString(locale, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

function depositLine(
  madeToOrder: PublicMadeToOrder,
  priceCents: number | null,
  currency: string,
  locale: string
): string | null {
  const { deposit } = madeToOrder;
  if (deposit.type === 'none') return null;
  if (deposit.type === 'amount') {
    return `Pay ${formatMoney(deposit.amountCents, currency, locale)} today, the rest when you collect.`;
  }
  // The percentage is what the shop set; the money is only shown once a variant
  // is resolved, because a range cannot be turned into one honest number.
  if (priceCents === null) {
    return `Pay ${String(deposit.percent)}% today, the rest when you collect.`;
  }
  const now = Math.round((priceCents * deposit.percent) / 100);
  return `Pay ${formatMoney(now, currency, locale)} today (${String(deposit.percent)}%), the rest when you collect.`;
}

export function MadeToOrderNote({
  madeToOrder,
  priceCents,
  currency,
  locale,
}: {
  madeToOrder: PublicMadeToOrder;
  /** The resolved variant's price, or null while a choice is still open. */
  priceCents: number | null;
  currency: string;
  locale: string;
}) {
  const ready = madeToOrder.readyOn ? dayLabel(madeToOrder.readyOn, locale) : null;
  const deposit = depositLine(madeToOrder, priceCents, currency, locale);
  // Only when it is actually running out. "24 left" on the first order of the
  // day is a number nobody needed, and it is one step from manufactured urgency.
  const scarce =
    madeToOrder.remainingToday !== null && madeToOrder.remainingToday <= 5
      ? madeToOrder.remainingToday
      : null;

  if (!ready && !deposit && scarce === null) return null;

  return (
    <div className="rounded-box border-base-300 bg-base-200 text-base-content flex flex-col gap-1 border p-3 text-sm">
      {ready ? (
        <span className="font-semibold">
          Made to order. Ready from {ready}
          {madeToOrder.orderAheadDays !== null
            ? ` — we need ${String(madeToOrder.orderAheadDays)} day${madeToOrder.orderAheadDays === 1 ? '' : 's'} to make it.`
            : '.'}
        </span>
      ) : null}
      {deposit ? <span>{deposit}</span> : null}
      {scarce !== null ? (
        <span className="font-semibold">
          {scarce === 0
            ? 'Sold out for today. There will be more tomorrow.'
            : `Only ${String(scarce)} left for today.`}
        </span>
      ) : null}
    </div>
  );
}
