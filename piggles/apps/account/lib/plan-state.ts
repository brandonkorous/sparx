// What a business is paying, said the way its owner would say it. The badge and
// the Payment sentence both read from here, so they cannot contradict each other.
// Status is a wire value (`trialing | active | …`), never shown as written.

export type PlanTone = 'success' | 'warning' | 'danger';

export interface PlanState {
  /** The badge. A sentence fragment, never the stored value. */
  label: string;
  /** Undefined means colorless: nothing here needs her (not `neutral`, RULE #4). */
  tone?: PlanTone;
  /** What this means for paying, for the Payment section. One or two sentences. */
  payment: string;
}

/** Whole days left, rounded up, so "1 day left" covers the last few hours. */
function daysLeft(trialEndsAt: Date, now: Date): number {
  return Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
}

const NO_CARD = 'There is no card on file, and nothing is charged to you until you put one there.';

function dayOf(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' });
}

/** A trial reads off its DATE, not the status word: a row can sit at `trialing`
 *  with the date long past. */
function trialState(trialEndsAt: Date | null | undefined, hasCard: boolean, now: Date) {
  const days = trialEndsAt ? daysLeft(trialEndsAt, now) : null;
  if (days !== null && days <= 0) {
    return {
      label: 'Free trial finished',
      tone: 'warning' as const,
      payment: hasCard
        ? 'Your free trial has ended, and your card on file is now charged each month.'
        : `Your free trial has ended. ${NO_CARD}`,
    };
  }
  const label =
    days === null ? 'Free trial' : `Free trial: ${String(days)} day${days === 1 ? '' : 's'} left`;
  const firstCharge = trialEndsAt ? ` The first charge is on ${dayOf(trialEndsAt)}.` : '';
  return {
    label,
    tone: 'success' as const,
    payment: hasCard
      ? `Nothing to pay while the trial is running. Your card is on file.${firstCharge}`
      : `Nothing to pay while the trial is running. ${NO_CARD}`,
  };
}

const AFTER_TRIAL: Record<string, PlanState> = {
  past_due: {
    label: 'A payment did not go through',
    tone: 'danger',
    payment:
      'A payment was refused. Nothing has stopped working yet, and the card on file needs replacing before it does.',
  },
  unpaid: {
    label: 'Not paid',
    tone: 'danger',
    payment:
      'A bill has gone unpaid long enough that the account is at risk. Get in touch and we will sort it out with you.',
  },
  canceled: {
    label: 'Canceled',
    tone: 'warning',
    payment: 'This plan has been canceled. Nothing further is charged to you.',
  },
  paused: {
    label: 'Paused',
    tone: 'warning',
    payment: 'This plan is paused, so nothing is being charged while it stays that way.',
  },
};

export function planState(
  status: string | null | undefined,
  trialEndsAt: Date | null | undefined,
  hasCard = false,
  now: Date = new Date()
): PlanState {
  if (status === 'trialing') return trialState(trialEndsAt, hasCard, now);
  if (status === 'active') {
    // "Running", not "Paid up": a business moved to active by hand has no card.
    return {
      label: 'Your plan is running',
      tone: 'success',
      payment: hasCard ? 'Your card on file is charged each month.' : NO_CARD,
    };
  }
  const known = status ? AFTER_TRIAL[status] : undefined;
  if (known) return known;
  // NULL: nobody has set billing up. Not a warning, so colorless.
  return {
    label: 'No billing set up yet',
    payment: `Nothing has been set up to charge you, so nothing is being charged. ${NO_CARD}`,
  };
}
