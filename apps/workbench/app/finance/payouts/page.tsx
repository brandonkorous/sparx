import { redirectToSurface } from '../../../lib/surface-redirect';

// Legacy deep link from marketplace settlement-report emails
// (packages/commerce market payout): /finance/payouts. The workbench lists
// payouts via the `finance.payouts.list` surface, so translate to that `?open=`
// deep link.
export const dynamic = 'force-dynamic';

export default async function PayoutsRedirect() {
  await redirectToSurface('finance.payouts.list');
}
