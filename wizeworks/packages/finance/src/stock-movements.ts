// How a stock movement names the order it belongs to.
//
// The inventory sell path writes `referenceType: 'Order'`, capital O
// (`@wizeworks/inventory` sell-path.ts, and every report that reads them back).
// Finance read `'order'`. Postgres compares case-sensitively, so it matched none:
// every order's goods cost was $0.00 on By job, a 100% margin on every sale, and
// the daily rollup filed all goods cost under "no site", so a site's Profit took
// nothing off for goods at all (persona issue 924). Finance does not depend on
// the inventory package, so the name lives here once and both readers use it.

/** `inventory_movements.reference_type` for a movement made by an order. */
export const ORDER_MOVEMENT_REFERENCE = 'Order';
