// Days left in a countdown, counted on the calendar (persona issue 272).

import type { BillingPhaseView } from '../../surfaces/finance/bill-data';

const DAY_MS = 86_400_000;

/** 0 is today, 1 is tomorrow, on this computer's calendar. The server's
 *  `daysLeft` rounds 24-hour blocks up, so a trial ending tomorrow read "2 days". */
export function calendarDaysLeft(view: BillingPhaseView, now: Date = new Date()): number | null {
  const end =
    view.phase === 'trialing' ? view.trialEndsAt : view.phase === 'grace' ? view.suspendsAt : null;
  const at = end ? new Date(end) : null;
  if (!at || Number.isNaN(at.getTime())) return view.daysLeft;
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.max(0, Math.round((day(at) - day(now)) / DAY_MS));
}

/** "today", "tomorrow", "in 3 days". */
export function whenWords(days: number): string {
  if (days <= 0) return 'today';
  return days === 1 ? 'tomorrow' : `in ${String(days)} days`;
}

/** How long something stays: "until the end of today", "until tomorrow". */
export function staysWords(days: number): string {
  if (days <= 0) return 'until the end of today';
  return days === 1 ? 'until tomorrow' : `for ${String(days)} more days`;
}
