// Booking deposits and card holds (docs/79 §9). The side-effecting counterpart to
// @wizeworks/scheduling's PURE deposit math (deposits.ts).
//
//   createBookingDeposit  at booking time: authorize a card hold (manual capture)
//                         or charge a deposit/prepay (automatic), link it to the
//                         booking, return the clientSecret for the customer to
//                         confirm.
//   settleBookingMoney    when a booking ends: hand what its card needs to
//                         `bookingPayments.settle` in @wizeworks/commerce.
//
// Settling used to live here, so only the console's own routes ever did it: a
// booking an AI assistant ended, and every booking in a canceled series, kept
// its hold and its deposit (sparx persona issue 087). The decision now comes back
// from the lifecycle function that ended the booking (`money` on its result),
// and the gateway work is in commerce, where api-mcp can reach it too.

import type { FastifyBaseLogger } from 'fastify';
import { withTenant } from '@wizeworks/db';
import { bookingPayments } from '@wizeworks/commerce';
import { paymentService, PaymentConfigError, GatewayNotFoundError } from '@wizeworks/payments';
import {
  resolveDepositPlan,
  type BookingMoney,
  type DepositPolicyInput,
  type DepositType,
} from '@wizeworks/scheduling';

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
  timezone: string;
  customerId: string | null;
  serviceName: string;
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
        timezone: true,
        customerId: true,
        paymentIntentId: true,
        service: { select: { name: true, priceCents: true, currency: true } },
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
      timezone: booking.timezone,
      customerId: booking.customerId,
      serviceName: booking.service.name,
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
    // NO WAY TO CHARGE is not an error, it is an answer — and there are two shapes
    // of it. No config row at all, and a config row naming `manual`, which is the
    // catalog's word for "record payments by hand" and deliberately has no adapter
    // to register. Provisioning writes `manual` for every new tenant, so treating
    // it as a broken gateway meant every deposit-bearing booking on a brand-new
    // salon threw (issue 105).
    if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
      logger.warn(
        { tenantId, bookingId },
        'scheduling-payments: deposit policy set but this business takes no online payments, skipping deposit'
      );
      return { required: false };
    }
    throw err;
  }
}

/**
 * Settle the card on bookings that have just ended, AFTER the transaction that
 * ended them has committed. Never throws: the booking has ended either way. What
 * did not go through is already on the customer's timeline, on the booking's
 * history, and (where somebody has to act) in the business's tasks; it is logged
 * here too.
 */
export async function settleBookingMoney(
  logger: FastifyBaseLogger,
  ctx: { tenantId: string; userId?: string | null },
  money: readonly (BookingMoney | null)[]
): Promise<bookingPayments.SettledBookingMoney[]> {
  const moves = money.filter((m): m is BookingMoney => m !== null);
  if (moves.length === 0) return [];
  const settled = await bookingPayments.settle(ctx, moves);
  for (const { money: move, ok, error } of settled) {
    if (!ok) {
      logger.error(
        { tenantId: ctx.tenantId, bookingId: move.bookingId, move: move.move, error },
        'scheduling-payments: the card could not be settled (told on the booking, task given where needed)'
      );
    }
  }
  return settled;
}
