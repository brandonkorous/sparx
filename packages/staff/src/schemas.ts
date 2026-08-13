// Zod shapes for the staff module — the one place the vocabulary is spelled out
// for the API, MCP, and anything else that takes input from outside.
//
// Every enum here mirrors a CHECK constraint in the migration. When they drift,
// the database wins and the caller gets a 500 instead of a 400 — so they are
// deliberately adjacent and named the same.

import { z } from 'zod';

export const employmentTypeSchema = z.enum(['employee', 'contractor', 'volunteer']);
export const staffStatusSchema = z.enum(['active', 'onboarding', 'suspended', 'former']);
export const payBasisSchema = z.enum(['hourly', 'salary', 'commission', 'none']);
export const timeEntryStatusSchema = z.enum(['open', 'submitted', 'approved', 'rejected']);
export const timeEntrySourceSchema = z.enum(['clock', 'manual', 'import']);
export const shiftStatusSchema = z.enum(['draft', 'published', 'cancelled']);
export const timeOffKindSchema = z.enum(['vacation', 'sick', 'unpaid', 'other']);
export const timeOffStatusSchema = z.enum(['requested', 'approved', 'denied', 'cancelled']);
export const documentKindSchema = z.enum(['contract', 'handbook', 'id', 'certification', 'other']);
export const commissionSourceSchema = z.enum(['order', 'deal']);
export const commissionStatusSchema = z.enum(['pending', 'approved', 'paid', 'void']);

/** A job a person can work ON — the same two targets a finance allocation uses,
 *  narrowed from its five because nobody logs hours against a product. */
export const jobTypeSchema = z.enum(['order', 'booking']);

export const staffMemberCreateSchema = z.object({
  firstName: z.string().trim().min(1).max(120),
  lastName: z.string().trim().max(120).nullish(),
  email: z.string().trim().max(255).nullish(),
  phone: z.string().trim().max(40).nullish(),
  jobTitle: z.string().trim().max(120).nullish(),
  employmentType: employmentTypeSchema.optional(),
  status: staffStatusSchema.optional(),
  startedOn: z.coerce.date().nullish(),
  endedOn: z.coerce.date().nullish(),
  userId: z.string().uuid().nullish(),
  resourceId: z.string().uuid().nullish(),
  externalPayrollId: z.string().trim().max(120).nullish(),
  color: z.string().trim().max(7).nullish(),
  photoUrl: z.string().trim().max(2048).nullish(),
  notes: z.string().max(5000).nullish(),
  siteIds: z.array(z.string().uuid()).max(50).optional(),
  primarySiteId: z.string().uuid().nullish(),
});

export const staffMemberUpdateSchema = staffMemberCreateSchema.partial();

export const payRateSchema = z
  .object({
    basis: payBasisSchema,
    // Cents. Per hour under `hourly`, per YEAR under `salary`. The CHECK also
    // enforces zero on `none`; validating it here means the caller gets a clear
    // 400 rather than a constraint violation.
    amountCents: z.number().int().min(0).max(2_000_000_000),
    currency: z.string().length(3).optional(),
    // Employer burden as a percentage. Capped at 200 for the same reason the
    // CHECK caps it: a typo of 2200 would triple a year of wages silently.
    burdenPercent: z.number().min(0).max(200).optional(),
    effectiveFrom: z.coerce.date(),
    effectiveTo: z.coerce.date().nullish(),
    note: z.string().max(2000).nullish(),
  })
  .refine((v) => v.basis !== 'none' || v.amountCents === 0, {
    message: 'A pay basis of "none" cannot carry an amount.',
    path: ['amountCents'],
  })
  .refine((v) => !v.effectiveTo || v.effectiveTo >= v.effectiveFrom, {
    message: 'The end date cannot be before the start date.',
    path: ['effectiveTo'],
  });

