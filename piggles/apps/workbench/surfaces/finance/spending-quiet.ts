// What Spending says when a period has no costs but the business has some.
//
// The list opens on This month. On October 6 Juniper Row's five costs were all in
// September, and the screen said "Nothing recorded yet" with "Record what the
// business pays for", the words for a business that has never recorded a cost
// (issue 930). The period is a filter too. It names the period, says when the
// last cost was, and offers the shortest period that holds it.

import { PERIOD_OPTIONS, rangeFor, type PeriodKey } from './period';

/** The newest cost, as the list returns it. */
export interface LatestCost {
  incurredAt: string;
  description: string;
  amountCents: number;
  currency: string;
}

const PHRASE: Record<PeriodKey, string> = {
  this_month: 'this month',
  last_month: 'last month',
  this_quarter: 'this quarter',
  this_year: 'this year',
  last_12: 'in the last 12 months',
  all: '',
};

/** The shortest period on offer, after the one showing, that holds `day`. */
export function periodHolding(day: string, showing: PeriodKey, now = new Date()): PeriodKey {
  const key = day.slice(0, 10);
  const holding = PERIOD_OPTIONS.find(({ value }) => {
    if (value === showing || value === 'all') return false;
    const range = rangeFor(value, now);
    return key >= range.from && key <= range.to;
  });
  return holding?.value ?? 'all';
}

export interface QuietPeriod {
  title: string;
  /** Null while the newest cost is still being read. */
  last: LatestCost | null;
  show: PeriodKey | null;
  showLabel: string | null;
}

/**
 * Null when this is not a quiet period: every period is showing, or the business
 * has never recorded a cost (then the first-run words are true). `latest` is
 * undefined while it loads, so the screen never says "yet" in the meantime.
 */
export function quietPeriod(
  period: PeriodKey,
  latest: LatestCost | null | undefined,
  now = new Date()
): QuietPeriod | null {
  if (period === 'all' || latest === null) return null;
  const title = `Nothing recorded ${PHRASE[period]}`;
  if (latest === undefined) return { title, last: null, show: null, showLabel: null };
  const show = periodHolding(latest.incurredAt, period, now);
  const label = PERIOD_OPTIONS.find((option) => option.value === show)?.label ?? 'All time';
  return { title, last: latest, show, showLabel: `Show ${label.toLowerCase()}` };
}
