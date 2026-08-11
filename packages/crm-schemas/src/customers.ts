// Customer input schemas.
//
// Validation contract for the customer write path. The service layer wraps
// every Prisma write with one of these schemas — the locked customers-table
// architecture (decision #1: one table, type-aware) means every customer
// goes through these same shapes regardless of whether they originate as a
// prospect, a guest checkout, or a B2B contact.

import { z } from 'zod';

import {
  CustomerType,
  LeadStatus,
  LifecycleStage,
  PreferredContactMethod,
  TagList,
  TagListPatch,
  Uuid,
} from './common';

/**
 * An email address, stored the way it will be compared.
 *
 * TRIMMED AND LOWERCASED ON THE WAY IN, because both unique indexes on
 * `customers` compare raw text. Without this, `Jane@example.com` and
 * `jane@example.com` are two different contacts to the database and one person
 * to everybody else — the same "one person, two records" bug the indexes exist
 * to prevent, entering through a door they do not watch. A trailing space does
 * the same thing and is easier to do by accident, because it is invisible.
 *
 * Addresses are case-insensitive in every mail system anybody actually uses;
 * the case somebody typed carries no information worth a split history. Kept
 * here rather than in the service so that REST, MCP, GraphQL, importers and the
 * storefront signup all normalise identically — a rule enforced at one write
 * path is a rule the next write path will not have.
 *
 * Duplicate DETECTION already lowercases when it compares, so the mixed-case
 * pairs created before this shipped surface in the Duplicates screen rather
 * than needing a backfill — and a backfill would be the dangerous option, since
 * lowercasing two rows that then collide would fail against those same indexes.
 */
const EmailAddress = z.string().trim().toLowerCase().pipe(z.string().email().max(255));

// GDPR consent shape (stored in customers.gdpr_consent JSONB).
// Captured at the moment consent was granted; never mutated retroactively.
const GdprConsent = z.object({
  grantedAt: z.string().datetime().optional(),
  source: z.enum(['signup', 'checkout', 'import', 'admin', 'api']).optional(),
  scope: z.array(z.enum(['marketing', 'transactional', 'profiling'])).optional(),
  ipAddress: z.string().optional(),
});
export type GdprConsent = z.infer<typeof GdprConsent>;

export const CreateCustomerInput = z.object({
  // The three classification axes (docs/137). Relationship type defaults to a
  // retail individual; a hand-added contact starts life as a `lead`; lead status
  // is optional (only set while a lead is being worked).
  type: CustomerType.default('retail'),
  lifecycleStage: LifecycleStage.default('lead'),
  leadStatus: LeadStatus.nullable().optional(),
  // The site (web property) this customer belongs to (docs/58 D2). Null/absent →
  // a tenant-level (GLOBAL) customer, visible from every site's scoped list. The
  // dashboard create route defaults this to the ACTIVE site for multi-site
  // tenants, so a customer created while viewing a site belongs to that site.
  propertyId: Uuid.nullable().optional(),
  email: EmailAddress.nullable().optional(),
  phone: z.string().max(50).nullable().optional(),
  firstName: z.string().max(255).nullable().optional(),
  lastName: z.string().max(255).nullable().optional(),
  company: z.string().max(255).nullable().optional(),
  jobTitle: z.string().max(255).nullable().optional(),
  companyId: Uuid.nullable().optional(),
  assignedRepId: Uuid.nullable().optional(),
  preferredContactMethod: PreferredContactMethod.nullable().optional(),
  doNotContact: z.boolean().default(false),
  gdprConsent: GdprConsent.optional(),
  tags: TagList.optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
  // The extra details THIS business tracks (docs/144 §3). Validated by the
  // service against the tenant's `contact` object definition — not here, because
  // the shape is per-tenant and only the service can read it. No `.default()`:
  // omitting it must mean "leave the bag alone", and a default would survive
  // `.partial()` below and wipe it on every unrelated edit.
  customProperties: z.record(z.string(), z.unknown()).optional(),
  // Optional profile photo — a MediaAsset id (cms module). `null` clears it.
  avatarMediaAssetId: Uuid.nullable().optional(),
});
export type CreateCustomerInput = z.infer<typeof CreateCustomerInput>;

// Same defaults-survive-`.partial()` trap as UpdateCompanyInput, and the one
// with a consent consequence: customerService.update writes every field that is
// `!== undefined`, so editing a phone number alone DEMOTED the customer's
// lifecycle stage back to 'lead', reset their relationship type to 'retail', and
// — worst — cleared `doNotContact`, re-opening someone who had asked not to be
// contacted. Re-declared without defaults so an omitted field stays untouched.
export const UpdateCustomerInput = CreateCustomerInput.extend({
  type: CustomerType,
  lifecycleStage: LifecycleStage,
  doNotContact: z.boolean(),
  // TagList carries `.default([])`, which survives `.partial()` — so without
  // this every customer edit deleted the customer's tags. See TagListPatch.
  tags: TagListPatch,
}).partial();
export type UpdateCustomerInput = z.infer<typeof UpdateCustomerInput>;

