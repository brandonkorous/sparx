// What the refund on a return says, worded from where the money actually goes.
//
// Every refund said "This moves real money", so when Brynn returned an injector
// she had paid for at the counter, Doty was told the money went back the way she
// paid. Nothing moved: the payment was recorded by hand, the click only records
// the refund, and Doty still had to hand her $750.00 (sparx persona issue 178).
// `byHand` is the server's own answer (`ReturnDetail.refundsByHand`), the same
// one the refund itself acts on.

import { formatMoney } from './data';

export interface RefundWords {
  /** Under the dialog's title. */
  description: string;
  /** Beside the store-credit checkbox. */
  creditLabel: string;
  /** The button, once there is an amount. */
  submitLabel: string;
  /** The toast once it is done. */
  doneTitle: string;
}

export function refundWords({
  who,
  amount,
  byHand,
  asCredit,
}: {
  who: string;
  /** The whole figure, core deposits included, already formatted. */
  amount: string;
  byHand: boolean;
  asCredit: boolean;
}): RefundWords {
  const creditLabel = byHand
    ? 'Give as store credit instead of handing the money back'
    : 'Give as store credit instead of back the way they paid';
  if (asCredit) {
    return {
      description: `${who} gets this as store credit to spend with you later. This settles the return and cannot be undone.`,
      creditLabel,
      submitLabel: `Give ${amount} as store credit`,
      doneTitle: `${amount} given as store credit`,
    };
  }
  if (byHand) {
    return {
      description: `${who} paid you by hand, so nothing goes back on its own. This records the refund, and you hand the money over yourself. It cannot be undone.`,
      creditLabel,
      submitLabel: `Mark ${amount} as given back`,
      doneTitle: `${amount} marked as given back`,
    };
  }
  return {
    description: `${who} gets this back the way they paid. This moves real money and cannot be undone.`,
    creditLabel,
    submitLabel: `Give back ${amount}`,
    doneTitle: `${amount} given back`,
  };
}

/** The "Give the money back" step on the return, before the dialog opens. */
export function refundStepText(byHand: boolean): string {
  return byHand
    ? 'Settle the return by recording the refund. You hand the money over yourself. This cannot be undone.'
    : 'Settle the return by refunding the customer. This moves real money and cannot be undone.';
}

/** How a settled refund went back, on the finished return. "Back to how they
 *  paid" is true of a gateway refund only; money taken by hand went back by hand. */
export function refundSettledText(
  issuedAs: string,
  byHand: boolean,
  labels: Record<string, string>
): string {
  if (issuedAs === 'original_payment' && byHand) return 'Given back by hand';
  return labels[issuedAs] ?? issuedAs;
}

/** Under the amount on "Give the money back": the figure is what they paid,
 *  sales tax included, so it is not taken for the price and typed back down to
 *  it. Null when no tax was paid (sparx persona issue 231). */
export function paidBackNote(taxCents: number, currency: string): string | null {
  if (taxCents <= 0) return null;
  return `That is what they paid for it, with ${formatMoney(taxCents / 100, currency)} of sales tax.`;
}
