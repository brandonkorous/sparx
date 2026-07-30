// Email-sequence shapes — the client-safe contract (zod only, NO @sparx/db import),
// so the workbench editor imports these without pulling Prisma into the browser
// bundle (the `@sparx/cms-editor/serialize` pattern). The server half
// (@sparx/email-sequences) re-uses the same schemas to validate at the db boundary.

import { z } from 'zod';

// ─── vocabularies ─────────────────────────────────────────────────────────────

/** `email_sequences.status`. draft = editing; active = enrolling + draining;
 *  archived = stopped (no new enrollments, in-flight ones stop draining). */
export const SEQUENCE_STATUSES = ['draft', 'active', 'archived'] as const;
export const SequenceStatus = z.enum(SEQUENCE_STATUSES);
export type SequenceStatus = z.infer<typeof SequenceStatus>;

/** Re-enrollment policy. `once` = a person may be enrolled at most once, ever.
 *  `always` = they may be re-enrolled any time they are not CURRENTLY active (the
 *  partial-unique active_dedupe index guarantees no double-active either way). */
export const REENTRY_POLICIES = ['once', 'always'] as const;
export const ReentryPolicy = z.enum(REENTRY_POLICIES);
export type ReentryPolicy = z.infer<typeof ReentryPolicy>;

/** `email_sequence_enrollments.status`. */
export const ENROLLMENT_STATUSES = ['active', 'completed', 'exited', 'cancelled'] as const;
export const EnrollmentStatus = z.enum(ENROLLMENT_STATUSES);
export type EnrollmentStatus = z.infer<typeof EnrollmentStatus>;

/** Declared intent of a step's email — drives suppression scope + the compliance
 *  gate at dispatch, exactly like a one-shot email.send_campaign (docs/91 §8). */
export const EmailType = z.enum(['transactional', 'marketing']);
export type EmailType = z.infer<typeof EmailType>;

// ─── a step ───────────────────────────────────────────────────────────────────

/**
 * Where a step's email body comes from — the same three sources a one-shot
 * `email.send_campaign` accepts, as a discriminated union so the editor can switch
 * cleanly and config can't carry more than one:
 *   • builder  — a designed Builder email by row id (a tenant's own email)
 *   • builtin  — a provisioned default by key (welcome-customer, abandoned-cart, …)
 *   • template — a coded React-Email component by name (+ props)
 */
export const StepEmailSource = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('builder'), builderEmailId: z.string().uuid() }),
  z.object({ kind: z.literal('builtin'), builderEmailKey: z.string().min(1).max(120) }),
  z.object({
    kind: z.literal('template'),
    template: z.string().min(1).max(120),
    props: z.record(z.string(), z.unknown()).optional(),
  }),
]);
export type StepEmailSource = z.infer<typeof StepEmailSource>;

/** One step: wait `delaySeconds`, then send the email. `delaySeconds` is the pause
 *  BEFORE this step, measured from the previous step's send (or from enrollment for
 *  the first step) — so `[0, 2h, 1d]` means "send now, then +2h, then +1d". Capped
 *  at one year. `id` is a stable client id for React keys + reordering. */
export const SequenceStep = z.object({
  id: z.string().min(1).max(64),
  name: z.string().max(255).optional(),
  delaySeconds: z
    .number()
    .int()
    .min(0)
    .max(365 * 24 * 60 * 60),
  emailType: EmailType.default('marketing'),
  subject: z.string().min(1).max(255).optional(),
  preheader: z.string().max(255).optional(),
  source: StepEmailSource,
});
export type SequenceStep = z.infer<typeof SequenceStep>;

/** The ordered step list — a sequence's whole document. Capped at 25 touches
 *  (beyond that it isn't a journey, it's a mailing list). */
export const SequenceSteps = z.array(SequenceStep).max(25);
export type SequenceSteps = z.infer<typeof SequenceSteps>;

// ─── CRUD inputs ────────────────────────────────────────────────────────────

export const CreateSequenceInput = z.object({
  name: z.string().min(1).max(255),
  description: z.string().max(10_000).nullish(),
  /** The site this journey belongs to; null/omitted = tenant-wide. The authoring
   *  UI defaults it to the working site. */
  propertyId: z.string().uuid().nullish(),
  reentryPolicy: ReentryPolicy.default('once'),
  exitOnPurchase: z.boolean().default(false),
  steps: SequenceSteps.default([]),
});
export type CreateSequenceInput = z.infer<typeof CreateSequenceInput>;

// The three defaulted fields are re-declared without their defaults: a
// `.default()` survives `.partial()`, and the service writes every key that
// isn't undefined — so renaming a sequence DELETED ALL OF ITS STEPS (steps
// defaults to `[]`), emptying the whole email flow, and reset its re-entry and
// exit-on-purchase rules along with it.
export const UpdateSequenceInput = CreateSequenceInput.partial().extend({
  status: SequenceStatus.optional(),
  reentryPolicy: ReentryPolicy.optional(),
  exitOnPurchase: z.boolean().optional(),
  steps: SequenceSteps.optional(),
});
export type UpdateSequenceInput = z.infer<typeof UpdateSequenceInput>;

// ─── enrollment input (server-side: the action executor + manual REST enroll) ──

export const EnrollInput = z.object({
  /** Soft CRM reference. Used for the goal-exit check + the designed email's
   *  DataSource resolution. */
  customerId: z.string().uuid().nullish(),
  /** The send address. Optional when `customerId` is given (resolved from the
   *  customer); required otherwise. */
  recipientEmail: z.string().email().nullish(),
  /** Which automation enrolled them (provenance). */
  sourceAutomationId: z.string().uuid().nullish(),
  /** Entity refs captured at enroll so each step's designed email resolves its
   *  DataSources (cartId / orderId / …), same shape as enqueueSend's entityRefs. */
  sourceRefs: z.record(z.string(), z.union([z.string(), z.null()])).nullish(),
});
export type EnrollInput = z.infer<typeof EnrollInput>;

/** Why an enroll was refused — surfaced so a caller (or the run-step log) can say
 *  exactly why nobody was added. */
export type EnrollSkipReason =
  | 'sequence_not_found'
  | 'sequence_inactive'
  | 'no_steps'
  | 'no_recipient'
  | 'do_not_contact'
  | 'already_enrolled'
  | 'already_active';

export interface EnrollResult {
  enrolled: boolean;
  enrollmentId?: string;
  reason?: EnrollSkipReason;
}
