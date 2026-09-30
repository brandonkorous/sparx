// Taking a payment off an order when the money never came in.
//
// ── THE GAP THIS CLOSES ─────────────────────────────────────────────────────
//
// `POST /v1/orders/:id/payments/:paymentId/void` has always existed. It is
// complete on the server: idempotent, it recomputes the order's `amountPaid` and
// the buyer's lifetime total in the same call, and it writes an audit entry.
// Nothing in either console called it, and the payments card offered no action
// on a row at all (issue 875).
//
// That is not a missing nicety on a screen where the ONLY way money gets
// recorded by hand is somebody typing it. `useRecordOrderPayment` exists exactly
// so a shop that takes cash over a counter can mark an order paid. A counter is
// also where the mistake happens: two customers, one screen, the money written
// against the wrong order. With no way to take it back, her two choices were to
// leave an unpaid order reading as paid, or to record a REFUND she never gave —
// which puts a refund she did not make into the refund figures, the buyer's
// lifetime total and the takings report. The only offered remedy made the books
// less true, not more.
//
// ── WHY ONLY MONEY SHE TOOK HERSELF ─────────────────────────────────────────
//
// Taking a row off here changes what sparx believes. It does NOT tell a gateway
// anything. On a card charge through Stripe or PayPal the money is really sitting
// with the gateway, so marking it off would make her books say unpaid while the
// gateway holds the cash — a new wrong answer in place of the old one. Those rows
// get no action, and the gateway's own refund path stays the only truthful move.
//
// `paidByHand` is the existing test for "nothing charged it, so nothing can
// reverse it", already used to pick the refund wording. It is passed in rather
// than imported, because it lives under a different name in each console and this
// file is byte-identical in both.
//
// [[feedback_screen_over_a_function_nobody_calls]]
// [[feedback_a_fix_leaves_its_neighbour_behind]]

export interface TakeOffFacts {
  /** The payment's own state, as the API spells it. */
  readonly status: string;
  /** `paidByHand(payment.processor)` — nobody charged it, so nothing reverses it. */
  readonly byHand: boolean;
}

/** States where the order is still counting on this money, so there is something
 *  to take off. `failed` is excluded on purpose: nothing was ever counted, so
 *  taking it off would change no figure and the row already says what happened. */
const COUNTED = new Set(['captured', 'authorized', 'pending']);

/**
 * Whether this row can be taken off the order.
 *
 * Both halves are required. Status alone would offer the action on a live card
 * charge, whose money is with the gateway. `byHand` alone would offer it on a
 * cash row already taken off, or already given back properly as a refund.
 */
export function canTakeOff(payment: TakeOffFacts): boolean {
  if (!payment.byHand) return false;
  return COUNTED.has(payment.status);
}

export interface TakeOffWords {
  /** The title of the last dialog she reads before it happens. */
  readonly title: string;
  /** The body of that dialog. Says what moves, what does not, and what to use
   *  instead when the money really did come in. */
  readonly confirm: string;
  /** The receipt afterwards. */
  readonly done: string;
}

export interface TakeOffSaid {
  /** Already formatted in her currency. */
  readonly amount: string;
  readonly orderNumber: string;
}

/**
 * One wrong press here and one wrong press on Refund look identical from the
 * outside and cost completely different things, so this dialog names the other
 * remedy and when to reach for it. [[feedback_one_outcome_two_causes]]
 *
 * It predicts no new balance. The amount still owed is worked out from the
 * order's total, its refunds, gift cards and account credit, and a figure
 * guessed here would be a second opinion about her money.
 */
export function takeOffWords({ amount, orderNumber }: TakeOffSaid): TakeOffWords {
  return {
    title: `Take ${amount} off order ${orderNumber}?`,
    confirm:
      `Use this when a payment was written down by mistake. No money moves: ${amount} ` +
      'was never put through a card machine and was never taken online, so there is ' +
      'nothing to send back. The order counts it as unpaid again, and the line stays ' +
      'on it marked Canceled so you can see what happened. If the money really did ' +
      'come in and you are sending it back, close this and use Refund instead.',
    done: `Order ${orderNumber} counts ${amount} as unpaid again. No money was sent anywhere.`,
  };
}

/** What goes on the record as the reason, so the row says why it is off. */
export const TAKE_OFF_REASON = 'Written down by mistake';
