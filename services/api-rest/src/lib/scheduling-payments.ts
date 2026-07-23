// Booking deposit / card-hold / fee orchestration (docs/79 §9). The side-effecting
// counterpart to @sparx/scheduling's PURE deposit math (deposits.ts): it drives the
// tenant's payment gateway (@sparx/payments) and the booking's depositStatus across
// the lifecycle.
//
//   createBookingDeposit  — at booking time: authorize a card hold (manual capture)
//                           or charge a deposit/prepay (automatic), link it to the
//                           booking, return the clientSecret for the customer to
//                           confirm.
//   settleBookingPayment  — at no-show / cancel / complete: capture a fee from the
//                           hold, void the hold, refund, or forfeit, per policy.
//
// depositStatus state model (the `bookings.deposit_status` column):
//   held      — a card hold is authorized OR a deposit/prepay charge is pending the
//               customer's confirmation.
//   captured  — money taken: a deposit/prepay charge, OR a fee captured from a hold.
//   refunded  — customer not (or no longer) charged: a hold released, or a deposit
//               refunded on a timely cancel.
//   forfeited — a charged deposit/prepay kept on a no-show / late cancel.
//
// Best-effort: a gateway failure logs + leaves depositStatus for manual handling —
// it never blocks the booking lifecycle action that triggered it (a cancel still
// cancels even if the refund call fails).

import type { FastifyBaseLogger } from 'fastify';
import { withTenant } from '@sparx/db';
import { paymentService, PaymentConfigError } from '@sparx/payments';
import {
  computeLateCancelFee,
  computeNoShowFee,
  isLateCancellation,
  resolveDepositPlan,
  type DepositPolicyInput,
  type DepositType,
} from '@sparx/scheduling';

export interface DepositCreationResult {
  /** True when a deposit/hold was created and a clientSecret is returned. */
  required: boolean;
  clientSecret?: string;
  /** The publishable key the widget must load Stripe.js with, when the intent isn't
   *  on sparx's own account (a `stripe_direct` tenant). Absent for sparx Pay. */
  publishableKey?: string;
  amountCents?: number;
  type?: DepositType;
}

interface SettlementData {
  depositStatus: string | null;
  startAt: Date;
  customerId: string | null;
  currency: string;
  priceCents: number;
  policy: DepositPolicyInput | null;
  intentExternalId: string | null;
}

const POLICY_SELECT = {
  depositType: true,
  depositAmountCents: true,
  depositPercent: true,
  cancellationWindowHours: true,
  lateCancelFeeType: true,
  lateCancelFeeValue: true,
  noShowFeeType: true,
  noShowFeeValue: true,
} as const;

/** Load everything the deposit math + gateway calls need for a booking, resolving
 *  the linked gateway intent's external (Stripe) id from our ledger row. */
async function loadSettlementData(
  tenantId: string,
  bookingId: string
): Promise<SettlementData | null> {
  return withTenant({ tenantId }, async (tx) => {
    const booking = await tx.booking.findUnique({
      where: { id: bookingId },
      select: {
        depositStatus: true,
        startAt: true,
        customerId: true,
        paymentIntentId: true,
        service: { select: { priceCents: true, currency: true } },
        policy: { select: POLICY_SELECT },
      },
    });
    if (!booking) return null;
    const intent = booking.paymentIntentId
      ? await tx.paymentIntent.findUnique({
          where: { id: booking.paymentIntentId },
          select: { externalId: true },
        })
      : null;
    return {
      depositStatus: booking.depositStatus,
      startAt: booking.startAt,
      customerId: booking.customerId,
      currency: booking.service.currency,
      priceCents: booking.service.priceCents,
      policy: booking.policy,
      intentExternalId: intent?.externalId ?? null,
    };
  });
}

async function setDepositStatus(
  tenantId: string,
  bookingId: string,
  status: string,
  paymentIntentRowId?: string
): Promise<void> {
  await withTenant({ tenantId }, (tx) =>
    tx.booking.update({
      where: { id: bookingId },
      data: {
        depositStatus: status,
        ...(paymentIntentRowId ? { paymentIntentId: paymentIntentRowId } : {}),
      },
    })
  );
}

/**
 * Create the deposit/hold for a freshly-made booking. Resolves the policy's deposit
 * plan; if there's nothing to collect (no policy, or `none`), returns
 * `{ required: false }`. Otherwise creates the gateway intent (manual capture for a
 * card hold, automatic for a deposit/prepay), links it to the booking, sets
 * depositStatus='held', and returns the clientSecret for the customer to confirm.
 *
 * A misconfigured tenant (deposit policy but no payment gateway) is NOT fatal: it
 * logs and returns `{ required: false }` so the booking still completes.
 */
