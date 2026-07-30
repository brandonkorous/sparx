// B2B account input schemas.
//
// docs/10-b2b-wholesale-prd.md §2. Phase 1 ships the record shape; the B2B
// module adds quote / credit-hold / approval workflows later — those tables
// FK back into this row rather than redefining the account.

import { z } from 'zod';

import { B2BAccountStatus, PaymentTerms, TagList, TagListPatch, Uuid } from './common';

// Engine profile shape stored in b2b_accounts.engine_profiles JSONB. Used
// by the fitment-aware catalog when Commerce lands. Each profile is one
// engine variant the fleet runs — fleet_size on the parent row is the
// aggregate count, this array describes the variants.
const EngineProfile = z.object({
  year: z.number().int().min(1900).max(2100).optional(),
  make: z.string().max(60),
  model: z.string().max(60),
  engine: z.string().max(120).optional(),
  count: z.number().int().min(0).optional(),
});
export type EngineProfile = z.infer<typeof EngineProfile>;

export const CreateB2BAccountInput = z.object({
  companyName: z.string().min(1).max(255),
  taxId: z.string().max(64).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  pricingTier: z.string().max(63).nullable().optional(),
  creditLimit: z.number().min(0).max(99_999_999.99).default(0),
  paymentTerms: PaymentTerms.nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  status: B2BAccountStatus.default('active'),
  assignedRepId: Uuid.nullable().optional(),
  fleetSize: z.number().int().min(0).nullable().optional(),
  engineProfiles: z.array(EngineProfile).max(100).default([]),
  notes: z.string().max(10_000).nullable().optional(),
  tags: TagList.optional(),
});
export type CreateB2BAccountInput = z.infer<typeof CreateB2BAccountInput>;

// The four re-declarations are load-bearing, for the same reason as
// UpdateDocumentWorkflowInput: `.partial()` makes a field optional but leaves its
// `.default(...)` intact, so Zod fabricates a value for every defaulted field the
// caller omitted, and b2bAccountService.update writes each field that is
// `!== undefined`. This is the sharpest instance in the CRM — editing an
// account's NOTES alone zeroed its credit limit and its negotiated discount,
// wiped its engine profiles, and flipped a suspended account back to 'active'.
export const UpdateB2BAccountInput = CreateB2BAccountInput.extend({
  creditLimit: z.number().min(0).max(99_999_999.99),
  discountPercent: z.number().min(0).max(100),
  status: B2BAccountStatus,
  engineProfiles: z.array(EngineProfile).max(100),
  // TagList's own `.default([])` survives too, so any edit cleared the tags.
  tags: TagListPatch,
}).partial();
export type UpdateB2BAccountInput = z.infer<typeof UpdateB2BAccountInput>;

// B2B account contacts — links a Customer to a B2BAccount with a role
// (packages/db/prisma/schema/62-b2b-contacts.prisma). This is the write path
// for what pricing (contract price), checkout (net-terms eligibility), and
// the storefront B2B portal (invoices/quotes/orders visibility) all key off.
export const B2bAccountContactRole = z.enum(['primary_contact', 'buyer', 'approver', 'viewer']);
export type B2bAccountContactRole = z.infer<typeof B2bAccountContactRole>;

export const CreateB2bAccountContactInput = z.object({
  customerId: Uuid,
  role: B2bAccountContactRole.default('buyer'),
});
export type CreateB2bAccountContactInput = z.infer<typeof CreateB2bAccountContactInput>;

export const UpdateB2bAccountContactInput = z.object({
  role: B2bAccountContactRole.optional(),
  isActive: z.boolean().optional(),
});
export type UpdateB2bAccountContactInput = z.infer<typeof UpdateB2bAccountContactInput>;
