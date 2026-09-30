// What a business is paying, said the way its owner would say it.
//
// ── THE THREE THINGS THIS FILE EXISTS FOR ───────────────────────────────────
//
// The account page drew `{tenant.subscriptionStatus ?? 'unknown'}` straight
// into a badge under the heading "Your plan". Three things were wrong with
// that, and only the first is obvious.
//
//   1. IT IS THE DATABASE'S WORD. `active` is a wire value: lower case, chosen
//      to match a payment provider, and never written for anybody to read. The
//      set is `trialing | active | past_due | canceled | unpaid | paused` and
//      not one of those six is a sentence. [[feedback_status_badges_semantic_color]]
//
//   2. THE FALLBACK WAS THE COMMON CASE. MEASURED 2026-09-25: 81 of 113
//      tenants have a NULL status and a NULL trial date, so 72% of businesses
//      opened this page and read a WARNING-colored pill saying **unknown**
//      about their own billing. "unknown" is a programmer's word for "we did
//      not record this", and it is not a plan state.
//      [[feedback_never_present_absence_as_measurement]]
//
//   3. NOTHING THIS PAGE SAYS ABOUT PAYING DEPENDED ON IT. The Payment section
//      read "There is nothing to pay while you are on the trial" for every
//      state. P03's trial ended on 2026-09-06 and her status is `active`, so
//      the badge said one thing and the paragraph four inches below it said the
//      opposite, on one screen. [[feedback_a_promise_in_copy_is_a_contract]]
//
// ── TONE ────────────────────────────────────────────────────────────────────
//
// A state that needs nothing from her carries NO tone, which renders a
// colorless badge. That is a different thing from naming `neutral` and needs no
// approval (RULE #4). A state that wants her attention gets `warning`; one that
// will stop the business working gets `danger`.

export type PlanTone = 'success' | 'warning' | 'danger';

export interface PlanState {
  /** The badge. A sentence fragment, never the stored value. */
  label: string;
  /** Undefined means colorless: nothing here needs her. */
  tone?: PlanTone;
  /** What this means for paying, for the Payment section. One sentence. */
  payment: string;
}

/** Whole days left, rounded up, so "1 day left" covers the last few hours. */
function daysLeft(trialEndsAt: Date, now: Date): number {
  return Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86_400_000);
}

const NO_CARD = 'There is no card on file, and nothing is charged to you until you put one there.';

export function planState(
  status: string | null | undefined,
  trialEndsAt: Date | null | undefined,
  now: Date = new Date()
): PlanState {
  // The trial reads off the DATE, not off the status word. A tenant can sit at
  // `trialing` with the date long past, which is the state the old code called
  // "Trial finished" and then told to relax because it was on a trial.
  if (status === 'trialing') {
    // No end date is a reachable state and must not fall through to "no billing
    // set up yet", which would contradict the status the row is carrying. It
    // says the true half and invents no date. MEASURED 2026-09-25: 0 rows, so
    // this is a branch held open rather than one anybody is reading.
    if (!trialEndsAt) {
      return {
        label: 'Free trial',
        tone: 'success',
        payment: `Nothing to pay while the trial is running. ${NO_CARD}`,
      };
    }
    const days = daysLeft(trialEndsAt, now);
    if (days > 0) {
      return {
        label: `Free trial: ${String(days)} day${days === 1 ? '' : 's'} left`,
        tone: 'success',
        payment: `Nothing to pay while the trial is running. ${NO_CARD}`,
      };
    }
    return {
      label: 'Free trial finished',
      tone: 'warning',
      payment: `Your free trial has ended. ${NO_CARD}`,
    };
  }

  switch (status) {
    case 'active':
      // NOT "Paid up". Nobody on this platform has paid anything: the Payment
      // section on the same page says taking a payment is still being built,
      // and MEASURED 2026-09-25 there is no card on file for any tenant. A
      // badge saying somebody is paid up, four inches above a sentence saying
      // there is nothing to pay with, is the same contradiction this file was
      // written to remove. "Running" is true either way.
      return {
        label: 'Your plan is running',
        tone: 'success',
        payment: NO_CARD,
      };
    case 'past_due':
      return {
        label: 'A payment did not go through',
        tone: 'danger',
        payment:
          'A payment was refused. Nothing has stopped working yet, and the card on file needs replacing before it does.',
      };
    case 'unpaid':
      return {
        label: 'Not paid',
        tone: 'danger',
        payment:
          'A bill has gone unpaid long enough that the account is at risk. Get in touch and we will sort it out with you.',
      };
    case 'canceled':
      return {
        label: 'Canceled',
        tone: 'warning',
        payment: 'This plan has been canceled. Nothing further is charged to you.',
      };
    case 'paused':
      return {
        label: 'Paused',
        tone: 'warning',
        payment: 'This plan is paused, so nothing is being charged while it stays that way.',
      };
    default:
      // NULL, and the majority. It is not a warning and it is not an error: it
      // means nobody has set billing up, which is true of every business on the
      // platform today because the paying half is still being built. Colorless,
      // because there is nothing here for her to do.
      return {
        label: 'No billing set up yet',
        payment: `Nothing has been set up to charge you, so nothing is being charged. ${NO_CARD}`,
      };
  }
}
