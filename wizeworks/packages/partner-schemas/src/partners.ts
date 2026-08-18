// Partner write + query schemas (docs/114 §B).
//
// Note on the .partial() footgun: update schemas here are defined EXPLICITLY as
// all-optional (never `CreateX.partial()`), so an omitted field is never
// clobbered back to a create-time default.

import { z } from 'zod';

import { CountryCode, PartnerKind, PartnerTier, SpecialtyList, Uuid } from './common';

// ── Public application (`POST /v1/public/partners/apply`) ────────────────────
// Submitted by a logged-out visitor OR an authed tenant. Informal auto-approves;
// registered/certified queue for review.
export const ApplyPartnerInput = z.object({
  name: z.string().trim().min(1).max(255),
  email: z.string().trim().toLowerCase().email().max(255),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  kind: PartnerKind.default('freelance'),
  // How they plan to use Sparx with clients (2–3 sentences).
  note: z.string().trim().max(2000).nullable().optional(),
  requestedTier: PartnerTier.default('informal'),
  // Honeypot — must be empty (bots fill it). Never persisted.
  company_website: z.string().max(0).optional(),
});
export type ApplyPartnerInput = z.infer<typeof ApplyPartnerInput>;

// ── Partner profile edit (`PUT /v1/partner/profile`) ─────────────────────────
// The public directory identity a partner controls. All-optional (a PATCH), no
// create defaults to clobber.
export const UpdatePartnerProfileInput = z.object({
  displayName: z.string().trim().min(1).max(255).optional(),
  bio: z.string().trim().max(2000).nullable().optional(),
  websiteUrl: z.string().trim().url().max(500).nullable().optional(),
  kind: PartnerKind.optional(),
  locationCity: z.string().trim().max(160).nullable().optional(),
  locationState: z.string().trim().max(120).nullable().optional(),
  locationCountry: CountryCode.nullable().optional(),
  isRemote: z.boolean().optional(),
  specialties: SpecialtyList.optional(),
  photoUrl: z.string().trim().url().max(1024).nullable().optional(),
  directoryVisible: z.boolean().optional(),
  payoutMinCents: z.number().int().min(5000).max(1_000_00).optional(),
});
export type UpdatePartnerProfileInput = z.infer<typeof UpdatePartnerProfileInput>;

// ── Self-serve join for an authed tenant (`POST /v1/partner/join`) ───────────
// Provisions the partner row for the current org. Informal is instant.
export const JoinPartnerInput = z.object({
  displayName: z.string().trim().min(1).max(255),
  requestedTier: PartnerTier.default('informal'),
  kind: PartnerKind.default('freelance'),
});
export type JoinPartnerInput = z.infer<typeof JoinPartnerInput>;

// ── Tier upgrade request (`POST /v1/partner/tier/apply`) ─────────────────────
export const ApplyTierInput = z.object({
  requestedTier: PartnerTier,
  note: z.string().trim().max(2000).nullable().optional(),
});
export type ApplyTierInput = z.infer<typeof ApplyTierInput>;

// ── Public directory query (`GET /v1/public/partners`) ───────────────────────
export const PartnerDirectoryQuery = z.object({
  tier: PartnerTier.optional(),
  specialty: z.string().trim().toLowerCase().max(40).optional(),
  // Free-text location match (city/state) OR the literal "remote".
  location: z.string().trim().max(160).optional(),
  remote: z.coerce.boolean().optional(),
  q: z.string().trim().max(120).optional(),
  cursor: z.string().max(255).optional(),
  limit: z.coerce.number().int().min(1).max(48).default(24),
});
export type PartnerDirectoryQuery = z.infer<typeof PartnerDirectoryQuery>;

// ── Internal / staff admin (shared-secret) ───────────────────────────────────
export const InternalSetTierInput = z.object({
  tier: PartnerTier,
});
export type InternalSetTierInput = z.infer<typeof InternalSetTierInput>;

export const InternalApproveApplicationInput = z.object({
  // The application to approve; the partner row is provisioned on its applicant org.
  applicationId: Uuid,
  tier: PartnerTier.optional(),
});
export type InternalApproveApplicationInput = z.infer<typeof InternalApproveApplicationInput>;

// The signup attribution hook — records a referral for the partner whose code was
// captured, keyed to the newly-created (referred) org. Cross-org write done under
// withTenant(partner.tenantId) server-side.
export const InternalRecordReferralInput = z.object({
  referralCode: z.string().trim().min(1).max(32),
  referredTenantId: Uuid,
});
export type InternalRecordReferralInput = z.infer<typeof InternalRecordReferralInput>;

// The billing hook — a referred org's first payment cleared; accrue commission.
export const InternalReferralPaymentInput = z.object({
  referredTenantId: Uuid,
  // First-month MRR the commission percentage is applied to (net of fees), cents.
  netMrrCents: z.number().int().min(0),
});
export type InternalReferralPaymentInput = z.infer<typeof InternalReferralPaymentInput>;
