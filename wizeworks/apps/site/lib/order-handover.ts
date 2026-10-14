// How an order reaches the customer, as timeline steps.
//
// A sale taken at the counter, or an order the customer collects, did not travel.
// Every order got "On its way" and "Delivered", so Brynn's counter sale read
// "On its way · pickup · Delivered" over "How you'll get it: Taken at the counter"
// (sparx persona issue 177). A collected order has one step: Collected.
//
// An order can leave in parts: a supplier ships its part while the shop's own is
// still on the shelf. Until all of it has gone, the step says part of it is on its
// way, so the tracking for the part that left has somewhere to sit (sparx persona
// issue 218).

export interface HandoverStep {
  key: 'shipped' | 'delivered' | 'collected';
  label: string;
  at: string | null;
  complete: boolean;
}

export function handoverSteps(
  order: {
    collecting: boolean;
    fulfilledAt: string | null;
    deliveredAt: string | null;
    /** A shipment has left, though the order as a whole has not. */
    partlyShipped?: boolean;
  },
  terminal: boolean
): HandoverStep[] {
  if (order.collecting) {
    const at = order.deliveredAt ?? order.fulfilledAt;
    if (terminal && !at) return [];
    return [{ key: 'collected', label: 'Collected', at, complete: Boolean(at) }];
  }
  const steps: HandoverStep[] = [];
  const shipped = Boolean(order.fulfilledAt);
  const delivered = Boolean(order.deliveredAt);
  if (!terminal || shipped) {
    const partly = !shipped && order.partlyShipped === true;
    steps.push({
      key: 'shipped',
      label: partly ? 'Part of it is on its way' : 'On its way',
      at: order.fulfilledAt,
      complete: shipped,
    });
  }
  if (!terminal || delivered) {
    steps.push({
      key: 'delivered',
      label: 'Delivered',
      at: order.deliveredAt,
      complete: delivered,
    });
  }
  return steps;
}
