// Domain checkout — the tenant-billing seam for buying/renewing a domain.
//
// A domain registration is a HARD pass-through cost: the instant we call GoDaddy
// `purchaseDomain`, ICANN/GoDaddy bills the sparx reseller account for real —
// there is no trial and no reversal. So we MUST charge the tenant for real BEFORE
// we register, and refund if registration then fails. That charge needs a tenant
// card on file (Stripe), which is the billing slice still to land.
//
// Until then these are intentional, DISABLED seams. The purchase/renew routes are
// also gated behind `env.DOMAIN_PURCHASE_ENABLED` (403), so in practice these are
// never reached while checkout is off — but they throw a clean ApiError as a
// defense-in-depth backstop: a real GoDaddy charge can NEVER happen without a real
// tenant charge succeeding first. When Stripe card-on-file lands, implement the
// bodies (create + confirm a PaymentIntent against the tenant's saved payment
// method; refund by id) and flip `DOMAIN_PURCHASE_ENABLED` on.

import { paymentRequired } from '@wizeworks/api-core/errors';

export interface DomainChargeInput {
  tenantId: string;
  /** The full amount to charge, in cents (registration/renewal + our fee). */
  amountCents: number;
  /** Human-readable line, e.g. "Domain registration: acme.com (1yr)". */
  description: string;
}

export interface DomainChargeResult {
  /** The Stripe PaymentIntent id — persisted on the domain_purchases ledger row. */
  paymentIntentId: string;
}

const UNAVAILABLE = 'Domain checkout is not available yet — tenant billing is still being set up.';

/** Charge the tenant for a domain registration/renewal BEFORE we call GoDaddy.
 *  Disabled until Stripe card-on-file lands; throws so the caller aborts before
 *  registering anything. */
// eslint-disable-next-line @typescript-eslint/require-await -- intentional disabled async seam; the body awaits Stripe once card-on-file lands (see header)
export async function chargeForDomain(_input: DomainChargeInput): Promise<DomainChargeResult> {
  // TODO(stripe): create + confirm a PaymentIntent against the tenant's saved
  // payment method for `_input.amountCents`; return its id. Throw on decline so
  // the route aborts before touching GoDaddy.
  throw paymentRequired(UNAVAILABLE);
}

/** Refund a domain charge when GoDaddy registration fails AFTER we charged, so a
 *  tenant is never billed for a domain they didn't get. Best-effort — callers
 *  swallow its rejection. Disabled until Stripe lands. */
// eslint-disable-next-line @typescript-eslint/require-await -- intentional disabled async seam; the body awaits Stripe once card-on-file lands (see header)
export async function refundDomainCharge(_paymentIntentId: string): Promise<void> {
  // TODO(stripe): refund the PaymentIntent by id; log (don't throw) on failure.
  throw paymentRequired(UNAVAILABLE);
}
