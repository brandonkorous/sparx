// What a counter sale has to work out about things that are MADE (issue 026):
// which day it is due, and how much of it she asks for now.
//
// Pure line arithmetic, kept out of sale-data so that file stays the reads and
// the write.

import type { SaleLine } from './sale-data';

/** The longest notice anything on this sale needs, or null when none does. The
 *  longest and not the sum: two things being made alongside each other are
 *  ready together. */
export function noticeOn(lines: SaleLine[]): number | null {
  let most: number | null = null;
  for (const line of lines) {
    const days = line.orderAheadDays;
    if (days !== null && days > 0 && (most === null || days > most)) most = days;
  }
  return most;
}

/**
 * What the shop asked to hold on this sale, in whole currency units. Null when
 * nothing on it carries a deposit rule, and the till then fills the amount with
 * the whole total exactly as it always has.
 *
 * There is no daily-allowance check here on purpose. That limit is a promise
 * the WEBSITE keeps on her behalf; she is standing at her own counter and can
 * decide to make one more.
 */
export function depositDue(lines: SaleLine[]): number | null {
  let asked = 0;
  let any = false;
  for (const line of lines) {
    const rule = line.deposit;
    const lineTotal = (Number(line.price) || 0) * line.quantity;
    if (!rule || rule.type === 'none') {
      asked += lineTotal;
      continue;
    }
    any = true;
    asked +=
      rule.type === 'amount'
        ? Math.min(lineTotal, (rule.amountCents / 100) * line.quantity)
        : Math.min(lineTotal, (lineTotal * rule.percent) / 100);
  }
  return any ? Math.round(asked * 100) / 100 : null;
}

/** The day a sale taken now would be due, as a person reads it. Null when
 *  nothing on it needs making, which draws nothing rather than "today". */
export function dueDayLabel(lines: SaleLine[]): string | null {
  const days = noticeOn(lines);
  if (days === null) return null;
  const when = new Date();
  when.setDate(when.getDate() + days);
  return when.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}
