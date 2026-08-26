'use client';

// What a return's stored values are CALLED on screen.
//
// Split out of returns-data.ts so a return's vocabulary has exactly one home.
// The order pane's "start a return" form and the return detail pane were
// briefly disagreeing about the same stored code — one offering "They changed
// their mind", the other reading it back as "No longer needed" — which is the
// whole failure a shared word list exists to prevent.
//
// The stored values are a developer's vocabulary. `inspected`, `in_transit`
// and `no_longer_needed` tell a business owner nothing about what happened or
// what to do next, so none of them reaches a screen untranslated.

import type { Tone } from './data';
import type { ReturnStatus } from './returns-types';

/** How a settled return ends depends on what the customer ASKED for, so the two
 *  states that talk about settling take the outcome too. Everything else is the
 *  same sentence whatever they wanted. */
// A plain string rather than the five known codes: `preferredOutcome` arrives
// as whatever the server stored, and a union would only be a union in the type
// system.
type Settling = string;

/** What "finish this" means for each outcome. Getting this wrong told a
 *  customer owed a replacement that she had to be given her money back
 *  (issue 220). */
function finishBy(outcome: Settling): string {
  switch (outcome) {
    case 'exchange':
      return 'Send the replacement they asked for to finish. No money moves.';
    case 'account_credit':
    case 'store_credit':
      return 'Give them the credit they asked for to finish.';
    case 'repair':
      return 'Repair it and send it back to finish.';
    default:
      return 'Give the customer their money back to finish.';
  }
}

/**
 * Where a return is, in the words a business owner uses. The stored values are a
 * developer's vocabulary — "inspected" and "in_transit" tell an owner nothing
 * about what they should do next.
 */
export function returnState(
  status: ReturnStatus,
  outcome: Settling = 'refund'
): { label: string; tone: Tone; detail: string } {
  switch (status) {
    case 'requested':
      return {
        label: 'Needs a decision',
        tone: 'warning',
        detail: 'A customer has asked to send something back. Approve it or turn it down.',
      };
    case 'approved':
      return {
        label: 'Approved',
        tone: 'info',
        detail: 'You said yes. Waiting for the goods to come back to you.',
      };
    case 'awaiting_shipment':
      return {
        label: 'Waiting to be sent',
        tone: 'info',
        detail: 'Approved — the customer has not put it in the post yet.',
      };
    case 'in_transit':
      return {
        label: 'On its way back',
        tone: 'info',
        detail: 'The customer has sent it and it is coming back to you.',
      };
    case 'received':
      return {
        label: 'Back with you',
        tone: 'info',
        detail: `The goods have arrived. Check their condition, then ${
          outcome === 'exchange' ? 'send the replacement' : 'settle it'
        }.`,
      };
    case 'inspecting':
      return {
        label: 'Being checked',
        tone: 'info',
        detail: 'You are looking over what came back.',
      };
    case 'inspected':
      return {
        label: 'Checked, ready to settle',
        tone: 'info',
        detail: `You have recorded the condition. ${finishBy(outcome)}`,
      };
    case 'refunded':
      return {
        label: 'Settled',
        tone: 'success',
        detail: 'The customer has had their money back and this return is done.',
      };
    case 'exchanged':
      return {
        label: 'Swapped',
        tone: 'success',
        detail: 'You sent the replacement. Nothing was owed either way, so no money moved.',
      };
    case 'denied':
      return {
        label: 'Turned down',
        tone: 'danger',
        detail: 'You declined this return. Nothing is coming back and no money changes hands.',
      };
    case 'cancelled':
      return {
        label: 'Cancelled',
        tone: 'neutral',
        detail: 'This return was called off before it was settled.',
      };
    default:
      return { label: status, tone: 'neutral', detail: '' };
  }
}

/** Why the customer is sending it back, in plain words. */
export const REASON_LABELS: Record<string, string> = {
  wrong_item: 'Wrong item sent',
  wrong_size: 'Wrong size',
  defective: 'Faulty',
  damaged_in_transit: 'Damaged on the way',
  not_as_described: 'Not as described',
  no_longer_needed: 'No longer needed',
  arrived_late: 'Arrived too late',
  other: 'Another reason',
};

/** What the customer would like instead of keeping the item. */
export const OUTCOME_LABELS: Record<string, string> = {
  refund: 'Money back',
  account_credit: 'Store credit',
  store_credit: 'Store credit',
  exchange: 'A replacement',
  repair: 'A repair',
};

/** How the goods came back, worst-to-best mattering for whether they can be
 *  resold. */
export const CONDITION_LABELS: Record<string, string> = {
  unopened: 'Unopened',
  like_new: 'As new',
  used_good: 'Used — good',
  used_acceptable: 'Used — acceptable',
  damaged: 'Damaged',
  destroyed: 'Destroyed',
};

/** How the money was actually given back. */
export const REFUND_ISSUED_AS_LABELS: Record<string, string> = {
  original_payment: 'Back to how they paid',
  account_credit: 'As store credit',
  gift_card: 'As a gift card',
};

export function reasonLabel(code: string): string {
  return REASON_LABELS[code] ?? code;
}

export function outcomeLabel(code: string): string {
  return OUTCOME_LABELS[code] ?? code;
}

export function conditionLabel(code: string): string {
  return CONDITION_LABELS[code] ?? code;
}

/* ── The lists a person picks FROM ──────────────────────────────────────── */
//
// Order matters here and does not in the maps above: a map answers "what is
// this called", a list decides what she reads first. Both draw their words from
// the same maps, so a reason can never be offered under one name and read back
// under another.

/** Why it is going back, roughly in the order a clothing shop meets them. */
const REASON_ORDER = [
  'wrong_size',
  'not_as_described',
  'defective',
  'damaged_in_transit',
  'wrong_item',
  'no_longer_needed',
  'arrived_late',
  'other',
] as const;

/** What they want to happen next. `repair` is deliberately absent: the server
 *  accepts it, but it needs a workshop behind it and nothing in the console can
 *  record one yet, so offering it would promise a screen that does not exist. */
const OUTCOME_ORDER = ['exchange', 'refund', 'account_credit'] as const;

export const RETURN_REASONS = REASON_ORDER.map((value) => ({
  value,
  label: reasonLabel(value),
}));

export const RETURN_OUTCOMES = OUTCOME_ORDER.map((value) => ({
  value,
  label: outcomeLabel(value),
}));

/** What a fresh form starts on. Read off the ordered lists rather than repeated,
 *  so reordering the offer cannot silently change the default. */
export const DEFAULT_RETURN_REASON: string = REASON_ORDER[0];
export const DEFAULT_RETURN_OUTCOME: string = OUTCOME_ORDER[0];

/** What each decision is called in the words a person would use. */
export function dispositionLabel(disposition: string): string {
  switch (disposition) {
    case 'restock':
      return 'Back on sale';
    case 'quarantine':
      return 'Quarantined';
    case 'repair':
      return 'Awaiting repair';
    case 'scrap':
      return 'Scrapped';
    default:
      return 'Not decided';
  }
}

/** Color carries the distinction: back-on-sale is a recovery, scrap is a loss,
 *  and the two middle states are different kinds of "not yet" (DESIGN.md). */
export function dispositionTone(
  disposition: string | null
): 'success' | 'warning' | 'info' | 'danger' | 'neutral' {
  switch (disposition) {
    case 'restock':
      return 'success';
    case 'quarantine':
      return 'warning';
    case 'repair':
      return 'info';
    case 'scrap':
      return 'danger';
    default:
      return 'neutral';
  }
}
