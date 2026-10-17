// The billing prompting ladder (docs/17 §6) as PURE logic — maps a tenant's
// lifecycle phase + countdown to the topbar chip and the escalating banner. No
// React, no I/O, so it's unit-tested directly and the chrome components stay thin.
//
// Escalation, not nagging:
//   trial, >7 days left   → quiet chip only, no banner
//   trial, 3–7 days left  → dismissible heads-up banner (info)
//   trial, ≤2 days left   → persistent countdown banner (warning)
//   grace (site still up)  → persistent "paused · site live N more days" (warning)
//   suspended (site dark)  → persistent "site offline" (danger)
//   active / exempt        → nothing

import type { BillingPhaseView } from '../../surfaces/finance/bill-data';
import { calendarDaysLeft, staysWords, whenWords } from './days-left';

/** Threshold (days left) below which the trial heads-up banner appears. */
const HEADS_UP_DAYS = 7;
/** Threshold (days left) at/under which the banner turns persistent (non-dismissible). */
const URGENT_DAYS = 2;

export type BillingTone = 'info' | 'warning' | 'danger';

/** The compact topbar chip. Null when there's nothing to show (active/exempt). */
export interface BillingChip {
  label: string;
  tone: 'neutral' | 'warning' | 'danger';
}

/** The full-width banner beneath the toolbar. Null when no banner is warranted. */
export interface BillingNotice {
  /** Stable id for the tier — used as the dismissal scope + React key. */
  level: 'trial-heads-up' | 'trial-ending' | 'grace' | 'suspended';
  tone: BillingTone;
  title: string;
  body: string;
  /** The button to the bill, or null for somebody who may not pay it: they
   *  are told who can instead (sparx persona issue 168). */
  ctaLabel: string | null;
  /** Only the earliest (heads-up) tier can be dismissed; everything past it is
   *  persistent — you can't dismiss your site going dark. */
  dismissible: boolean;
}

function dayWord(n: number): string {
  return n === 1 ? 'day' : 'days';
}

/** The topbar chip for the current phase, or null. */
export function billingChip(billing: BillingPhaseView, now: Date = new Date()): BillingChip | null {
  const days = calendarDaysLeft(billing, now) ?? 0;
  switch (billing.phase) {
    case 'trialing':
      return {
        label: `Trial · ${days}d`,
        tone: days <= URGENT_DAYS ? 'warning' : 'neutral',
      };
    case 'grace':
      return { label: `Site live · ${days}d`, tone: 'warning' };
    case 'suspended':
      return { label: 'Site offline', tone: 'danger' };
    default:
      return null;
  }
}

/**
 * The banner for the current phase, or null (quiet chip-only / active / exempt).
 *
 * `canPay` is whether the person looking may add a card: an owner or an admin.
 * Everybody else on the team still hears that the trial is ending, since it is
 * news about the business, and is told who can act on it, with no button. Alyssa,
 * an Editor, was offered "Add payment method" and refused on the page it opened
 * (sparx persona issue 168).
 */
export function billingNotice(
  billing: BillingPhaseView,
  canPay = true,
  now: Date = new Date()
): BillingNotice | null {
  const notice = ownersNotice(billing, now);
  if (!notice || canPay) return notice;
  return {
    ...notice,
    body: TEAM_BODY[notice.level](calendarDaysLeft(billing, now) ?? 0),
    ctaLabel: null,
  };
}

/** What the rest of the team reads instead of the owner's call to action. */
const TEAM_BODY: Record<BillingNotice['level'], (days: number) => string> = {
  'trial-heads-up': () =>
    'An owner or an admin can add a payment method to keep every feature running when the trial ends.',
  'trial-ending': () =>
    'Ask an owner or an admin to add a payment method, so nothing switches off when the trial ends.',
  grace: (days) =>
    `Your public site stays live ${staysWords(days)}. An owner or an admin can add a payment method to switch everything back on.`,
  suspended: () =>
    'An owner or an admin can add a payment method to bring your site and features back. Nothing has been deleted.',
};

function ownersNotice(billing: BillingPhaseView, now: Date): BillingNotice | null {
  // Counted on the calendar: 25 hours left is "tomorrow", not "2 days" (issue 272).
  const days = calendarDaysLeft(billing, now) ?? 0;

  switch (billing.phase) {
    case 'trialing': {
      if (days > HEADS_UP_DAYS) return null; // quiet chip only
      if (days > URGENT_DAYS) {
        return {
          level: 'trial-heads-up',
          tone: 'info',
          title: `${days} ${dayWord(days)} left in your free trial`,
          body: 'Add a payment method to keep every feature running when your trial ends. No charge until then.',
          ctaLabel: 'Add payment method',
          dismissible: true,
        };
      }
      return {
        level: 'trial-ending',
        tone: 'warning',
        title: `Your free trial ends ${whenWords(days)}`,
        body: 'Add a payment method now so nothing switches off when the trial ends.',
        ctaLabel: 'Add payment method',
        dismissible: false,
      };
    }
    case 'grace':
      return {
        level: 'grace',
        tone: 'warning',
        title: 'Your trial has ended: paid features are paused',
        body: `Your public site stays live ${staysWords(days)}. Add a payment method to switch everything back on.`,
        ctaLabel: 'Add payment method',
        dismissible: false,
      };
    case 'suspended':
      return {
        level: 'suspended',
        tone: 'danger',
        title: 'Your site is offline',
        body: 'Add a payment method to bring your site and features back instantly. Nothing has been deleted.',
        ctaLabel: 'Reactivate now',
        dismissible: false,
      };
    default:
      return null;
  }
}
