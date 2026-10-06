// The gateway half of ending a booking (docs/79 §9, sparx persona issue 087).
//
// `bookingMoneyFor` in @wizeworks/scheduling works out, inside the transaction
// that ends a booking, what the card on it needs: charge a fee from the hold,
// let the hold go, call off a deposit that was never paid, refund one that was,
// or keep it. This does it, AFTER that transaction has committed: a refused
// charge can never roll back a cancellation that already happened. It is here
// rather than in api-rest because every transport that ends a booking has to
// call it (the console's routes, the customer's own cancel link, an AI
// assistant's tools, a canceled series), and api-mcp can reach this package
// but not api-rest. Scheduling cannot carry it: it has no payment gateway.
//
// The deposit moves only when the gateway did what was asked. The gateway
// answers a refused capture, release or refund with `{ success: false }` rather
// than throwing, and the old api-rest version ignored the answer and wrote
// `captured` or `refunded` anyway, so a fee the card refused read as money
// taken and a refund that never left read as money returned. Now the deposit
// keeps the state the money is really in, the business is told on the
// customer's timeline (with a task when somebody has to act), and every outcome
// is written on the booking's own history so the console can say what happened
// rather than guess it from the deposit status. Nothing here throws: the
// booking has ended, and the caller is told what did and did not go through.
//
// depositStatus state model (the `bookings.deposit_status` column):
//   held      a card hold is authorized, OR a deposit/prepay charge is waiting
//             for the customer to pay it.
//   captured  money taken: a deposit/prepay charge, OR a fee captured from a hold.
//   refunded  the customer is not (or no longer) charged: a hold let go, a
//             deposit request called off, or a deposit refunded.
//   forfeited a charged deposit/prepay kept on a no-show or a late cancellation.

import { taskService } from '@wizeworks/crm';
import { withTenant } from '@wizeworks/db';
import { GatewayNotFoundError, PaymentConfigError, paymentService } from '@wizeworks/payments';

import { formatCents } from './money';

/**
 * One booking's money, decided. The same shape as `BookingMoney` in
 * @wizeworks/scheduling, which this package cannot import: every caller passes
 * scheduling's value straight in, so the compiler holds the two together.
 */
export interface BookingMoney {
  bookingId: string;
  ending: 'no_show' | 'cancel' | 'complete';
  move: 'capture_fee' | 'release_hold' | 'call_off' | 'refund_deposit' | 'keep_deposit';
  amountCents: number;
  paymentRef: string;
  currency: string;
  customerId: string | null;
  serviceName: string;
  startAt: Date;
  timezone: string;
}

export interface SettledBookingMoney {
  money: BookingMoney;
  /** The gateway did what was asked and it is recorded. */
  ok: boolean;
  /** Why it did not, in the gateway's words, when it did not. */
  error?: string;
}

interface SettleContext {
  tenantId: string;
  /** The person on the business's team who ended the booking, when one did. A
   *  task about money that did not move goes to them; to the owner otherwise. */
  userId?: string | null;
}

/** The booking-history actions the outcome is written under. Read back by
 *  `latestBookingPayment` in @wizeworks/scheduling; a test in api-rest holds the
 *  two copies of each name together. */
export const BOOKING_PAYMENT_SETTLED = 'booking.payment_settled';
export const BOOKING_PAYMENT_NOT_SETTLED = 'booking.payment_not_settled';

/** Settle each booking's card, one at a time. */
export async function settle(
  ctx: SettleContext,
  moves: readonly BookingMoney[]
): Promise<SettledBookingMoney[]> {
  const settled: SettledBookingMoney[] = [];
  for (const money of moves) {
    try {
      settled.push(await settleOne(ctx, money));
    } catch (err) {
      // Our own write failed, not the gateway. A charge that went through is
      // still recorded by the payment webhook (`held` to `captured`).
      settled.push({
        money,
        ok: false,
        error: err instanceof Error ? err.message : 'the booking payment could not be settled',
      });
    }
  }
  return settled;
}

async function settleOne(ctx: SettleContext, money: BookingMoney): Promise<SettledBookingMoney> {
  switch (money.move) {
    case 'capture_fee': {
      const answer = await ask(() =>
        paymentService.capturePayment(ctx.tenantId, money.paymentRef, money.amountCents)
      );
      return answer.ok
        ? done(ctx, money, 'held', 'captured')
        : notDone(ctx, money, 'fee_not_charged', answer.reason);
    }
    case 'release_hold': {
      const answer = await ask(() => paymentService.cancelPayment(ctx.tenantId, money.paymentRef));
      return answer.ok
        ? done(ctx, money, 'held', 'refunded')
        : notDone(ctx, money, 'hold_not_lifted', answer.reason);
    }
    case 'call_off': {
      const answer = await ask(() => paymentService.cancelPayment(ctx.tenantId, money.paymentRef));
      return answer.ok
        ? done(ctx, money, 'held', 'refunded')
        : notDone(ctx, money, 'request_not_called_off', answer.reason);
    }
    case 'refund_deposit': {
      const answer = await ask(() =>
        paymentService.refund({ tenantId: ctx.tenantId, chargeId: money.paymentRef })
      );
      return answer.ok
        ? done(ctx, money, 'captured', 'refunded')
        : notDone(ctx, money, 'deposit_not_refunded', answer.reason);
    }
    case 'keep_deposit':
      // Nothing to ask the gateway: the business keeps a charge it already has.
      return done(ctx, money, 'captured', 'forfeited');
  }
}

