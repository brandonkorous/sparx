import { revalidatePath } from 'next/cache';

import { ORDER_BASE_PATHS } from '../paths';

// One order is rendered at three routes (/commerce/orders, /b2b/orders,
// /crm/orders) for three separately billed modules. A write therefore has to
// invalidate all three — revalidating only the route the user happened to act
// from leaves the other two serving a stale order, which is exactly the kind of
// drift the shared-component design exists to prevent.
//
// These are cheap: revalidatePath only marks a path dirty. A tenant without a
// given module simply never requests that route.

/** Invalidate every order LIST after a create/cancel/bulk write. */
export function revalidateOrderLists(): void {
  for (const base of ORDER_BASE_PATHS) revalidatePath(base);
}

/** Invalidate one order's DETAIL (and the lists it appears in) after a write
 *  that changes the order — payments, refunds, fulfillments, labels, status. */
export function revalidateOrder(orderId: string): void {
  for (const base of ORDER_BASE_PATHS) {
    revalidatePath(base);
    revalidatePath(`${base}/${orderId}`);
  }
}
