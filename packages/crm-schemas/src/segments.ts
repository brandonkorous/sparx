// Segment input schemas.
//
// docs/11 §2. The rules field is validated against SegmentRuleSchema before
// insert/update so we never persist an unparseable predicate tree.

import { z } from 'zod';

import { SegmentRuleSchema } from './segment-rule';

const Slug = z
  .string()
  .min(1)
  .max(63)
  .regex(/^[a-z][a-z0-9-]*$/, 'Segment slug must be lowercase kebab-case');

/**
 * How membership is decided (docs/144 §10).
 *
 * `dynamic` — the rules decide, and the evaluator keeps it current. The only
 * kind that existed before, and still the default.
 * `static` — a hand-picked set. Someone (or an automation) puts people on it and
 * the evaluator leaves it entirely alone.
 *
 * Both are the same table and the same `segment_members` rows, so every consumer
 * of a segment — broadcasts, sequences, reports, the audience picker — takes
 * static lists without knowing they exist.
 */
export const SegmentKind = z.enum(['dynamic', 'static']);
export type SegmentKind = z.infer<typeof SegmentKind>;

export const CreateSegmentInput = z.object({
  // The site this audience draws from (docs/131 §5); explicit null = tenant-wide.
  // The dashboard route defaults it to the site being worked in.
  propertyId: z.string().uuid().nullable().optional(),
  name: z.string().min(1).max(120),
  slug: Slug,
  description: z.string().max(2000).nullable().optional(),
  kind: SegmentKind.default('dynamic'),
  /** Ignored while `kind` is `static`, and KEPT rather than cleared — a list
   *  switched to static and back should not have lost the rules someone wrote. */
  rules: SegmentRuleSchema,
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/)
    .optional()
    .nullable(),
});
export type CreateSegmentInput = z.infer<typeof CreateSegmentInput>;

// `.default()` survives `.partial()`, so `kind` is re-declared as a plain
// optional: without it, renaming a static list would silently convert it back to
// dynamic and the next recompute would empty it.
export const UpdateSegmentInput = CreateSegmentInput.partial().extend({
  kind: SegmentKind.optional(),
});
export type UpdateSegmentInput = z.infer<typeof UpdateSegmentInput>;

/** Put people on a static list, or take them off. Rejected on a dynamic list —
 *  a hand edit there would be silently undone by the next recompute, which is
 *  worse than being told no. */
export const ListMembershipInput = z.object({
  customerIds: z.array(z.string().uuid()).min(1).max(1000),
});
export type ListMembershipInput = z.infer<typeof ListMembershipInput>;
