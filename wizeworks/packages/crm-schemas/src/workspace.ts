// CRM workspace input schemas (docs/144 §11 + §12) — settings, saved views,
// meeting links, and document signatures.
//
// Four capabilities that share nothing except that each is about how a business
// WORKS its CRM rather than about a customer. They live in one file because
// splitting four small schemas across four files makes the import list longer
// without making anything clearer.

import { z } from 'zod';
import { ConditionGroup } from '@wizeworks/automation-schemas';

import { Uuid } from './common';

/* ── Settings ────────────────────────────────────────────────────────────── */

/**
 * What "the same person" means to this business.
 *
 * `email` is exact after lowercasing and trimming — the case where a duplicate
 * is beyond argument. `phone` compares digits only, so `(555) 010-3344` and
 * `5550103344` are one number. `name_company` is last name plus employer, which
 * is the weakest of the three and the reason a threshold exists at all.
 */
export const DuplicateMatchRule = z.enum(['email', 'phone', 'name_company']);
export type DuplicateMatchRule = z.infer<typeof DuplicateMatchRule>;

export const UpdateCrmSettingsInput = z.object({
  domainAssociation: z.boolean().optional(),
  duplicateMatchRules: z.array(DuplicateMatchRule).min(1).max(3).optional(),
  /**
   * Confidence above which the platform may merge without a person.
   *
   * Floored at 50 rather than 0 because a threshold below "more likely than not"
   * is not a threshold, and `null` already means "never". Capped at 100 because
   * 100 means "only when the match is beyond argument", which is the setting
   * most businesses that turn this on actually want.
   */
  autoMergeThreshold: z.number().int().min(50).max(100).nullable().optional(),
});
export type UpdateCrmSettingsInput = z.infer<typeof UpdateCrmSettingsInput>;

/* ── Saved views ─────────────────────────────────────────────────────────── */

export const ViewSort = z.object({
  field: z.string().min(1).max(120),
  direction: z.enum(['asc', 'desc']).default('desc'),
});
export type ViewSort = z.infer<typeof ViewSort>;

export const CreateSavedViewInput = z.object({
  objectKey: z.string().min(1).max(63),
  name: z.string().min(1).max(120),
  propertyId: Uuid.nullable().optional(),
  // The same filter DSL segments, automations and reports use. A business that
  // has written one automation condition already knows how to filter a list.
  filters: ConditionGroup.default({ logic: 'AND', conditions: [] }),
  // Empty = the surface's own default columns, which is what lets someone save
  // a filter without also having to make a decision about columns.
  columns: z.array(z.string().min(1).max(120)).max(40).default([]),
  sort: ViewSort.nullable().optional(),
  isShared: z.boolean().default(false),
  isDefault: z.boolean().default(false),
});
export type CreateSavedViewInput = z.infer<typeof CreateSavedViewInput>;

// Every defaulted field re-declared as a plain optional. `.partial()` leaves a
// `.default()` intact, so without this, renaming a view would silently clear its
// filters, its columns and its shared flag — the same trap the company schema
// carries a paragraph about.
export const UpdateSavedViewInput = z.object({
  name: z.string().min(1).max(120).optional(),
  filters: ConditionGroup.optional(),
  columns: z.array(z.string().min(1).max(120)).max(40).optional(),
  sort: ViewSort.nullable().optional(),
  isShared: z.boolean().optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateSavedViewInput = z.infer<typeof UpdateSavedViewInput>;

/* ── Meeting links ───────────────────────────────────────────────────────── */

export const Slug = z
  .string()
  .min(2)
  .max(63)
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'Use lowercase letters, numbers and dashes');

export const CreateMeetingLinkInput = z.object({
  serviceId: Uuid,
  slug: Slug,
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  propertyId: Uuid.nullable().optional(),
  /** Whose link it is. Defaults to the caller — the common case by far. */
  userId: Uuid.optional(),
  isActive: z.boolean().default(true),
});
export type CreateMeetingLinkInput = z.infer<typeof CreateMeetingLinkInput>;

export const UpdateMeetingLinkInput = z.object({
  serviceId: Uuid.optional(),
  slug: Slug.optional(),
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  isActive: z.boolean().optional(),
});
export type UpdateMeetingLinkInput = z.infer<typeof UpdateMeetingLinkInput>;

/* ── Document signatures ─────────────────────────────────────────────────── */

export const RequestSignatureInput = z.object({
  signerName: z.string().min(1).max(160),
  signerEmail: z.string().email().max(320),
  /**
   * How long the link works, in days. Fourteen by default: long enough that a
   * quote sent on a Friday survives a fortnight's holiday, short enough that a
   * link found in an old inbox two years later does nothing.
   */
  expiresInDays: z.number().int().min(1).max(90).default(14),
  /** Send the customer an email with the link. Off means "give me the link". */
  notify: z.boolean().default(true),
});
export type RequestSignatureInput = z.infer<typeof RequestSignatureInput>;

/**
 * What the customer did on the signing page.
 *
 * `typed` is a name they wrote; `drawn` is an SVG path. Neither is the evidence —
 * the token, the timestamp, the address and the frozen snapshot are. The mark is
 * what makes a person feel they signed something, which is not nothing, but it
 * is not what would be produced in a dispute.
 */
export const SignatureMark = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('typed'), value: z.string().min(1).max(160) }),
  z.object({ kind: z.literal('drawn'), value: z.string().min(1).max(100_000) }),
]);
export type SignatureMark = z.infer<typeof SignatureMark>;

export const SignDocumentInput = z.object({
  token: z.string().min(20).max(200),
  mark: SignatureMark,
  /** Typed by the signer on the page — may differ from who it was addressed to. */
  signerName: z.string().min(1).max(160).optional(),
});
export type SignDocumentInput = z.infer<typeof SignDocumentInput>;

export const DeclineDocumentInput = z.object({
  token: z.string().min(20).max(200),
  reason: z.string().max(500).optional(),
});
export type DeclineDocumentInput = z.infer<typeof DeclineDocumentInput>;