export async function createBookingDeposit(
  logger: FastifyBaseLogger,
  tenantId: string,
  bookingId: string
): Promise<DepositCreationResult> {
  const data = await loadSettlementData(tenantId, bookingId);
  if (!data?.policy) return { required: false };
  const plan = resolveDepositPlan(data.policy, data.priceCents);
  if (plan.type === 'none') return { required: false };

  try {
    const intent = await paymentService.createPaymentIntent({
      tenantId,
      bookingId,
      amount: plan.amountCents,
      currency: data.currency,
      captureMethod: plan.captureMethod,
      ...(data.customerId ? { customerId: data.customerId } : {}),
      metadata: { booking_id: bookingId, deposit_type: plan.type },
    });
    // Link our ledger row (its uuid) to the booking so settlement can resolve the
    // external id later; the gateway intent id is a `pi_…` string, not a uuid.
    const row = await withTenant({ tenantId }, (tx) =>
      tx.paymentIntent.findFirst({ where: { externalId: intent.id }, select: { id: true } })
    );
    await setDepositStatus(tenantId, bookingId, 'held', row?.id);
    return {
      required: true,
      clientSecret: intent.clientSecret,
      ...(intent.publishableKey ? { publishableKey: intent.publishableKey } : {}),
      amountCents: plan.amountCents,
      type: plan.type,
    };
  } catch (err) {
    if (err instanceof PaymentConfigError) {
      logger.warn(
        { tenantId, bookingId },
        'scheduling-payments: deposit policy set but no payment gateway configured — skipping deposit'
      );
      return { required: false };
    }
    throw err;
  }
}

export type SettlementAction = 'no_show' | 'cancel' | 'complete';

/**
 * Settle a booking's deposit/hold for a lifecycle transition. Re-resolves the plan
 * type from the policy (deterministic) and applies the right gateway op:
 *   card_hold:  no-show/late-cancel → capture the fee (else release); timely
 *               cancel/complete → release the hold.
 *   deposit/prepay: charged money is forfeited on a no-show/late-cancel, refunded
 *               on a timely cancel, and kept on completion (it IS the payment).
 * Idempotent + best-effort: a non-active depositStatus is a no-op, and a gateway
 * error is logged without throwing.
 */
export async function settleBookingPayment(
  logger: FastifyBaseLogger,
  tenantId: string,
  bookingId: string,
  action: SettlementAction,
  now: Date = new Date()
): Promise<void> {
  const data = await loadSettlementData(tenantId, bookingId);
  if (!data?.policy || !data.intentExternalId) return;
  // Only an active hold/charge settles; refunded/forfeited/none are terminal.
  if (data.depositStatus !== 'held' && data.depositStatus !== 'captured') return;

  const plan = resolveDepositPlan(data.policy, data.priceCents);
  const intentId = data.intentExternalId;

  try {
    if (plan.type === 'card_hold') {
      // A hold only settles from the authorized ('held') state.
      if (data.depositStatus !== 'held') return;
      if (action === 'complete') {
        await paymentService.cancelPayment(tenantId, intentId);
        await setDepositStatus(tenantId, bookingId, 'refunded');
        return;
      }
      const late = action === 'cancel' ? isLateCancellation(data.policy, data.startAt, now) : true;
      const fee =
        action === 'no_show'
          ? computeNoShowFee(data.policy, data.priceCents)
          : late
            ? computeLateCancelFee(data.policy, data.priceCents)
            : 0;
      if (fee > 0) {
        await paymentService.capturePayment(tenantId, intentId, Math.min(fee, plan.amountCents));
        await setDepositStatus(tenantId, bookingId, 'captured');
      } else {
        await paymentService.cancelPayment(tenantId, intentId);
        await setDepositStatus(tenantId, bookingId, 'refunded');
      }
      return;
    }

    // deposit / prepay — a real charge (or a pending one).
    if (action === 'complete') return; // the deposit/prepayment IS the payment — keep.
    const keep = action === 'no_show' || isLateCancellation(data.policy, data.startAt, now);
    if (data.depositStatus === 'held') {
      // Charge not yet captured (pre-confirmation) → void it; nothing to keep.
      await paymentService.cancelPayment(tenantId, intentId);
      await setDepositStatus(tenantId, bookingId, 'refunded');
    } else if (keep) {
      await setDepositStatus(tenantId, bookingId, 'forfeited'); // business keeps the charge
    } else {
      await paymentService.refund({ tenantId, chargeId: intentId });
      await setDepositStatus(tenantId, bookingId, 'refunded');
    }
  } catch (err) {
    logger.error(
      { err, tenantId, bookingId, action },
      'scheduling-payments: settlement failed — depositStatus left for manual handling'
    );
  }
}
