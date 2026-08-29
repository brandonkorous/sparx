// A return's state in the SHOPPER's words, and the tone that carries it.
//
// Shared by the returns list, the return detail and the order page for the same
// reason `orderStatusTone` is shared: three screens describing one fact must not
// invent three descriptions of it (issue 295 was that, on orders).
//
// The stored vocabulary is the shop's — `awaiting_shipment`, `inspecting`,
// `exchanged`. None of it is a phrase a customer would use about a parcel she is
// sending back, and none of it tells her whose turn it is, which is the only
// thing she actually wants to know.

import type { SilicaColor } from '@wizeworks/silicaui-react';

interface ReturnState {
  label: string;
  /** Whose move it is. The list leads with this, because "waiting on you" and
   *  "waiting on them" are the difference between a task and a status. */
  hint: string;
  tone: SilicaColor;
  /** She still has to put it in the post. */
  actionNeeded: boolean;
}

const STATES: Record<string, ReturnState> = {
  requested: {
    label: 'Waiting for a decision',
    hint: 'We have your request and will come back to you.',
    tone: 'info',
    actionNeeded: false,
  },
  approved: {
    label: 'Approved',
    hint: 'Send the items back when you are ready.',
    tone: 'success',
    actionNeeded: true,
  },
  awaiting_shipment: {
    label: 'Ready to send back',
    hint: 'Post the items back to us.',
    tone: 'warning',
    actionNeeded: true,
  },
  in_transit: {
    label: 'On its way back',
    hint: 'We will let you know when it arrives.',
    tone: 'info',
    actionNeeded: false,
  },
  received: {
    label: 'We have it',
    hint: 'Your return has arrived with us.',
    tone: 'info',
    actionNeeded: false,
  },
  inspecting: {
    label: 'Being checked',
    hint: 'We are looking at what came back.',
    tone: 'info',
    actionNeeded: false,
  },
  inspected: {
    label: 'Checked',
    hint: 'We have looked at it and are settling up.',
    tone: 'info',
    actionNeeded: false,
  },
  refunded: {
    label: 'Refunded',
    hint: 'Your money has gone back.',
    tone: 'success',
    actionNeeded: false,
  },
  exchanged: {
    label: 'Replacement sent',
    hint: 'We sent the swap instead of a refund.',
    tone: 'success',
    actionNeeded: false,
  },
  denied: {
    label: 'Declined',
    hint: 'We could not accept this one.',
    tone: 'danger',
    actionNeeded: false,
  },
  cancelled: {
    label: 'Cancelled',
    hint: 'This request was stopped and nothing happened.',
    tone: 'warning',
    actionNeeded: false,
  },
};

/** Unknown states are possible: the stored vocabulary can grow ahead of this
 *  file. Say the raw word rather than nothing — a blank badge is worse than an
 *  unfamiliar one — and claim no action. */
export function returnState(status: string): ReturnState {
  return (
    STATES[status] ?? {
      label: status.replace(/_/g, ' '),
      hint: 'We will keep you posted.',
      tone: 'info',
      actionNeeded: false,
    }
  );
}

/** What she asked for, standing on its own in a list. */
export function outcomeLabel(outcome: string): string {
  if (outcome === 'exchange') return 'Swap for another';
  if (outcome === 'repair') return 'Repair';
  if (outcome === 'account_credit' || outcome === 'store_credit') return 'Credit on your account';
  return 'Refund';
}

/** The same thing inside a sentence — "You asked for ___ on 25 August".
 *  Its own function because the article is part of the phrase and only some of
 *  these take one; `outcomeLabel().toLowerCase()` produced "You asked for
 *  refund". */
export function outcomeAsked(outcome: string): string {
  if (outcome === 'exchange') return 'a swap';
  if (outcome === 'repair') return 'a repair';
  if (outcome === 'account_credit' || outcome === 'store_credit') return 'credit on your account';
  return 'a refund';
}
