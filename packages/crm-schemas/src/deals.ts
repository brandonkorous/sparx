// Deal input schemas.
//
// docs/11 §4. A deal lives on a pipeline + stage, optionally linked to a
// customer and/or a B2B account, and connects to orders/quotes via the
// join tables (deal_orders, deal_quotes) — never via columns on those
// tables. See locked decision #5 in memory/feedback_crm_architecture.md.

import { z } from 'zod';

import { TagList, TagListPatch, Uuid } from './common';

export const CreateDealInput = z.object({
  pipelineId: Uuid,
  stageId: Uuid,
  customerId: Uuid.nullable().optional(),
  b2bAccountId: Uuid.nullable().optional(),
  assignedRepId: Uuid.nullable().optional(),
  title: z.string().min(1).max(255),
  value: z.number().min(0).max(999_999_999_999.99).default(0),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be ISO 4217 (e.g. "USD")')
    .default('USD'),
  probability: z.number().min(0).max(100).default(0),
  expectedCloseDate: z.string().date().nullable().optional(),
  source: z.string().max(63).nullable().optional(),
  tags: TagList.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // Why it ended the way it did. Normally captured by the stage move that closed
  // the deal, but editable here too: it is the one part of a lost deal nobody
  // can reconstruct later, so a typo in it must not be permanent.
  closedReason: z.string().max(500).nullable().optional(),
  // Tenant-declared extra fields (docs/144 §3), validated by the service against
  // the `deal` object definition. No `.default()` — see the note below on why a
  // default here would be destructive under `.partial()`.
  customProperties: z.record(z.string(), z.unknown()).optional(),
});
export type CreateDealInput = z.infer<typeof CreateDealInput>;

// `.partial()` alone is WRONG here, and silently destructive: zod keeps each
// field's `.default()` behind the new optional wrapper, so parsing `{ title }`
// yields `{ title, value: 0, currency: 'USD', probability: 0 }` — and
// dealService.update writes every key that isn't undefined. Renaming a deal
// would zero its value and probability. The three defaulted fields are
// re-declared without defaults so an omitted key stays omitted.
export const UpdateDealInput = CreateDealInput.partial().extend({
  value: z.number().min(0).max(999_999_999_999.99).optional(),
  currency: z
    .string()
    .length(3)
    .regex(/^[A-Z]{3}$/, 'Currency must be ISO 4217 (e.g. "USD")')
    .optional(),
  probability: z.number().min(0).max(100).optional(),
  // TagList's own `.default([])` survives too, so a rename also cleared tags.
  tags: TagListPatch.optional(),
});
export type UpdateDealInput = z.infer<typeof UpdateDealInput>;

// Stage moves are a separate write path because they emit deal.stage_changed
// to Pub/Sub — the email module's automations key off this event. Going
// through the generic UpdateDeal path would skip that side effect.
export const MoveDealStageInput = z.object({
  toStageId: Uuid,
  // Optional: closedReason captured when moving to a won/lost terminal stage.
  closedReason: z.string().max(500).optional(),
});
export type MoveDealStageInput = z.infer<typeof MoveDealStageInput>;

// Order/quote attachment — pure join-table operations.
export const AttachDealOrderInput = z.object({
  dealId: Uuid,
  orderId: Uuid,
});
export type AttachDealOrderInput = z.infer<typeof AttachDealOrderInput>;

export const AttachDealQuoteInput = z.object({
  dealId: Uuid,
  quoteId: Uuid,
});
export type AttachDealQuoteInput = z.infer<typeof AttachDealQuoteInput>;
