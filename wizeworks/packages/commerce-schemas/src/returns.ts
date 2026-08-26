// Returns / RMA — customer-initiated or staff-initiated, with inspection
// + restock decision per line item.

import { z } from 'zod';

import { Uuid } from '@wizeworks/crm-schemas';

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
});
export type SettleReturnExchangeInput = z.infer<typeof SettleReturnExchangeInput>;
