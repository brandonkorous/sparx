// The gateway half of deciding a held wholesale order (sparx persona issue 087).
//
// `heldOrderMoney` in @wizeworks/crm works out, inside the decision's own
// transaction, what each card payment on the order needs: charge a held card
// when the order is approved, let it go when it is turned down, refund a card
// that was already charged. This does it, AFTER that transaction has committed,
// the way the approval routes publish their events: a refused capture can never
// roll back an approval that already happened.
//
// Nothing here is allowed to fail quietly. A buyer whose card is not charged
// still has a placed order to pay for, and a buyer whose refund did not go
// through is still out the money, so every failure is written on the order and
// handed to the business as a task that says what happened and what to do.
// Nothing here throws either: the decision has been made and said, and the
// caller is told what did and did not go through.

import { heldOrderMoney, orderRefundsService, taskService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { GatewayNotFoundError, PaymentConfigError, paymentService } from '@wizeworks/payments';

import { formatCents } from './money';

export type HeldOrderMoney = heldOrderMoney.HeldOrderMoney;

export interface SettledMoney {
  move: HeldOrderMoney;
  /** The gateway did what was asked and it is recorded. */
  ok: boolean;
  /** Why it did not, in the gateway's words, when it did not. */
  error?: string;
}

interface SettleContext {
  tenantId: string;
  /** The person on the business's team who decided, when it was one of them.
   *  A task about money that did not move goes to them; to the owner otherwise. */
  userId?: string | null;
}

/** The reason a refund carries on the order. A business owner reads it. */
export const TURNED_DOWN_REFUND_REASON = 'The order was turned down before it was placed.';

/** Do the gateway work a decided held order needs, one card payment at a time. */
export async function settle(
  ctx: SettleContext,
  moves: readonly HeldOrderMoney[]
): Promise<SettledMoney[]> {
  const settled: SettledMoney[] = [];
  for (const move of moves) {
    try {
      settled.push(await settleOne(ctx, move));
    } catch (err) {
      settled.push({
        move,
        ok: false,
        error: err instanceof Error ? err.message : 'the payment could not be settled',
      });
    }
  }
  return settled;
}

async function settleOne(ctx: SettleContext, move: HeldOrderMoney): Promise<SettledMoney> {
  if (move.action === 'capture') return capture(ctx, move);
  if (move.action === 'release') return release(ctx, move);
  return refund(ctx, move);
}

/** The gateway's answer, with "no gateway set up" as an answer rather than a
 *  crash: the order still has to be told what happened. */
async function ask<T extends { success: boolean; errorMessage?: string }>(
  call: () => Promise<T>
): Promise<T | { success: false; errorMessage: string }> {
  try {
    return await call();
  } catch (err) {
    if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
      return { success: false, errorMessage: 'no card payments are set up any more' };
    }
    throw err;
  }
}

// ── Approved: charge the held card ───────────────────────────────────────────

async function capture(ctx: SettleContext, move: HeldOrderMoney): Promise<SettledMoney> {
  const result = await ask(() =>
    paymentService.capturePayment(ctx.tenantId, move.paymentRef, move.amountCents)
  );
  // A charge that went through is recorded by the payment webhook, the same as
  // any card payment, which also marks the order paid and sends the receipt.
  // `capturePayment` has marked our own ledger, so the payment sweep finishes
  // the job if the webhook never comes.
  if (result.success) return { move, ok: true };

  // The hold ran out (a card can be held for about seven days) or the bank said
  // no. The order has gone ahead, so it is placed and unpaid: say so on it, and
  // give the business the job of asking for the money.
  const reason = result.errorMessage ?? 'the card was refused';
  const money = formatCents(move.amountCents, move.currency);
  await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const payment = await tx.orderPayment.findUnique({
      where: { id: move.paymentId },
      select: { metadata: true },
    });
    await tx.orderPayment.update({
      where: { id: move.paymentId },
      data: {
        status: 'failed',
        failureReason: reason.slice(0, 500),
        metadata: {
          ...objectOf(payment?.metadata),
          [heldOrderMoney.CAPTURE_FAILED_KEY]: true,
        },
      },
    });
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: move.customerId,
        actorId: null,
        actorType: 'system',
        type: 'note',
        description: `Order #${move.orderNumber} was approved, but the ${money} held on the card could not be charged: ${reason}. The order has gone ahead and is not paid.`,
        occurredAt: new Date(),
      },
    });
  });
  await tellTheBusiness(ctx, move, {
    title: `Order ${move.orderNumber} is approved but not paid: ask for the ${money}`,
    description:
      `The card was held when this order was placed, to be charged once it was approved. ` +
      `When it was approved, the charge did not go through: ${reason}. ` +
      `A hold on a card only lasts about seven days, so an order approved later than that ` +
      `cannot be charged from it. The order has gone ahead and nothing has been paid. ` +
      `Open the order and use Make an invoice under Asking for payment, then send it to ` +
      `the buyer so they can pay.`,
  });
  return { move, ok: false, error: reason };
}

