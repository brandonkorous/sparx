// Shared primitive + enum schemas for the Partner Program (docs/114).
//
// Every enum mirrors a `@db.VarChar` column value set in 83-partners.prisma /
// 84-bootcamps.prisma. The service + route layer validates against these before
// any Prisma write, keeping column writes type-safe across REST / Server Actions.

import { z } from 'zod';

export const Uuid = z.string().uuid();
export const OptionalUuid = Uuid.nullable().optional();

// ISO-8601 instant. Stored as timestamptz; the API normalizes to UTC.
export const IsoDateTime = z.string().datetime();

// ISO-3166-1 alpha-2 country code (VARCHAR(2)).
export const CountryCode = z
  .string()
  .trim()
  .length(2)
  .transform((s) => s.toUpperCase());

// ── Partner enums ────────────────────────────────────────────────────────────

// Commission tiers (docs/114 §B.4). informal 20% · registered 30% · certified 30%+5%.
export const PartnerTier = z.enum(['informal', 'registered', 'certified']);
export type PartnerTier = z.infer<typeof PartnerTier>;

export const PartnerStatus = z.enum(['pending', 'active', 'suspended']);
export type PartnerStatus = z.infer<typeof PartnerStatus>;

// "What best describes you?" on the application.
export const PartnerKind = z.enum(['freelance', 'agency', 'developer', 'other']);
export type PartnerKind = z.infer<typeof PartnerKind>;

export const ApplicationStatus = z.enum(['pending', 'approved', 'rejected']);
export type ApplicationStatus = z.infer<typeof ApplicationStatus>;

export const ReferralStatus = z.enum(['pending', 'active', 'churned', 'forfeited']);
export type ReferralStatus = z.infer<typeof ReferralStatus>;

export const CommissionType = z.enum(['one_time', 'ongoing']);
export type CommissionType = z.infer<typeof CommissionType>;

export const CommissionStatus = z.enum(['pending', 'approved', 'paid', 'forfeited']);
export type CommissionStatus = z.infer<typeof CommissionStatus>;

export const PayoutStatus = z.enum(['pending', 'processing', 'paid', 'failed']);
export type PayoutStatus = z.infer<typeof PayoutStatus>;

// The directory's known specialty facets. The column is a free-text[] so custom
// tags are allowed, but these drive the facet UI + are the canonical labels.
export const KNOWN_SPECIALTIES = [
  'ecommerce',
  'b2b',
  'crm',
  'email',
  'design',
  'seo',
  'content',
  'migration',
  'automation',
  'analytics',
] as const;
export const Specialty = z.enum(KNOWN_SPECIALTIES);
export type Specialty = z.infer<typeof Specialty>;

// A partner's specialty tags — lowercased, deduped, capped. Free text (not the
// enum) so a partner can list a niche, but each tag is short + slug-ish.
export const SpecialtyList = z
  .array(z.string().trim().toLowerCase().min(1).max(40))
  .max(12)
  .transform((tags) => Array.from(new Set(tags)));

// ── Bootcamp enums ───────────────────────────────────────────────────────────

export const BootcampFormat = z.enum(['in_person', 'virtual', 'hybrid', 'async']);
export type BootcampFormat = z.infer<typeof BootcampFormat>;

export const BootcampStatus = z.enum(['draft', 'published', 'cancelled', 'completed']);
export type BootcampStatus = z.infer<typeof BootcampStatus>;

export const RegistrationMode = z.enum(['internal', 'external']);
export type RegistrationMode = z.infer<typeof RegistrationMode>;

export const RegistrationStatus = z.enum(['registered', 'waitlisted', 'cancelled', 'attended']);
export type RegistrationStatus = z.infer<typeof RegistrationStatus>;