// Newsletter / email-capture subscribe — the marketing opt-in path shared by the
// storefront "Email signup" block (docs/51 §7, via /v1/public/signup) and the
// generic named-list capture (/v1/public/newsletter, e.g. the sparx.works /early
// waitlist). Deliberately minimal: a visitor hands over an email (and maybe a
// name) and opts into marketing. The service upserts on the (tenant, property,
// email) identity and folds `marketing` into gdpr_consent, so a repeat submit is
// idempotent rather than a unique-constraint error. No classification here — an
// opt-in says nothing about how someone transacts, so a fresh capture takes the
// default relationship type and lands at lifecycle `subscriber`; an existing
// customer keeps whatever they already carry on all three axes.
export const SubscribeCustomerInput = z.object({
  email: EmailAddress,
  // The site (web property) the form was on (docs/58 D2). Null → a tenant-level
  // contact not tied to a site. Resolved from the `?property=` slug at the edge.
  propertyId: Uuid.nullable().optional(),
  firstName: z.string().max(255).nullable().optional(),
  lastName: z.string().max(255).nullable().optional(),
  // Where the opt-in came from — stamped into gdpr_consent.source. Defaults to
  // 'signup' (the newsletter block); 'checkout' for the marketing opt-in at checkout.
  source: z.enum(['signup', 'checkout', 'api']).default('signup'),
  // Captured server-side as proof of the opt-in (mirrors the consent record).
  ipAddress: z.string().optional(),
  // The named marketing list this opt-in joins (e.g. 'early-access', 'newsletter').
  // Stamped onto the customer as a TAG, so the list is a filterable, segment-
  // targetable slice — the matching built-in segment (if any) materializes
  // membership from the tag. Null/absent → the generic opt-in with no list tag.
  list: z
    .string()
    .min(1)
    .max(63)
    .regex(/^[a-z0-9-]+$/, 'list must be a kebab-case slug')
    .nullable()
    .optional(),
  // Free-text context captured with the opt-in (e.g. the waitlist "what are you
  // building?" prompt). Stored under customer.metadata.signup; never clobbers an
  // existing note on re-subscribe (the first answer is the durable one).
  note: z.string().max(2000).nullable().optional(),
  // Extra structured context shallow-merged under customer.metadata.signup (e.g.
  // the capture page or a marketing-attribution touch). For first-party callers
  // only — never populated from raw untrusted client input.
  metadata: z.record(z.string(), z.unknown()).optional(),
});
export type SubscribeCustomerInput = z.infer<typeof SubscribeCustomerInput>;

// Merge — picks a primary and a list of duplicates to fold into it.
// Service-layer enforces tenant-id match on every id; database-layer RLS is
// the backstop.
export const MergeCustomersInput = z.object({
  primaryCustomerId: Uuid,
  duplicateCustomerIds: z.array(Uuid).min(1).max(20),
});
export type MergeCustomersInput = z.infer<typeof MergeCustomersInput>;

// Bulk operations — used by the dashboard's bulk-action menu and by the
// MCP bulk_assign_customers / bulk_tag_customers tools.
export const BulkAssignCustomersInput = z.object({
  customerIds: z.array(Uuid).min(1).max(500),
  assignedRepId: Uuid.nullable(),
});
export type BulkAssignCustomersInput = z.infer<typeof BulkAssignCustomersInput>;

export const BulkTagCustomersInput = z.object({
  customerIds: z.array(Uuid).min(1).max(500),
  addTags: z.array(z.string().min(1).max(63)).optional(),
  removeTags: z.array(z.string().min(1).max(63)).optional(),
});
export type BulkTagCustomersInput = z.infer<typeof BulkTagCustomersInput>;

// Customer address — separate row in customer_addresses.
export const CreateCustomerAddressInput = z.object({
  customerId: Uuid,
  type: z.enum(['shipping', 'billing', 'both']),
  label: z.string().max(120).optional(),
  isDefault: z.boolean().default(false),
  recipientName: z.string().max(255).optional(),
  company: z.string().max(255).optional(),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(120),
  region: z.string().max(120).optional(),
  postalCode: z.string().max(32).optional(),
  country: z
    .string()
    .length(2)
    .regex(/^[A-Z]{2}$/, 'Country must be ISO 3166-1 alpha-2 (e.g. "US")'),
  phone: z.string().max(50).optional(),
});
export type CreateCustomerAddressInput = z.infer<typeof CreateCustomerAddressInput>;

// `isDefault` is re-declared without its create-default for the reason spelled
// out on UpdateCustomerInput: the default survives `.partial()`, so editing a
// street line on the DEFAULT address silently demoted it (isDefault → false),
// leaving the customer with no default address at all.
export const UpdateCustomerAddressInput = CreateCustomerAddressInput.omit({
  customerId: true,
})
  .extend({ isDefault: z.boolean() })
  .partial();
export type UpdateCustomerAddressInput = z.infer<typeof UpdateCustomerAddressInput>;

// Customer document — a file (already uploaded to the media pipeline) attached to
// a customer, plus an optional human label. `customerId` comes from the path.
export const CreateCustomerDocumentInput = z.object({
  mediaAssetId: Uuid,
  label: z.string().trim().min(1).max(200).optional(),
});
export type CreateCustomerDocumentInput = z.infer<typeof CreateCustomerDocumentInput>;
