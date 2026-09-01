'use client';

// What the account's lifecycle phase MEANS, in words, in one place.
//
// Two surfaces say this: the rail's plan card (quiet, when the rail is open)
// and the band above the header (unmissable, everywhere else). They used to be
// one surface with the words inline, which is how the console came to warn
// nobody on a phone — there is no rail there, so there was no warning at all.
//
// The console never knows a PRICE (piggles/CLAUDE.md RULE #2). Nothing here
// reads one: `BillingPhaseView` is the lifecycle slice, and it carries dates and
// a countdown and no money. Every sentence ends at a door to getpiggles.com,
// which owns the conversation and is the only place allowed to answer with
// numbers.

import { useBill, type BillingPhaseView } from '../../surfaces/finance/bill-data';

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
  /** The one action, always a door out. */
  action: string;
}

/** Below this, a countdown stops being background information. */
const URGENT_DAYS = 3;

const days = (n: number) => `${String(n)} day${n === 1 ? '' : 's'}`;
/** "2 more days", not "2 days more". */
const more = (n: number) => `${String(n)} more day${n === 1 ? '' : 's'}`;

/**
 * The notice for a phase, or null when there is nothing to say.
 *
 * Null for `active` and `exempt` — a healthy account gets no standing billing
 * furniture in its workspace. Null too when the answer has not arrived yet: a
 * card that says "Free trial" before it knows is a value nobody measured being
 * rendered as one, and this is the sentence that has to be right.
 */
export function lifecycleNotice(billing: BillingPhaseView | undefined): Lifecycle | null {
  if (!billing) return null;

  // NULL IS NOT ZERO. `daysLeft` is null when nothing is counting down, and
  // reaching a counting phase with a null means the server could not work it
  // out. `?? 0` would print "0 days left" — a number nobody measured, rendered
  // as one, on the screen that tells somebody their site is about to go dark.
  // So a missing count drops the number and keeps the warning.
  const left = billing.daysLeft;

  if (billing.phase === 'suspended') {
    return {
      tone: 'danger',
      heading: 'Action needed',
      detail: 'Your site is offline',
      sentence: 'Your site is offline. It comes back as soon as a payment goes through.',
      action: 'Keep my business running',
    };
  }

  if (billing.phase === 'grace') {
    // Deliberately silent about WHY. Grace covers a trial that ended without
    // payment AND a renewal that failed, and the two are different stories —
    // naming the wrong one tells somebody their trial ended when they have been
    // paying for a year. What is true either way is what happens next, and the
    // door leads to the app that knows which it was.
    return {
      tone: 'danger',
      heading: 'Action needed',
      detail: left === null ? 'Your site goes offline soon' : `Site stays live ${more(left)}`,
      sentence:
        left === null
          ? 'Your site goes offline soon, and stays offline until a payment goes through.'
          : `Your site stays online for ${more(left)}. After that it goes offline until a payment goes through.`,
      action: 'Keep my business running',
    };
  }

  if (billing.phase === 'trialing') {
    // An unknown countdown is never the calm one. "Comfortable" is a claim about
    // how long is left, and we do not know.
    const urgent = left === null || left <= URGENT_DAYS;
    return {
      tone: urgent ? 'warning' : 'calm',
      heading: 'Free trial',
      detail: left === null ? 'Ending soon' : `${days(left)} left`,
      sentence:
        left === null
          ? 'Your free trial is ending. Set up payment to keep your site online.'
          : urgent
            ? `Your free trial ends in ${days(left)}. Set up payment to keep your site online.`
            : `Your free trial has ${days(left)} left. Set up payment now and nothing changes when it ends.`,
      action: 'Set up payment',
    };
  }

  return null;
}

/** The same, read from the account the console is signed in to. */
export function useLifecycle(): Lifecycle | null {
  const { data: bill } = useBill();
  // ONLY the phase view is read. `Bill` also carries `planTotalCents`,
  // `planModules` and a card's last four digits, and none of it may be touched
  // here — the console never knows a price. Destructuring `billing` rather than
  // passing `bill` is what keeps that true by construction.
  return lifecycleNotice(bill?.billing);
}
