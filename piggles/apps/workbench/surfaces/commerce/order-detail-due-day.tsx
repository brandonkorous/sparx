'use client';

// The day this order is due to be handed over (issue 026).
//
// Renders only when the order actually carries one. An order with nothing made
// to order on it says nothing here, rather than a "Ready: today" that nobody
// promised — an absence is not a measurement.

import { Alert, AlertContent, AlertDescription, AlertTitle } from '@wizeworks/silicaui-react';

import { readyOnLabel } from './made-to-order-data';
import { type Order } from './data';
import { deliveryPlan } from './order-types';

// "Collected" was printed on every order, including ones going in the post
// (issue 215). The order already knows which it is.
const WAY = {
  collect: { done: 'collected', soonest: 'collected' },
  post: { done: 'sent', soonest: 'sent' },
};

export function DueDaySection({ order }: { order: Order }) {
  const day = readyOnLabel(order.readyOn);
  if (!day) return null;

  const done = order.status === 'fulfilled' || order.status === 'delivered';
  const off = order.status === 'cancelled' || order.status === 'refunded';
  if (off) return null;
  const way = deliveryPlan(order).collected ? WAY.collect : WAY.post;

  return (
    <Alert color={done ? 'success' : 'module'} variant="soft">
      <AlertContent>
        <AlertTitle>{done ? `Was due ${day}` : `Due ${day}`}</AlertTitle>
        <AlertDescription>
          {done
            ? `This order has been ${way.done}.`
            : `Something on this order has to be made first, so this is the earliest day it can be ${way.soonest}. It was agreed when the order was placed and does not move if you change the product afterwards.`}
        </AlertDescription>
      </AlertContent>
    </Alert>
  );
}
