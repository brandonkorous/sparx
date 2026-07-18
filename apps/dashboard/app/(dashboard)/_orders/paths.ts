// Order route prefixes — the single source of truth for WHERE the order
// surfaces live.
//
// Split out from lens.ts (which imports icons and other client-side concerns)
// so server actions can revalidate every order route without dragging an icon
// library into the server bundle. lens.ts builds on these, so a path is written
// exactly once.
//
// One order is reachable at three routes because Commerce, B2B, and CRM are
// three separately billed modules that each need their own view of it — see
// lens.ts for the full rationale.

export const COMMERCE_ORDERS_PATH = '/commerce/orders';
export const B2B_ORDERS_PATH = '/b2b/orders';
export const CRM_ORDERS_PATH = '/crm/orders';

/** Every route an order is reachable at, in module precedence order
 *  (Commerce > B2B > CRM — Commerce produces orders, CRM only reads them). */
export const ORDER_BASE_PATHS = [COMMERCE_ORDERS_PATH, B2B_ORDERS_PATH, CRM_ORDERS_PATH] as const;
