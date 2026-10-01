'use client';

// The day this order is due to be handed over (issue 026).
//
// Renders only when the order actually carries one. An order with nothing made
// to order on it says nothing here, rather than a "Ready: today" that nobody
// promised — an absence is not a measurement.
//
// ── A PROMISE IN THE FUTURE TENSE ABOUT A DAY IN THE PAST ──────────────────
//
// This block used to read, on the thirtieth, about a day that had been and
// gone: "Due Friday, September 25 — this is the earliest day it can be
// collected." Present tense, module color, exactly what it says about a day
// next month. Nothing on the order's own pane, or on the list it was opened
// from, said the promised day had passed (issue 896).
//
// So the day now comes through `dueDaySignal`, the console's one rule for a
// promised day, and the sentence under it changes tense with the day rather
// than describing a plan that is no longer a plan.
// [[feedback_a_promise_in_copy_is_a_contract]]

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';

import { readyOnLabel } from './made-to-order-data';
import { type Order } from './data';
import { deliveryPlan } from './order-types';
import { dueDaySignal } from '../../lib/console/days';
import { useBusinessZone } from '../../lib/business-timezone';

// "Collected" was printed on every order, including ones going in the post
// (issue 215). The order already knows which it is.
const WAY = {
  collect: { done: 'collected', soonest: 'collected', verb: 'collect' },
  post: { done: 'sent', soonest: 'sent', verb: 'send' },
};

export function DueDaySection({ order }: { order: Order }) {
  // Her shop's calendar, the same one the orders list counts on.
  const zone = useBusinessZone();
  const day = readyOnLabel(order.readyOn);
  if (!day) return null;

  const done = order.status === 'fulfilled' || order.status === 'delivered';
  const off = order.status === 'cancelled' || order.status === 'refunded';
  if (off) return null;
  const way = deliveryPlan(order).collected ? WAY.collect : WAY.post;

  // Only an order still waiting can be late. A finished one gets the same
  // "Was due" it always got — telling somebody a job they completed is five
  // days late helps nobody and buries the ones that still are.
  const signal = done ? null : dueDaySignal(order.readyOn, new Date(), zone);
  const late = signal?.late === true;

  const title = done ? `Was due ${day}` : late ? `${signal.label} · due ${day}` : `Due ${day}`;

  // Her first name if the order carries one, so the sentence reads like a
  // person to ring rather than a record to process. Empty counts as absent:
  // `??` alone would print "tell  where it stands".
  const who = order.customer?.firstName?.trim() ?? '';

  const body = done
    ? `This order has been ${way.done}.`
    : late
      ? `This was the day it was agreed for, and it has gone by. It is still to ${way.verb}, so tell ${who === '' ? 'the customer' : who} where it stands and agree a new day if you need one.`
      : `Something on this order has to be made first, so this is the earliest day it can be ${way.soonest}. It was agreed when the order was placed and does not move if you change the product afterwards.`;

  return (
    <Alert color={done ? 'success' : late ? 'danger' : 'module'} variant="soft">
      <AlertContent>
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>{body}</AlertDescription>
      </AlertContent>
    </Alert>
  );
}
