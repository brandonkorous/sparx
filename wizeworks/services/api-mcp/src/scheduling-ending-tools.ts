// Ending a booking, for an AI client: cancel it, mark a no-show, complete it,
// or cancel a whole repeating series.
//
// The REST routes and these tools are the same steps: @wizeworks/scheduling ends
// the booking and hands back what the card on it needs (`money`), then, once that
// has committed, `bookingPayments.settle` in @wizeworks/commerce charges the fee
// from the hold, lets the hold go, or refunds or keeps the deposit, and the
// booking's event is published.
//
// They live here rather than in the scheduling package's MCP tools because
// settling the card needs the payment gateways, and that package does not carry
// them (same reasoning as `b2b-approval-tools.ts`). The versions that lived there
// ended the booking and never touched the card, so a booking an AI assistant
// canceled kept the hold, an on-time cancel never got its deposit back, and a
// no-show was never charged (sparx persona issue 087). They never published the
// booking's event either, so a slot an assistant freed never reached the
// waitlist. Their scope is still `write:scheduling`, so they are still gated on
// the scheduling module in server.ts.

import { z } from 'zod';
import { bookingPayments } from '@wizeworks/commerce';
import { publish } from '@wizeworks/api-core/pubsub';
import {
  cancelBooking,
  cancelBookingSeries,
  completeBooking,
  noShowBooking,
  type BookingMoney,
} from '@wizeworks/scheduling';
import {
  CancelBookingInput,
  CancelBookingSeriesInput,
  NoShowBookingInput,
} from '@wizeworks/scheduling-schemas';

// Through api-core's publish, which also queues the business's own webhooks, the
// same as the REST routes. It wants a Fastify logger and this service has no
// request, so the console stands in (as in b2b-approval-tools.ts).
const mcpLogger = console as unknown as Parameters<typeof publish>[0];

interface Ctx {
  tenantId: string;
  userId: string;
}

/** What happened to one booking's card, for the agent to tell the person. A
 *  failure is already on the booking, on the customer's timeline and (where
 *  somebody has to act) in the business's tasks; the agent should say so
 *  rather than try again. */
interface CardOutcome {
  bookingId: string;
  action: BookingMoney['move'];
  amountCents: number;
  done: boolean;
  problem?: string;
}

async function settleCards(ctx: Ctx, money: readonly (BookingMoney | null)[]) {
  const moves = money.filter((m): m is BookingMoney => m !== null);
  if (moves.length === 0) return [];
  const settled = await bookingPayments.settle(ctx, moves);
  return settled.map(({ money: move, ok, error }): CardOutcome => {
    if (!ok) {
      console.error('booking: the card could not be settled', {
        bookingId: move.bookingId,
        move: move.move,
        error,
      });
    }
    return {
      bookingId: move.bookingId,
      action: move.move,
      amountCents: move.amountCents,
      done: ok,
      ...(error ? { problem: error } : {}),
    };
  });
}

const CARD_NOTE =
  '`card` says what happened to the card on it (absent when there was nothing to settle): a fee charged from the hold, the hold let go, a deposit refunded or kept. If `done` is false the money did not move; the business has been told and, where somebody has to act, given a task, so say that rather than retrying.';

const cancelBookingTool = {
  name: 'cancel_booking',
  description: `Cancel a booking, releasing its slot immediately and telling the customer (unless notifyCustomer is false). The card on it is settled by the service's booking rules: a cancellation inside the notice window charges the late-cancellation fee from a card hold or keeps a deposit; one in good time lets the hold go or refunds the deposit. waiveFee lets the customer off any fee. ${CARD_NOTE} Confirm before running.`,
  scope: 'write:scheduling' as const,
  confirmation: true,
  input: CancelBookingInput,
  async run(ctx: Ctx, input: CancelBookingInput) {
    const { booking, money } = await cancelBooking(ctx.tenantId, input, ctx.userId);
    const [card] = await settleCards(ctx, [money]);
    await publish(mcpLogger, 'booking.cancelled', ctx.tenantId, ctx.userId, {
      bookingId: booking.id,
      reason: input.reason ?? null,
    });
    return { ...booking, ...(card ? { card } : {}) };
  },
};

const noShowBookingTool = {
  name: 'no_show_booking',
  description: `Mark a booking as a no-show and free its slot. The no-show fee in the service's booking rules is charged from a card hold, or a deposit is kept; waiveFee lets the customer off it. ${CARD_NOTE} Confirm before running.`,
  scope: 'write:scheduling' as const,
  confirmation: true,
  input: NoShowBookingInput,
  async run(ctx: Ctx, input: NoShowBookingInput) {
    const { booking, money } = await noShowBooking(ctx.tenantId, input, ctx.userId);
    const [card] = await settleCards(ctx, [money]);
    await publish(mcpLogger, 'booking.no_show', ctx.tenantId, ctx.userId, {
      bookingId: booking.id,
    });
    return { ...booking, ...(card ? { card } : {}) };
  },
};

const completeBookingTool = {
  name: 'complete_booking',
  description: `Mark a booking as completed (the service was delivered). A card hold on it is let go with nothing charged; a deposit or prepayment is kept, as it is the payment. ${CARD_NOTE} Confirm before running.`,
  scope: 'write:scheduling' as const,
  confirmation: true,
  input: z.object({ bookingId: z.string().uuid() }),
  async run(ctx: Ctx, input: { bookingId: string }) {
    const { booking, money } = await completeBooking(ctx.tenantId, input.bookingId, ctx.userId);
    const [card] = await settleCards(ctx, [money]);
    await publish(mcpLogger, 'booking.completed', ctx.tenantId, ctx.userId, {
      bookingId: booking.id,
    });
    return { ...booking, ...(card ? { card } : {}) };
  },
};

const cancelBookingSeriesTool = {
  name: 'cancel_booking_series',
  description:
    'Stop a repeating booking and cancel its occurrences: `future` (the default) cancels the ones not yet started, `all` also cancels any in progress. Each booking is canceled exactly as cancel_booking would, customers told, and the card on each settled by the booking rules (a late one charged its fee unless waiveFee). `cards` lists what happened to each card; a `done: false` means the business has been told and given a task where somebody has to act. Confirm before running.',
  scope: 'write:scheduling' as const,
  confirmation: true,
  input: CancelBookingSeriesInput,
  async run(ctx: Ctx, input: CancelBookingSeriesInput) {
    const { money, bookingIds, ...result } = await cancelBookingSeries(
      ctx.tenantId,
      input,
      ctx.userId
    );
    const cards = await settleCards(ctx, money);
    for (const bookingId of bookingIds) {
      await publish(mcpLogger, 'booking.cancelled', ctx.tenantId, ctx.userId, {
        bookingId,
        reason: input.reason ?? null,
      });
    }
    return { ...result, cards };
  },
};

export const schedulingEndingMcpTools = [
  cancelBookingTool,
  noShowBookingTool,
  completeBookingTool,
  cancelBookingSeriesTool,
];
