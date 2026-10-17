// Your sparx bill, in words: its state badge and the line under the amount.
//
// Pure, so the tests can read them. Both follow the billing PHASE before the raw
// subscription status: a trial that ran out with no card still holds the status
// "trialing" on its row, and the bill read "Free trial" and "Free trial ends Oct
// 15, 2026" the day after it ended (sparx persona issue 288).

import type { Bill } from './bill-data';
import { formatDate } from './format';

function failedRenewal(bill: Pick<Bill, 'subscriptionStatus'>): boolean {
  return bill.subscriptionStatus === 'past_due' || bill.subscriptionStatus === 'unpaid';
}

/**
 * Why paid features lapsed, as a sentence with a trailing space, or '' when the
 * bill does not say. Reads the bill's own trial date, not `billing.trialEndsAt`:
 * the phase view drops that date once the site is offline, and a business whose
 * trial ran out was then told "Your sparx bill has not been paid" when it never
 * had a bill (sparx persona issue 289).
 */
export function lapseReason(bill: Pick<Bill, 'subscriptionStatus' | 'trialEndsAt'>): string {
  if (failedRenewal(bill)) return 'Your last payment did not go through. ';
  // A canceled plan ran out on its own; an old trial date is not why.
  if (bill.subscriptionStatus === 'canceled') return 'Your plan was canceled. ';
  if (bill.trialEndsAt) return `Your free trial ended ${formatDate(bill.trialEndsAt)}. `;
  return '';
}

/** How the subscription is doing, in words + color. */
export function planState(bill: Bill): {
  label: string;
  tone: 'success' | 'warning' | 'error' | 'info' | 'neutral';
} {
  if (bill.planType === 'enterprise') return { label: 'Custom plan', tone: 'info' };
  if (bill.billing.phase === 'suspended') return { label: 'Site offline', tone: 'error' };
  if (bill.billing.phase === 'grace') {
    return failedRenewal(bill)
      ? { label: 'Payment due', tone: 'error' }
      : { label: 'Trial ended', tone: 'warning' };
  }
  const status = bill.subscriptionStatus;
  if (status === 'trialing') return { label: 'Free trial', tone: 'info' };
  if (status === 'active') return { label: 'Active', tone: 'success' };
  if (failedRenewal(bill)) return { label: 'Payment due', tone: 'error' };
  if (status === 'canceled') return { label: 'Canceled', tone: 'neutral' };
  if (bill.cancelAtPeriodEnd) return { label: 'Ends soon', tone: 'warning' };
  if (bill.planModules.length > 0) return { label: 'Active', tone: 'success' };
  return { label: 'No paid plan', tone: 'neutral' };
}

/** The line under the amount: the countdown, the lapse, or the renewal. */
export function renewalLine(bill: Bill): string | null {
  // A custom plan's dates are in its agreement.
  if (bill.planType === 'enterprise') return null;
  const { phase, suspendsAt } = bill.billing;
  if (phase === 'grace' || phase === 'suspended') {
    const why = lapseReason(bill);
    if (phase === 'suspended') {
      return `${why}Your website is offline, and your paid features are paused, until a card is added.`;
    }
    return suspendsAt
      ? `${why}Your paid features are paused. Your website stays live until ${formatDate(suspendsAt)}.`
      : `${why}Your paid features are paused until a card is added.`;
  }
  if (phase === 'trialing' && bill.trialEndsAt) {
    return `Free trial ends ${formatDate(bill.trialEndsAt)}`;
  }
  if (bill.currentPeriodEnd) {
    return bill.cancelAtPeriodEnd
      ? `Your plan ends ${formatDate(bill.currentPeriodEnd)}`
      : `Renews ${formatDate(bill.currentPeriodEnd)}`;
  }
  return null;
}

/** What a paused module's pane says (sparx persona issue 289). */
export function pausedWords(
  bill: Pick<Bill, 'billing' | 'subscriptionStatus' | 'trialEndsAt'>,
  name: string,
  canPay: boolean
): { title: string; description: string } {
  // The bill screen's own reason, so the two never disagree.
  const ended = lapseReason(bill).trim() || 'Your sparx bill has not been paid.';
  const site =
    bill.billing.phase === 'suspended'
      ? 'Your website is offline until then.'
      : bill.billing.suspendsAt
        ? `Your website keeps working until ${formatDate(bill.billing.suspendsAt)}.`
        : 'Your website keeps working for now.';
  const who = canPay
    ? `Add a payment method to switch ${name} back on.`
    : `An owner or an admin can add a payment method to switch ${name} back on.`;
  return {
    title: `${name} is paused`,
    description: `${ended} ${who} Nothing you made in ${name} is lost. ${site}`,
  };
}
