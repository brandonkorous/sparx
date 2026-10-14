// Whether an order billed to a trade account would run past its credit, said on
// the payment step BEFORE Place order.
//
// Placing the order already held it for the owner's sign-off when it went over
// (`accountOrderGate.termsDecision`), but the payment step never knew: Renée put
// $2,026.38 on an account with $1,676.08 of credit left, was told only that her
// colleague had to approve it, and learned of a second approval after the click,
// with no reason given (sparx persona issue 187). This asks the same question
// the order asks, with the same function, so the two cannot disagree.

import { accountOrderGate } from '@wizeworks/crm';

export interface CreditPreview {
  creditLeftCents: number;
  orderTotalCents: number;
  currency: string;
}

/**
 * The credit an order would run past if it were billed to the account now, or
 * null when it fits, when the account is not on terms, or when the account is
 * stopped (that is refused at placement with its own message, not held).
 */
export function creditPreviewOf(
  account: accountOrderGate.AccountStanding & { paymentTerms: string | null },
  orderTotalCents: number,
  currency: string
): CreditPreview | null {
  const terms = account.paymentTerms?.trim().toLowerCase() ?? '';
  if (terms === '' || terms === 'prepay') return null;
  const decision = accountOrderGate.termsDecision(account, orderTotalCents, currency);
  if (decision.kind !== 'hold' || decision.reason.kind !== 'over_credit_limit') return null;
  return {
    creditLeftCents: Math.round(decision.reason.creditLeft * 100),
    orderTotalCents,
    currency,
  };
}