/** The gateway's answer, with a throw (no gateway set up, the provider could
 *  not be reached) as an answer too: the booking still has to be told. */
async function ask(
  call: () => Promise<{ success: boolean; errorMessage?: string }>
): Promise<{ ok: true } | { ok: false; reason: string }> {
  try {
    const result = await call();
    if (result.success) return { ok: true };
    return { ok: false, reason: result.errorMessage ?? 'the payment provider did not say why' };
  } catch (err) {
    if (err instanceof PaymentConfigError || err instanceof GatewayNotFoundError) {
      return { ok: false, reason: 'no card payments are set up any more' };
    }
    return {
      ok: false,
      reason: err instanceof Error ? err.message : 'the payment provider could not be reached',
    };
  }
}

/** It went through: move the deposit, from the state it was decided in only,
 *  and write it on the booking's history. */
async function done(
  ctx: SettleContext,
  money: BookingMoney,
  from: string,
  to: string
): Promise<SettledBookingMoney> {
  await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
    const moved = await tx.booking.updateMany({
      where: { id: money.bookingId, depositStatus: from },
      data: { depositStatus: to },
    });
    // A gateway that said yes moved the money whatever the row says now (the
    // payment webhook can mark a captured fee first). Keeping a deposit asks no
    // gateway, so when the row had already moved on, nothing happened here.
    if (moved.count === 0 && money.move === 'keep_deposit') return;
    await tx.auditLog.create({
      data: historyRow(ctx, money, BOOKING_PAYMENT_SETTLED, null),
    });
  });
  return { money, ok: true };
}

/** It did not: the deposit keeps its state, and the business is told. */
async function notDone(
  ctx: SettleContext,
  money: BookingMoney,
  kind: SettlementProblem['kind'],
  reason: string
): Promise<SettledBookingMoney> {
  // On the booking's history first, on its own: it is what the console reads to
  // say what happened, so it must not depend on the note or the task landing.
  try {
    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.auditLog.create({ data: historyRow(ctx, money, BOOKING_PAYMENT_NOT_SETTLED, reason) })
    );
  } catch (err) {
    console.error('booking payments: could not write the outcome on the booking', {
      err,
      tenantId: ctx.tenantId,
      bookingId: money.bookingId,
    });
  }
  await reportSettlementProblem(ctx, money, { kind, amountCents: money.amountCents, reason });
  return { money, ok: false, error: reason };
}

function historyRow(
  ctx: SettleContext,
  money: BookingMoney,
  action: string,
  reason: string | null
) {
  return {
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action,
    entityType: 'Booking',
    entityId: money.bookingId,
    diff: {
      move: money.move,
      ending: money.ending,
      amountCents: money.amountCents,
      currency: money.currency,
      ...(reason ? { reason } : {}),
    },
  };
}

// ── When the money did not move ──────────────────────────────────────────────

/** What did not happen, and how much it was for. */
export interface SettlementProblem {
  kind: 'fee_not_charged' | 'hold_not_lifted' | 'request_not_called_off' | 'deposit_not_refunded';
  amountCents: number;
  reason: string;
}

