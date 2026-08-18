// The platform fee rule (docs/94 ADR §8). ONE rule, no tiers, no plan-based fees
// ("we don't have tiers, we have modules"):
//   sparx Pay  → flat 0.5%, collected in-flow via Stripe application_fee_amount
//   everything else (stripe_direct, paypal, manual) → $0 — sparx isn't in the flow.

export const SPARX_PAY_FEE_RATE = 0.005;

/** The sparx Pay platform fee for an amount, in cents. */
export function sparxPayFeeCents(amountCents: number): number {
  return Math.round(amountCents * SPARX_PAY_FEE_RATE);
}
