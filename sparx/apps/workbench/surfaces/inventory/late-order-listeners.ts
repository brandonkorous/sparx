// Whether anybody hears about a late purchase order.
//
// The late-order event has exactly one consumer: a webhook under Tell other
// software. The overdue list and the order said "passed to your other software"
// whenever the nightly check had fired, for a business with no webhook at all, so
// nothing was passed anywhere (sparx persona issue 304). Those words now need a
// webhook that is on and listening for this event.

import { useWebhooks } from '../cms/webhooks-data';

export const LATE_ORDER_EVENT = 'inventory.purchase_order.late';

export function useLateOrderListened(): boolean {
  const webhooks = useWebhooks();
  return (webhooks.data ?? []).some((w) => w.active && w.events.includes(LATE_ORDER_EVENT));
}