/** "Tue, Oct 6 at 2:30 PM", on the booking's own clock. */
function whenWords(d: Date, timezone: string): string {
  const fmt = (opts: Intl.DateTimeFormatOptions): string => {
    try {
      return new Intl.DateTimeFormat('en-US', { timeZone: timezone || 'UTC', ...opts }).format(d);
    } catch {
      return new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', ...opts }).format(d);
    }
  };
  return `${fmt({ weekday: 'short', month: 'short', day: 'numeric' })} at ${fmt({
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

/** The note on the customer's timeline, and the task when somebody has to act. */
export function settlementProblemWords(
  problem: SettlementProblem,
  facts: { customer: string; service: string; when: string; currency: string },
  ending: BookingMoney['ending']
): { note: string; task: { title: string; description: string } | null } {
  const money = formatCents(problem.amountCents, facts.currency);
  const booking = `${facts.customer}'s ${facts.service} booking on ${facts.when}`;
  // Gateways end their own sentences; the copy below ends them again.
  const why = problem.reason.replace(/[.\s]+$/, '');
  switch (problem.kind) {
    case 'fee_not_charged': {
      const fee = ending === 'no_show' ? 'no-show fee' : 'late-cancellation fee';
      const what = ending === 'no_show' ? 'did not come to' : 'canceled too close to the start of';
      return {
        note: `The ${money} ${fee} for ${booking} could not be charged to the card they left: ${why}. Nothing was charged.`,
        task: {
          title: `Ask ${facts.customer} for the ${money} ${fee}: the card was not charged`,
          description:
            `${facts.customer} ${what} their ${facts.service} booking on ${facts.when}, so your ` +
            `booking rules charge a ${money} ${fee} to the card they left when they booked. ` +
            `The charge did not go through: ${why}. A hold on a card only lasts about seven ` +
            `days, so a booking made further ahead than that cannot be charged from it. ` +
            `Nothing has been charged. Get in touch with ${facts.customer} to collect it, ` +
            `or let it go.`,
        },
      };
    }
    case 'hold_not_lifted':
      // Nothing was charged, and a hold nobody charges drops off the card by
      // itself. The customer is not out any money, but may ask why it is there.
      return {
        note: `Nothing was charged for ${booking}, but the ${money} hold on their card could not be lifted straight away (${why}). It drops off the card by itself within about seven days.`,
        task: null,
      };
    case 'request_not_called_off':
      return {
        note: `${booking} was canceled before the ${money} deposit was paid, and the payment could not be called off: ${why}.`,
        task: {
          title: `Check ${facts.customer}'s ${money} deposit: their booking was canceled`,
          description:
            `${facts.customer} canceled their ${facts.service} booking on ${facts.when} ` +
            `before paying the ${money} deposit, so the payment was to be called off. That ` +
            `did not go through: ${why}. If they pay it anyway, the money is for a booking ` +
            `that is not happening. Look for the payment in your payment provider's own ` +
            `dashboard, and refund it there if it went through.`,
        },
      };
    case 'deposit_not_refunded':
      return {
        note: `The ${money} deposit for ${booking} was to be refunded because it was canceled in time, but the refund did not go through: ${why}. Nothing has been given back yet.`,
        task: {
          title: `Refund ${facts.customer}'s ${money} deposit by hand`,
          description:
            `${facts.customer} canceled their ${facts.service} booking on ${facts.when} ` +
            `in time, so your booking rules give the ${money} deposit back. The refund did ` +
            `not go through: ${why}. Nothing has been given back yet. Refund it from your ` +
            `payment provider's own dashboard.`,
        },
      };
  }
}

/** Write it on the customer's timeline and, where
 *  somebody has to act, give the business a task due today. A failure to say so
 *  is logged, never thrown: the caller is told the money did not move either way. */
async function reportSettlementProblem(
  ctx: SettleContext,
  money: BookingMoney,
  problem: SettlementProblem
): Promise<void> {
  console.error('booking payments: the money did not move, the deposit keeps its state', {
    tenantId: ctx.tenantId,
    bookingId: money.bookingId,
    ending: money.ending,
    kind: problem.kind,
    reason: problem.reason,
  });
  try {
    const { customer, assignee } = await withTenant({ tenantId: ctx.tenantId }, async (tx) => {
      const person = money.customerId
        ? await tx.customer.findUnique({
            where: { id: money.customerId },
            select: { firstName: true, lastName: true, email: true },
          })
        : null;
      const name = [person?.firstName, person?.lastName].filter(Boolean).join(' ').trim();
      // The person who acted, when they are someone on the team (an API key's
      // actor may not be), else the owner, else anyone.
      const actor = ctx.userId
        ? await tx.user.findFirst({ where: { id: ctx.userId }, select: { id: true } })
        : null;
      const owner =
        actor?.id ??
        (
          await tx.user.findFirst({
            where: { role: 'owner' },
            orderBy: { createdAt: 'asc' },
            select: { id: true },
          })
        )?.id ??
        (await tx.user.findFirst({ orderBy: { createdAt: 'asc' }, select: { id: true } }))?.id ??
        null;
      return {
        customer: name.length > 0 ? name : (person?.email ?? 'The customer'),
        assignee: owner,
      };
    });

    const words = settlementProblemWords(
      problem,
      {
        customer,
        service: money.serviceName,
        when: whenWords(money.startAt, money.timezone),
        currency: money.currency,
      },
      money.ending
    );
    await withTenant({ tenantId: ctx.tenantId }, (tx) =>
      tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: money.customerId,
          actorId: null,
          actorType: 'system',
          type: 'note',
          description: words.note,
          linkedEntityType: 'Booking',
          linkedEntityId: money.bookingId,
          occurredAt: new Date(),
        },
      })
    );
    if (!words.task) return;
    if (!assignee) {
      console.error('booking payments: nobody on the team to give the task to', {
        tenantId: ctx.tenantId,
        bookingId: money.bookingId,
        task: words.task.title,
      });
      return;
    }
    const dueAt = await taskService.dueAtIn({ tenantId: ctx.tenantId }, 0);
    await taskService.create(
      { tenantId: ctx.tenantId, userId: assignee },
      {
        title: words.task.title,
        description: words.task.description,
        dueAt: dueAt.toISOString(),
        priority: 'high',
        assignedToUserId: assignee,
        customerId: money.customerId,
      }
    );
  } catch (err) {
    console.error('booking payments: the money did not move and telling the business failed', {
      err,
      tenantId: ctx.tenantId,
      bookingId: money.bookingId,
      kind: problem.kind,
    });
  }
}
