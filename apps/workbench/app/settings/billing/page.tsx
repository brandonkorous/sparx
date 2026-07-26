import { redirectToSurface } from '../../../lib/surface-redirect';

// Deep link from the sparx-billing emails (billing-receipt / billing-payment-failed /
// billing-trial-ending, published by the stripe-billing webhook): /settings/billing.
// The workbench shows the tenant's own sparx bill via the `finance.subscription`
// surface ("Your sparx bill"), so translate to that `?open=` deep link — the same
// readable-path convention as /settings/domains and /finance/payouts.
export const dynamic = 'force-dynamic';

export default async function BillingRedirect() {
  await redirectToSurface('finance.subscription');
}
