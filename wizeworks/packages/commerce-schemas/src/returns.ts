// Returns / RMA — customer-initiated or staff-initiated, with inspection
// + restock decision per line item.

import { z } from 'zod';

import { Carrier, Uuid } from '@wizeworks/crm-schemas';

import { MoneyCents } from './common';

export const ReturnStatus = z.enum([
  'requested',
  'approved',
  'denied',
  'awaiting_shipment',
  'in_transit',
  'received',
  'inspecting',
  'inspected',
  'refunded',
  // Settled by sending a replacement rather than by moving money. Its own
  // terminal state on purpose: recording an even swap as a refund of zero puts a
  // $0.00 refund in the tenant's books for every exchange they ever do, and
  // makes "how much did we refund" unanswerable (persona issue 220).
  'exchanged',
  'cancelled',
]);
export type ReturnStatus = z.infer<typeof ReturnStatus>;

// 'store_credit' is the pre-rename legacy alias of 'account_credit' (store→site
// rename). Kept as a tolerated value so historical rows validate until the
// account-credit backfill is confirmed everywhere; remove in the contract step.
export const ReturnOutcome = z.enum([
  'refund',
  'account_credit',
  'exchange',
  'repair',
  'store_credit',
]);
export type ReturnOutcome = z.infer<typeof ReturnOutcome>;

export const ReturnReasonCode = z.enum([
  'wrong_item',
  'wrong_size',
  'defective',
  'damaged_in_transit',
  'not_as_described',
  'no_longer_needed',
  'arrived_late',
  'other',
]);
export type ReturnReasonCode = z.infer<typeof ReturnReasonCode>;

export const ItemCondition = z.enum([
  'unopened',
  'like_new',
  'used_good',
  'used_acceptable',
  'damaged',
  'destroyed',
]);
export type ItemCondition = z.infer<typeof ItemCondition>;

export const ReturnLineItemInput = z.object({
  orderItemId: Uuid,
  quantity: z.number().int().positive(),
  reasonCode: ReturnReasonCode,
  customerNote: z.string().max(2000).optional(),
  mediaAssetIds: z.array(Uuid).max(10).default([]), // customer photos
});
export type ReturnLineItemInput = z.infer<typeof ReturnLineItemInput>;

export const CreateReturnRequestInput = z.object({
  orderId: Uuid,
  requestedBy: z.enum(['customer', 'staff']),
  preferredOutcome: ReturnOutcome.default('refund'),
  items: z.array(ReturnLineItemInput).min(1).max(100),
});
export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestInput>;

export const ApproveReturnInput = z.object({
  returnId: Uuid,
  // Per-line decision: approved quantity (may be less than requested).
  itemDecisions: z
    .array(
      z.object({
        returnLineItemId: Uuid,
        approvedQuantity: z.number().int().nonnegative(),
      })
    )
    .min(1),
  generateLabel: z.boolean().default(true),
  staffNote: z.string().max(2000).optional(),
});
export type ApproveReturnInput = z.infer<typeof ApproveReturnInput>;

export const DenyReturnInput = z.object({
  returnId: Uuid,
  reason: z.string().min(1).max(2000),
});
export type DenyReturnInput = z.infer<typeof DenyReturnInput>;

export const RecordReturnInspectionInput = z.object({
  returnId: Uuid,
  inspections: z
    .array(
      z.object({
        returnLineItemId: Uuid,
        condition: ItemCondition,
        restockable: z.boolean(),
        warehouseId: Uuid.optional(), // where it'll restock
        photoMediaIds: z.array(Uuid).max(10).default([]),
        note: z.string().max(2000).optional(),
      })
    )
    .min(1),
});
export type RecordReturnInspectionInput = z.infer<typeof RecordReturnInspectionInput>;

export const IssueReturnRefundInput = z.object({
  returnId: Uuid,
  refundAmountCents: MoneyCents,
  asAccountCredit: z.boolean().default(false),
  restockingFeeCents: MoneyCents.optional(),
});
export type IssueReturnRefundInput = z.infer<typeof IssueReturnRefundInput>;

/**
 * How a replacement is travelling to the customer.
 *
 * The `carrier` vocabulary is the ORDER fulfillment one, deliberately: a shop
 * that posts everything by USPS should pick USPS from the same list on both
 * screens, and a second list would drift from the first the first time one
 * gained a carrier.
 *
 * A tracking number is the point of the whole shape. Everything else can be
 * absent and the record still answers "it went, here is how to follow it";
 * without the number there is nothing to tell the customer, which is the state
 * this was built to end.
 */
export const ReplacementShipment = z.object({
  carrier: Carrier.optional(),
  /** The name a person typed, when `carrier` is 'other'. Mirrors the order
   *  fulfillment path's `carrierOther` rather than inventing a second way. */
  carrierOther: z.string().max(63).optional(),
  trackingNumber: z.string().min(1).max(127),
  trackingUrl: z.string().url().max(2048).optional(),
  /** When it was actually posted. A shop recording Monday's parcel on Tuesday
   *  must not tell the customer it went today. */
  shippedAt: z.string().datetime().optional(),
});
export type ReplacementShipment = z.infer<typeof ReplacementShipment>;

/**
 * Settling an exchange: the replacement that goes out instead of money.
 *
 * `replacementVariantId` is required rather than optional — an exchange with no
 * replacement named is a return somebody closed without saying what they sent,
 * and it takes one unit off no shelf at all.
 */
export const SettleReturnExchangeInput = z.object({
  returnId: Uuid,
  replacementVariantId: Uuid,
  quantity: z.number().int().positive().max(100).default(1),
  staffNote: z.string().max(2000).optional(),
  /** How the replacement is travelling, when that is known at settle time.
   *
   *  All optional, because most shops settle the swap and walk to the post
   *  office afterwards — blocking the settle on a tracking number nobody has yet
   *  would make the common case the hard one. When it IS given here, the swap's
   *  own email carries the tracking number and no second email is sent; when it
   *  is not, it is added later through `RecordReplacementShipmentInput` and the
   *  customer gets a tracking email at that point instead. */
  shipment: ReplacementShipment.optional(),
});
export type SettleReturnExchangeInput = z.infer<typeof SettleReturnExchangeInput>;

/**
 * Recording how the replacement travelled, AFTER the swap was settled.
 *
 * The common path, not the exception. She decides what to send and settles it
 * while the customer is waiting; the parcel goes out later that day or the next
 * morning, and only then does a tracking number exist.
 *
 * Without this the tracking number had nowhere to go once the settle screen had
 * closed, which is the same shape as a return whose goods could no longer be
 * recorded after settling (persona issue 452): a fact about the world with no
 * route into the product.
 */
export const RecordReplacementShipmentInput = z.object({
  returnId: Uuid,
  shipment: ReplacementShipment,
});
export type RecordReplacementShipmentInput = z.infer<typeof RecordReplacementShipmentInput>;
