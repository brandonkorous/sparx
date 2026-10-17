'use client';

// What the lifecycle phase MEANS, in words, for both the rail card and the band (a phone has no rail).
// The console never knows a PRICE (piggles/CLAUDE.md RULE #2): `BillingPhaseView` carries dates and
// a countdown, no money, and every sentence ends at a door to getpiggles.com.

import { useBill, type BillingPhaseView } from '../../surfaces/finance/bill-data';
import { useManageRights } from '../manage-rights';
import { calendarDaysLeft, staysWords, whenWords } from './days-left';

/** How loud to be. `calm` is a countdown that is still comfortable; `danger` is
 *  a site that is already offline. */
export type LifecycleTone = 'calm' | 'warning' | 'danger';

export interface Lifecycle {
  tone: LifecycleTone;
  /** The rail card's two lines. */
  heading: string;
  detail: string;
  /** The band's one sentence. Says the same thing in full, because the band has
   *  the width for it and is often the only thing a person will see. */
  sentence: string;
  /** The one action, always a door out. Null for somebody who may not pay:
   *  the sentence names who can (sparx persona issue 168). */
  action: string | null;
}

/** Below this, a countdown stops being background information. */
const URGENT_DAYS = 3;

const days = (n: number) => `${String(n)} day${n === 1 ? '' : 's'}`;

/** The notice for a phase, or null for `active`/`exempt` and before the answer arrives (never guess).
 *  `canPay` (owner or admin) gets the action; everybody else hears the news and who can act on it. */
export function lifecycleNotice(
  billing: BillingPhaseView | undefined,
  canPay = true,
  now: Date = new Date()
): Lifecycle | null {
  if (!billing) return null;
  // Counted on the calendar: 25 hours left is "tomorrow", not "2 days" (issue 272).
  const left = calendarDaysLeft(billing, now);
  const notice = ownersNotice(billing, left);
  if (!notice || canPay) return notice;
  return { ...notice, sentence: teamSentence(billing, left), action: null };
}

/** The band's sentence for the rest of the team, with the same facts in it. */
function teamSentence(billing: BillingPhaseView, left: number | null): string {
  if (billing.phase === 'suspended') {
    return 'Your site is offline. An owner or an admin can set up payment to bring it back.';
  }
  if (billing.phase === 'grace') {
    return left === null
      ? 'Your site goes offline soon, until an owner or an admin sets up payment.'
      : `Your site stays online ${staysWords(left)}. After that it goes offline until an owner or an admin sets up payment.`;
  }
  if (left === null) {
    return 'Your free trial is ending. Ask an owner or an admin to set up payment to keep your site online.';
  }
  return left <= URGENT_DAYS
    ? `Your free trial ends ${whenWords(left)}. Ask an owner or an admin to set up payment to keep your site online.`
    : `Your free trial has ${days(left)} left. An owner or an admin can set up payment, and nothing changes when it ends.`;
}

// NULL IS NOT ZERO: a null `left` means the server could not count, so the number is dropped
// and the warning kept. `?? 0` would print "0 days left", a number nobody measured.
function ownersNotice(billing: BillingPhaseView, left: number | null): Lifecycle | null {
  if (billing.phase === 'suspended') {
    return {
      tone: 'danger',
      heading: 'Action needed',
      detail: 'Your site is offline',
      sentence: 'Your site is offline. It comes back as soon as a payment goes through.',
      action: 'Keep my business running',
    };
  }
  if (billing.phase === 'grace') return graceNotice(left);
  if (billing.phase === 'trialing') return trialNotice(left);
  return null;
}

// Deliberately silent about WHY: grace covers both an ended trial and a failed renewal, and naming
// the wrong one misleads. What happens next is true either way; the door knows which it was.
function graceNotice(left: number | null): Lifecycle {
  return {
    tone: 'danger',
    heading: 'Action needed',
    detail: left === null ? 'Your site goes offline soon' : `Site stays live ${staysWords(left)}`,
    sentence:
      left === null
        ? 'Your site goes offline soon, and stays offline until a payment goes through.'
        : `Your site stays online ${staysWords(left)}. After that it goes offline until a payment goes through.`,
    action: 'Keep my business running',
  };
}

function trialNotice(left: number | null): Lifecycle {
  // An unknown countdown is never the calm one: "comfortable" is a claim about time we do not know.
  const urgent = left === null || left <= URGENT_DAYS;
  return {
    tone: urgent ? 'warning' : 'calm',
    heading: 'Free trial',
    detail: left === null ? 'Ending soon' : `${days(left)} left`,
    sentence:
      left === null
        ? 'Your free trial is ending. Set up payment to keep your site online.'
        : urgent
          ? `Your free trial ends ${whenWords(left)}. Set up payment to keep your site online.`
          : `Your free trial has ${days(left)} left. Set up payment now and nothing changes when it ends.`,
    action: 'Set up payment',
  };
}

/** The same, read from the account the console is signed in to. */
export function useLifecycle(): Lifecycle | null {
  const { data: bill } = useBill();
  const rights = useManageRights();
  // ONLY the phase view is read: `Bill` also carries prices and card digits the console may never
  // touch. Passing `bill.billing`, not `bill`, keeps that true by construction. Nothing until
  // the session is read, so an owner never sees the team's words.
  if (!rights.known) return null;
  return lifecycleNotice(bill?.billing, rights.canManage);
}
