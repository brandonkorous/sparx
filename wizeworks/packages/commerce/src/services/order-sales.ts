// What an order SOLD — the one definition every revenue figure adds up.
//
// An order's TOTAL is what the customer paid, and three things in it were never
// the shop's sales: the sales tax it collected for the state, the core deposits
// it holds until the old parts come back, and, for an order still waiting for the
// shop's approval, the whole of it. The daily revenue rollup summed the total, so
// Gillett's October profit read "You kept $14,740.25" over $11,459.60 of goods sold
// (sparx persona issue 172). This is the figure instead, pure so a test holds it.
//
// Sold = goods − discounts + shipping + the card surcharge passed on
//        − goods refunded (their tax share taken out)
//        + core deposits the shop KEPT (an old part that never came back is income)

/** The order's own money columns, in dollars as stored, plus its core lines. */
export interface OrderMoney {
  subtotal: number;
  discountTotal: number;
  shippingTotal: number;
  surchargeTotal: number;
  taxTotal: number;
  refundTotal: number;
  /** Deposits handed back because the old part came back (cores returned × charge). */
  coreRefunded: number;
  /** Deposits kept because it did not (cores kept × charge). */
  coreKept: number;
}

export interface OrderSales {
  /** The goods, before discounts. */
  grossCents: number;
  discountCents: number;
  /** Goods given back: refunds less deposit refunds, less their tax share. */
  refundedCents: number;
  /** What the order sold, after all of the above. */
  soldCents: number;
}

const cents = (dollars: number) => Math.round(dollars * 100);

export function orderSales(order: OrderMoney): OrderSales {
  const sales =
    cents(order.subtotal) -
    cents(order.discountTotal) +
    cents(order.shippingTotal) +
    cents(order.surchargeTotal);
  const tax = cents(order.taxTotal);
  // A refund hands back deposits and tax as well as goods. Deposits are taken off
  // first, since they are refunded as their own line; what is left is goods and
  // tax in the order's own proportion.
  const notDeposit = Math.max(cents(order.refundTotal) - cents(order.coreRefunded), 0);
  const refunded = sales + tax > 0 ? Math.round((notDeposit * sales) / (sales + tax)) : 0;
  return {
    grossCents: cents(order.subtotal),
    discountCents: cents(order.discountTotal),
    refundedCents: refunded,
    soldCents: sales - refunded + cents(order.coreKept),
  };
}

/** One order line's core, as `order_items` stores it. */
export interface CoreLine {
  /** Per unit, or null when the part has no core. */
  coreCharge: number | null;
  quantityRefunded: number;
  coresReturned: number;
  coresKept: number;
  /** Bought old part first: no deposit was ever taken. */
  coreFirst: boolean;
}

/**
 * The deposits on an order that were handed back, and those the shop kept.
 *
 * Each unit's core ends one of three ways (see `order_items`): the part itself
 * comes back and its deposit goes back with it (`quantityRefunded`), the old part
 * comes back and the deposit is refunded (`coresReturned`), or the shop keeps the
 * deposit (`coresKept`). A line bought old part first took no deposit at all.
 */
export function coreDeposits(lines: readonly CoreLine[]): {
  coreRefunded: number;
  coreKept: number;
} {
  let coreRefunded = 0;
  let coreKept = 0;
  for (const line of lines) {
    if (line.coreFirst || line.coreCharge === null) continue;
    coreRefunded += (line.coresReturned + line.quantityRefunded) * line.coreCharge;
    coreKept += line.coresKept * line.coreCharge;
  }
  return { coreRefunded, coreKept };
}

/** Statuses that are not a sale (yet). A cancelled order never was; one waiting
 *  for the shop's approval may never be. */
export const NOT_A_SALE: readonly string[] = ['cancelled', 'pending_approval'];

export function countsAsSale(status: string): boolean {
  return !NOT_A_SALE.includes(status);
}
