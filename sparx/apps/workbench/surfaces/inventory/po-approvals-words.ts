// What a spending limit makes a screen say.
//
// ── The defects these exist for ──────────────────────────────────────────
//
// 1. PRESSING "PLACE ORDER" DID NOT PLACE THE ORDER. Over a limit, the confirm
//    read "This sends the order and locks it. You will not be able to change the
//    items or quantities afterwards" and the toast read "PO-000004 placed". What
//    actually happened: nothing was sent, the supplier never saw it, the order
//    went to Waiting for sign-off, and the pane one line below the toast said so
//    in two places. The dialog is where the decision is made, so the fact goes
//    there. [[feedback_a_promise_in_copy_is_a_contract]]
//
// 2. "ANYBODY WHO CAN APPROVE SPENDING CAN SIGN IT OFF" over a rule that said
//    The owner. The order's pane read `requiredApproverName` (null, because the
//    console cannot yet name one person) and fell straight through to the
//    loosest possible sentence, skipping the role the rule DOES carry — and
//    `approverLabel`, which was written to answer exactly this and called only
//    on the rules list. [[feedback_fetched_but_never_rendered]]
//
// 3. AN ORDER SENT BACK LOOKED LIKE AN ORDINARY DRAFT. The approver has to type
//    a reason (the server refuses "no" without one) under a label promising "the
//    buyer sees it, and it stays on the order's history". The buyer opened it to
//    "Not sent yet. You can still change anything on it." and nothing else — so
//    the obvious move is to place the identical order again and be refused
//    again. MEASURED 2026-09-18 on Juniper Row: PO-000004 sent back with a
//    reason, reason nowhere on the order.
//
// 4. "ORDERS OVER $200" HOLDS AN ORDER OF EXACTLY $200. The resolver is `>=`,
//    and has to be — "leave it at 0 to hold every order" is only true of `>=`.
//    So the number is a floor and the word is "or more", not "over".

import { plural } from './data';
import { approverLabel, type PoApproval } from './po-approvals-data';

/** A threshold, in the words that match what the resolver actually does. */
export function thresholdWords(cents: number, formatMoney: (cents: number) => string): string {
  if (cents <= 0) return 'every order';
  return `${formatMoney(cents)} or more`;
}

/* ── Who has to sign ────────────────────────────────────────────────────── */

/**
 * Who this request is waiting on, as a sentence.
 *
 * A named person wins, then the rule's role, and only with neither does it fall
 * through to "anybody who can approve spending" — which is now a true statement
 * about a rule that named nobody, rather than the answer to every case.
 */
export function whoSignsLine(approval: {
  requiredApproverName: string | null;
  requiredRole: string | null;
  ruleName?: string | null;
}): string {
  const held = approval.ruleName ? ` Held by “${approval.ruleName}”.` : '';
  if (approval.requiredApproverName === null && approval.requiredRole === null) {
    return `Anybody who can approve spending can sign it off.${held}`;
  }
  return `${approverLabel(approval)} has to sign it off.${held}`;
}

/* ── Placing an order a limit will catch ────────────────────────────────── */

export interface HeldWarning {
  /** The dialog's own sentence, in place of "this sends the order". */
  description: string;
  confirmLabel: string;
  toastTitle: string;
  toastDescription: string;
}

/**
 * What pressing the button will REALLY do.
 *
 * `rule` is whatever `resolveApprovalRule` picked for this order, or null when
 * nothing holds it. Null gives back the ordinary words: an order under every
 * limit is placed, and saying "this might need signing off" over it would be the
 * opposite mistake.
 */
export function placingWords(
  order: { number: string; supplierName: string | null },
  rule: { name: string; minAmountCents: number } | null,
  formatMoney: (cents: number) => string
): HeldWarning {
  if (!rule) {
    return {
      // Whether it goes to the supplier is the dialog's own choice, below this
      // sentence (purchase-order-email.tsx), so this says only what placing does.
      description:
        'This places the order and locks it. You will not be able to change the items or ' +
        'quantities afterwards. As the goods arrive you book them in under Receiving.',
      confirmLabel: 'Place the order',
      toastTitle: `${order.number} placed`,
      toastDescription: `Nothing went to ${order.supplierName ?? 'the supplier'}. Print it, or use "Email to the supplier".`,
    };
  }
  return {
    description:
      `This order is over your “${rule.name}” limit, which holds anything of ` +
      `${thresholdWords(rule.minAmountCents, formatMoney)}. It will NOT go to ` +
      `${order.supplierName ?? 'the supplier'} yet: it waits under Sign-offs until somebody ` +
      'approves it, and nothing can be received against it until they do. It stays editable ' +
      'while it waits.',
    confirmLabel: 'Send it for sign-off',
    toastTitle: `${order.number} is waiting for sign-off`,
    toastDescription: `Nothing has been ordered. ${order.supplierName ?? 'The supplier'} has not seen it. Find it under Sign-offs.`,
  };
}

/* ── The buyer's side of a refusal ──────────────────────────────────────── */

export interface SentBackNote {
  title: string;
  reason: string;
  detail: string;
}

/**
 * What the BUYER is shown when their order was turned down, from the order's own
 * trail. Null when the newest decision was not a refusal — an approved order
 * needs no notice, and neither does one nobody has ever asked about.
 *
 * Only for a DRAFT: once it has been resubmitted the pane is telling a different
 * story, and a stale refusal alongside "waiting for sign-off" reads as the new
 * request having already been refused.
 */
export function sentBackNote(
  trail: PoApproval[] | undefined,
  orderStatus: string
): SentBackNote | null {
  if (orderStatus !== 'draft') return null;
  const decided = (trail ?? []).filter((row) => row.status !== 'pending');
  if (decided.length === 0) return null;

  // The trail comes back oldest first, so the last decided one is the newest.
  const newest = decided[decided.length - 1];
  if (newest?.status !== 'rejected') return null;

  const by = newest.decidedByName ?? 'Somebody';
  const again = decided.filter((row) => row.status === 'rejected').length;
  const detail =
    again > 1
      ? `${by} turned it down. It has been sent back ${plural(again, 'time', 'times')}. Change what they asked for and place it again.`
      : `${by} turned it down. Change what they asked for and place it again: it goes back to them, not to the supplier.`;

  return {
    title: 'This was sent back to you',
    reason: newest.note ?? 'No reason was recorded.',
    detail,
  };
}