export const timeEntryCreateSchema = z
  .object({
    staffMemberId: z.string().uuid(),
    workedOn: z.coerce.date(),
    minutes: z.number().int().min(0).max(1440),
    breakMinutes: z.number().int().min(0).max(1440).optional(),
    propertyId: z.string().uuid().nullish(),
    jobType: jobTypeSchema.nullish(),
    jobId: z.string().uuid().nullish(),
    note: z.string().max(2000).nullish(),
    source: timeEntrySourceSchema.optional(),
  })
  // Both halves of the job reference travel together — a job id with no type
  // cannot be resolved, and a type with no id is a label pretending to be a link.
  // The same pairing is a CHECK on the table.
  .refine((v) => (v.jobType ? Boolean(v.jobId) : !v.jobId), {
    message: 'Pick what the time was for, or leave the job blank entirely.',
    path: ['jobId'],
  });

export const timeEntryUpdateSchema = z.object({
  workedOn: z.coerce.date().optional(),
  minutes: z.number().int().min(0).max(1440).optional(),
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  propertyId: z.string().uuid().nullish(),
  jobType: jobTypeSchema.nullish(),
  jobId: z.string().uuid().nullish(),
  note: z.string().max(2000).nullish(),
});

export const clockInSchema = z.object({
  staffMemberId: z.string().uuid(),
  at: z.coerce.date().optional(),
  propertyId: z.string().uuid().nullish(),
  jobType: jobTypeSchema.nullish(),
  jobId: z.string().uuid().nullish(),
});

export const clockOutSchema = z.object({
  staffMemberId: z.string().uuid(),
  at: z.coerce.date().optional(),
  breakMinutes: z.number().int().min(0).max(1440).optional(),
  note: z.string().max(2000).nullish(),
});

export const approveTimeSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(500),
});

export const shiftSchema = z
  .object({
    staffMemberId: z.string().uuid(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    propertyId: z.string().uuid().nullish(),
    label: z.string().trim().max(120).nullish(),
    status: shiftStatusSchema.optional(),
    notes: z.string().max(2000).nullish(),
  })
  .refine((v) => v.endsAt > v.startsAt, {
    message: 'A shift has to end after it starts.',
    path: ['endsAt'],
  });

export const timeOffSchema = z
  .object({
    staffMemberId: z.string().uuid(),
    kind: timeOffKindSchema.optional(),
    startsAt: z.coerce.date(),
    endsAt: z.coerce.date(),
    allDay: z.boolean().optional(),
    reason: z.string().max(2000).nullish(),
  })
  .refine((v) => v.endsAt >= v.startsAt, {
    message: 'Time off has to end on or after it starts.',
    path: ['endsAt'],
  });

export const timeOffDecisionSchema = z.object({
  status: z.enum(['approved', 'denied']),
  note: z.string().max(2000).nullish(),
});

export const certificationSchema = z.object({
  staffMemberId: z.string().uuid(),
  name: z.string().trim().min(1).max(200),
  issuer: z.string().trim().max(200).nullish(),
  referenceNumber: z.string().trim().max(120).nullish(),
  issuedOn: z.coerce.date().nullish(),
  // Nullable on purpose: a qualification that does not expire is a real answer,
  // not a missing one.
  expiresOn: z.coerce.date().nullish(),
  reminderLeadDays: z.number().int().min(0).max(365).optional(),
  documentId: z.string().uuid().nullish(),
  notes: z.string().max(5000).nullish(),
});

export const documentSchema = z.object({
  staffMemberId: z.string().uuid(),
  assetId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  kind: documentKindSchema.optional(),
  signedAt: z.coerce.date().nullish(),
  expiresOn: z.coerce.date().nullish(),
});

export const commissionSchema = z.object({
  staffMemberId: z.string().uuid(),
  sourceType: commissionSourceSchema,
  sourceId: z.string().uuid(),
  sourceLabel: z.string().trim().max(200).nullish(),
  basisCents: z.number().int().min(0),
  ratePercent: z.number().min(0).max(100).nullish(),
  amountCents: z.number().int().min(0),
  currency: z.string().length(3).optional(),
  earnedOn: z.coerce.date(),
  propertyId: z.string().uuid().nullish(),
  note: z.string().max(2000).nullish(),
});

export const derivePeriodSchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  /** Omit to derive the whole roster for the period. */
  staffMemberId: z.string().uuid().optional(),
});
