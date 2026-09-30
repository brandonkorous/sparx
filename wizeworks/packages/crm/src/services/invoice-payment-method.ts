// How money that came in on an ORDER is described on the INVOICE raised from it.
//
// WHAT A BUSINESS OWNER SAW. A wholesale order taken at the counter, $30 in
// cash against $52. The order says so:
//
//     $30.00 · Cash        Sep 20, 2026, 1:51 AM        Taken
//
// The invoice raised from that order, one click later:
//
//     When            Kind        How
//     Sep 20, 2026    Deposit     Other
//
// "Other" is the bucket for money nobody could name. This money had a name on
// the row it was copied from, and the copy hardcoded `method: 'other'` because
// the order's payment rows were never fetched. The screen that matches an
// invoice against the till is the one that now cannot.
// [[feedback_fetched_but_never_rendered]]
//
// TWO VOCABULARIES. They are genuinely different columns with different
// histories, so this is a translation and not a rename:
//
//   OrderPayment.processor      stripe paypal manual check wire net_terms
//                               card gift_card sparx_pay square
//   BillingDocumentPayment.method   cash card check ach wire account_credit other
//
// `manual` is what the till writes when the shopkeeper picks Cash — a check and
// a transfer have their own values, so nothing else lands there (issue 044).
// Every gateway is a card as far as an invoice is concerned: what an invoice's
// How column answers is "what did the customer hand over", not "which company
// processed it".

/** One order processor → one invoice method. Anything absent means nobody can
 *  name it, which is what `other` is for. */
const AS_INVOICE_METHOD: Record<string, string> = {
  // The till's Cash.
  manual: 'cash',
  cash: 'cash',
  check: 'check',
  wire: 'wire',
  ach: 'ach',
  // A card is a card. Which gateway took it is the order's business, not the
  // invoice's.
  card: 'card',
  credit_card: 'card',
  stripe: 'card',
  paypal: 'card',
  sparx_pay: 'card',
  square: 'card',
  // Money the shop was already paid, now being spent. The invoice's own word
  // for it is account_credit.
  gift_card: 'account_credit',
  account_credit: 'account_credit',
  // Buying on terms is not a way money arrived — it is the absence of one. It
  // stays `other` deliberately rather than being invented into a method.
  net_terms: 'other',
};

/**
 * The one method to write on the invoice for a set of order payments.
 *
 * Money already in is copied across as a SINGLE row, so one method has to cover
 * the lot. When every payment moved the same way that is simply that way; when
 * they did not, no single word is true and the honest answer is `other`.
 * Picking the largest, or the first, would print a fact about part of the money
 * as a fact about all of it. [[feedback_never_present_absence_as_measurement]]
 */
export function invoicePaymentMethod(processors: readonly string[]): string {
  const methods = new Set(processors.map((p) => AS_INVOICE_METHOD[p] ?? 'other'));
  if (methods.size !== 1) return 'other';
  const [only] = [...methods];
  return only ?? 'other';
}

/**
 * The sentence kept on the copied payment row.
 *
 * It names the order either way, and says so out loud when the money arrived in
 * more than one way — because that is the case where the How column beside it
 * has to read `Other` and would otherwise look like a value nobody bothered to
 * fill in.
 */
export function invoicePaymentNote(orderNumber: string, processors: readonly string[]): string {
  const methods = new Set(processors.map((p) => AS_INVOICE_METHOD[p] ?? 'other'));
  if (methods.size > 1) {
    return `Already received against order ${orderNumber}, in more than one way.`;
  }
  return `Already received against order ${orderNumber}.`;
}