// ── Turned down: let the held card go ────────────────────────────────────────

async function release(ctx: SettleContext, move: HeldOrderMoney): Promise<SettledMoney> {
  const result = await ask(() => paymentService.cancelPayment(ctx.tenantId, move.paymentRef));
  if (result.success) {
    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.orderPayment.update({
        where: { id: move.paymentId },
        data: { status: 'voided', voidedAt: new Date() },
      })
    );
    return { move, ok: true };
  }
  // Nothing was ever charged, and a hold nobody captures drops off the card by
  // itself within about seven days. So the buyer is not out any money, but the
  // amount may sit on their card until then, and the business should know why
  // if they ask.
  const reason = result.errorMessage ?? 'the gateway did not say why';
  await withTenant({ tenantId: ctx.tenantId }, (tx) =>
    tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: move.customerId,
        actorId: null,
        actorType: 'system',
        type: 'note',
        description: `Order #${move.orderNumber} was turned down. Nothing was charged, but the ${formatCents(move.amountCents, move.currency)} hold on the card could not be lifted straight away (${reason}). It drops off the card by itself within about seven days.`,
        occurredAt: new Date(),
      },
    })
  );
  return { move, ok: false, error: reason };
}

// ── Turned down, already charged: refund it in full ─────────────────────────

async function refund(ctx: SettleContext, move: HeldOrderMoney): Promise<SettledMoney> {
  const result = await ask(() =>
    paymentService.refund({
      tenantId: ctx.tenantId,
      chargeId: move.paymentRef,
      amount: move.amountCents,
      reason: 'requested_by_customer',
      metadata: { sparx_reason: TURNED_DOWN_REFUND_REASON },
    })
  );
  if (result.success) {
    // Recorded the way every refund is, against the payment it reverses and
    // stamped with the gateway's own refund id, so the order's refund rows and
    // totals are true and the refund webhook finds this row rather than adding
    // a second one.
    await orderRefundsService.recordRefund(
      { tenantId: ctx.tenantId, ...(ctx.userId ? { userId: ctx.userId } : {}) },
      {
        orderId: move.orderId,
        paymentId: move.paymentId,
        amount: move.amountCents / 100,
        currency: move.currency,
        reason: TURNED_DOWN_REFUND_REASON,
        ...('refundId' in result && result.refundId ? { processorRef: result.refundId } : {}),
      }
    );
    return { move, ok: true };
  }

  const reason = result.errorMessage ?? 'the gateway did not say why';
  const money = formatCents(move.amountCents, move.currency);
  await tellTheBusiness(ctx, move, {
    title: `Order ${move.orderNumber} was turned down: refund the ${money} by hand`,
    description:
      `This order was paid by card and then turned down, so the ${money} has to go back ` +
      `to the buyer. The refund did not go through: ${reason}. Nothing has been given ` +
      `back yet. Open the order and refund it, or refund it from your payment ` +
      `provider's own dashboard and record it on the order.`,
  });
  return { move, ok: false, error: reason };
}

// ── Telling the business ─────────────────────────────────────────────────────

/** A task, due today, for whoever decided on the business's side, or the
 *  owner when the account's own approver did. */
async function tellTheBusiness(
  ctx: SettleContext,
  move: HeldOrderMoney,
  task: { title: string; description: string }
): Promise<void> {
  const assignee =
    ctx.userId ??
    (await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
      const owner = await tx.user.findFirst({
        where: { role: 'owner' },
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      if (owner) return owner.id;
      const anyone = await tx.user.findFirst({
        orderBy: { createdAt: 'asc' },
        select: { id: true },
      });
      return anyone?.id ?? null;
    }));
  if (!assignee) {
    throw new Error(
      `Order ${move.orderNumber}: ${task.title}. There is nobody on the team to give this to.`
    );
  }
  const dueAt = await taskService.dueAtIn({ tenantId: ctx.tenantId }, 0);
  await taskService.create(
    { tenantId: ctx.tenantId, userId: assignee },
    {
      title: task.title,
      description: task.description,
      dueAt: dueAt.toISOString(),
      priority: 'high',
      assignedToUserId: assignee,
      customerId: move.customerId,
    }
  );
}

function objectOf(value: unknown): Record<string, unknown> {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};
}
