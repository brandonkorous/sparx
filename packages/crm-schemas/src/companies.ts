// Company input schemas (docs/144 §11, was b2b-accounts / docs/10 §2).
//
// The record shape is one thing; who is allowed to see which half of it is
// another. Everything from `creditLimit` down to `engineProfiles` is the TRADE
// relationship and renders only when the `b2b` module is on — the schema still
// accepts them either way, because a tenant who turns the module on next month
// should find whatever an import or an integration already wrote, not a form
// that silently dropped it.

import { z } from 'zod';

import { CompanyStatus, PaymentTerms, TagList, TagListPatch, Uuid } from './common';

/**
 * An email domain, as a business owner would type it — `acme.com`, or
 * `@acme.com`, or occasionally `https://acme.com/` pasted from a browser.
 *
 * Normalised rather than rejected. A validation error on "you typed the @" is a
 * form arguing with someone who told it exactly what it needed to know.
 */
export const EmailDomain = z
  .string()
  .min(3)
  .max(255)
  .transform((raw) =>
    raw
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^@/, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
  )
  .refine((d) => /^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(d), {
    message: 'That does not look like a domain — try something like acme.com',
  });

// Engine profile shape stored in companies.engine_profiles JSONB. Used
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

export const CreateCompanyInput = z.object({
  companyName: z.string().min(1).max(255),
  taxId: z.string().max(64).nullable().optional(),
  website: z.string().url().max(2048).nullable().optional(),
  // The email domains that belong to this company (docs/144 §11). Capped at 20:
  // beyond that it is not a company's domains, it is a list of every address
  // somebody pasted, and the association offer stops being trustworthy.
  domains: z.array(EmailDomain).max(20).default([]),
  pricingTier: z.string().max(63).nullable().optional(),
  creditLimit: z.number().min(0).max(99_999_999.99).default(0),
  paymentTerms: PaymentTerms.nullable().optional(),
  discountPercent: z.number().min(0).max(100).default(0),
  status: CompanyStatus.default('active'),
  assignedRepId: Uuid.nullable().optional(),
  fleetSize: z.number().int().min(0).nullable().optional(),
  engineProfiles: z.array(EngineProfile).max(100).default([]),
  notes: z.string().max(10_000).nullable().optional(),
  tags: TagList.optional(),
  // Tenant-declared extra fields (docs/144 §3), validated by the service against
  // the `company` object definition. No `.default()` — this schema is the
  // sharpest instance of the trap described below, and a default here would wipe
  // the bag on every unrelated account edit.
  customProperties: z.record(z.string(), z.unknown()).optional(),
});
export type CreateCompanyInput = z.infer<typeof CreateCompanyInput>;

// The four re-declarations are load-bearing, for the same reason as
// UpdateDocumentWorkflowInput: `.partial()` makes a field optional but leaves its
// `.default(...)` intact, so Zod fabricates a value for every defaulted field the
// caller omitted, and companyService.update writes each field that is
// `!== undefined`. This is the sharpest instance in the CRM — editing an
// account's NOTES alone zeroed its credit limit and its negotiated discount,
// wiped its engine profiles, and flipped a suspended account back to 'active'.
export const UpdateCompanyInput = CreateCompanyInput.extend({
  creditLimit: z.number().min(0).max(99_999_999.99),
  discountPercent: z.number().min(0).max(100),
  status: CompanyStatus,
  engineProfiles: z.array(EngineProfile).max(100),
  // `domains` has a `.default([])` too, so without this line editing a company's
  // notes would clear every domain on it — and the association offer would go
  // quiet for that company with nothing on screen to say why.
  domains: z.array(EmailDomain).max(20),
  // TagList's own `.default([])` survives too, so any edit cleared the tags.
  tags: TagListPatch,
}).partial();
export type UpdateCompanyInput = z.infer<typeof UpdateCompanyInput>;

// B2B account contacts — links a Customer to a Company with a role
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
