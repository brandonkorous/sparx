// Core charges — a refundable deposit on a rebuilt part (sparx persona issue 051).
//
// A remanufactured part is sold with a deposit on top of its price. The buyer
// gets the deposit back when the old part (the "core") comes back usable. The
// deposit rides on the part's own order line (`OrderItem.coreCharge`), and each
// unit's core ends one of three ways: the part itself came back (refunded with
// it), the old part came back (`coresReturned`), or the business kept the deposit
// (`coresKept`). Whatever is left is a core still owed.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

// The one shipping rule (issues 057, 058) lives with orders; the warehouse reads
// it through here, since inventory depends on this package and not on CRM's.
export {
  lineShipRefusal,
  orderShipRefusal,
  shippableUnits,
  unitsWaitingForCore,
  type ShipGateLine,
} from '@wizeworks/crm-schemas';

/** Where a returned core's deposit goes when the order was paid. An order still
 *  owing on an invoice is always settled by taking the deposit off that invoice
 *  first; this decides where any money already paid goes. */
export const CoreRefundRoute = z.enum(['original_payment', 'account_credit']);
export type CoreRefundRoute = z.infer<typeof CoreRefundRoute>;

export const ReceiveCoresInput = z
  .object({
    orderItemId: Uuid,
    /** Old parts that came back fit to rebuild: their deposits go back. */
    usable: z.number().int().nonnegative(),
    /** Old parts that came back cracked, incomplete or not the right part: their
     *  deposits are kept, and the business says why in `note`. */
    unusable: z.number().int().nonnegative().default(0),
    refundTo: CoreRefundRoute.default('original_payment'),
    note: z.string().trim().max(2000).nullish(),
  })
  .refine((input) => input.usable + input.unusable > 0, {
    message: 'Say how many old parts came back.',
    path: ['usable'],
  })
  .refine((input) => input.unusable === 0 || (input.note ?? '').length > 0, {
    message: 'Say why the old part cannot be used. The customer will ask.',
    path: ['note'],
  });
export type ReceiveCoresInput = z.infer<typeof ReceiveCoresInput>;

export const KeepCoreDepositsInput = z.object({
  orderItemId: Uuid,
  quantity: z.number().int().positive(),
  /** Why the deposit is kept: the customer said they are keeping the old part, or
   *  it never came back. Required, because the customer will ask. */
  note: z.string().trim().min(1, 'Say why the deposit is kept.').max(2000),
});
export type KeepCoreDepositsInput = z.infer<typeof KeepCoreDepositsInput>;

/** Ship a send-the-old-part-first line before its old part arrives (issue 057).
 *  The reason is kept, because the old part is still owed and the next person to
 *  open the order will want to know why it went. */
export const ReleaseCoreHoldInput = z.object({
  orderItemId: Uuid,
  note: z.string().trim().min(1, 'Say why it can go before the old part arrives.').max(2000),
});
export type ReleaseCoreHoldInput = z.infer<typeof ReleaseCoreHoldInput>;

export const ListCoresOwedInput = z.object({
  customerId: Uuid.optional(),
  companyId: Uuid.optional(),
  orderId: Uuid.optional(),
  /** Only cores owed for at least this many days. */
  olderThanDays: z.number().int().nonnegative().optional(),
  limit: z.number().int().min(1).max(500).default(200),
});
export type ListCoresOwedInput = z.infer<typeof ListCoresOwedInput>;

/** One order line that still has cores to come back. */
export interface CoreOwed {
  orderItemId: string;
  orderId: string;
  orderNumber: string;
  placedAt: string;
  customerId: string;
  customerName: string;
  companyId: string | null;
  companyName: string | null;
  sku: string;
  name: string;
  quantity: number;
  coreChargeCents: number;
  /** Bought by sending the old part first: no deposit is held, and the part
   *  ships when the old one arrives (issue 057). */
  coreFirst: boolean;
  /** Units of a send-first line still waiting for their old part before they can
   *  ship. Zero on a deposit line, and once the business chose not to wait. */
  waitingToShip: number;
  /** When the business chose to ship a send-first line before its old part. */
  holdReleasedAt: string | null;
  coresOwed: number;
  coresReturned: number;
  coresKept: number;
  /** coresOwed × coreChargeCents: what goes back if every one comes back. */
  owedCents: number;
  /** Whole days since the order was placed. */
  daysOut: number;
  currency: string;
}

export interface CoreSettlement {
  orderItemId: string;
  coresReturned: number;
  coresKept: number;
  /** Deposits taken off an open invoice. */
  invoiceCreditCents: number;
  /** Deposits paid back to the card or by hand. */
  refundedCents: number;
  /** Deposits given as account credit. */
  accountCreditCents: number;
  /** How the money that went back was settled, in words for a person. */
  summary: string;
}

/** The cores still owed on one order line. Never below zero. */
export function coresOwed(line: {
  quantity: number;
  quantityRefunded: number;
  coresReturned: number;
  coresKept: number;
}): number {
  return Math.max(0, line.quantity - line.quantityRefunded - line.coresReturned - line.coresKept);
}
