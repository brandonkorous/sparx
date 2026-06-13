// Transaction-fee metering bridge (docs/67 §7).
//
// The platform charges a per-transaction fee on placed orders, tiered by the
// tenant's active-module mix (0.5% Commerce / 0.3% with CRM / 0% once monthly
// spend clears $299). The fee math + the Stripe meter-event call live in
// @sparx/billing; this thin helper resolves the order's grand total (which the
// `order.placed` payload doesn't carry) and hands it over. Call it AFTER an order
// is freshly placed — at the two `order.placed` emit sites (storefront checkout
// completion and the B2B approval queue).
//
// Best-effort by contract: GUARDED on isBillingConfigured() (a clean no-op until
// the prod billing ops land) and wrapped so a metering hiccup never fails the
// request that placed the order — the order is already durable, and Stripe is the
// authoritative ledger for the fee.

import { isBillingConfigured, recordTransactionFee } from '@sparx/billing';
import { withTenant } from '@sparx/db';
import type { FastifyBaseLogger } from 'fastify';

export interface MeterOrderFeeInput {
  tenantId: string;
  orderId: string;
  log: FastifyBaseLogger;
}

/** Meter the transaction fee for a just-placed order. No-op when billing is
 *  unconfigured or the order can't be found. Never throws. */
export async function meterOrderFee(input: MeterOrderFeeInput): Promise<void> {
  if (!isBillingConfigured()) return;
  const { tenantId, orderId, log } = input;
  try {
    const order = await withTenant({ tenantId }, (tx) =>
      tx.order.findFirst({ where: { id: orderId }, select: { total: true } })
    );
    if (!order) return;

    // Order.total is a Decimal in dollars; the fee math works in cents.
    const orderTotalCents = Math.round(Number(order.total) * 100);
    const result = await recordTransactionFee({ tenantId, orderTotalCents, identifier: orderId });

    if (result.metered) {
      log.info(
        { tenantId, orderId, feeRate: result.feeRate, feeCents: result.feeCents },
        'billing: transaction fee metered'
      );
    }
  } catch (err) {
    log.error({ err, tenantId, orderId }, 'billing: transaction fee metering failed (non-fatal)');
  }
}
