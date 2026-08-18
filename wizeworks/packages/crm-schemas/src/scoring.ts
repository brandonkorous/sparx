// Scoring models (docs/144 §10) — the rules that turn a record into a number.
//
// ══════════════════════════════════════════════════════════════════════════
// WHY A SCORE IS A SUM AND NOT A LADDER
// ══════════════════════════════════════════════════════════════════════════
//
// Every rule whose condition matches contributes its points. There is no
// first-match, no ordering, no fallthrough.
//
// A first-match ladder is the other obvious design and it is worse for the person
// writing it: rules stop being independent statements about the record and become
// a sequence whose meaning depends on position, so inserting one in the middle
// silently changes what two others do. A sum lets each rule be read on its own —
// "replied to an email: +20" is true regardless of what sits above it — and makes
// "why is this 74" answerable by listing the rules that matched, in any order.
//
// The filter language is `ConditionGroup` from @wizeworks/automation-schemas, the same
// one automations and reports use. Three surfaces, one thing to learn.

import { z } from 'zod';
import { ConditionGroup, EMPTY_CONDITION_GROUP } from '@wizeworks/automation-schemas';

/**
 * One scoring rule: a question about the record and what it's worth.
 *
 * Points may be NEGATIVE, and that is not a curiosity — "unsubscribed: −40" and
 * "email bounced: −25" are the rules that stop a list of hot leads filling up
 * with people who cannot be contacted.
 */
export const ScoringRule = z.object({
  condition: ConditionGroup.default(EMPTY_CONDITION_GROUP),
  points: z.number().int().min(-1000).max(1000),
  /** What this rule says, in the business's own words — "Opened three emails".
   *  Shown on the record's score history, so a person reads reasons rather than
   *  a condition tree rendered back at them. */
  label: z.string().trim().min(1).max(160),
});
export type ScoringRule = z.infer<typeof ScoringRule>;

/** Which objects can carry a score today. Not an enum on the column — a
 *  tenant-invented object is scoreable in principle — but the surfaces only
 *  offer these two, because they are the ones with a resolver rich enough for
 *  the conditions to say anything. */
export const SCOREABLE_OBJECTS = ['contact', 'deal'] as const;

const ScoringBody = {
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(2000).nullish(),
  objectKey: z.string().min(2).max(63),
  propertyId: z.string().uuid().nullish(),
  /** Capped at 40. A model needing more than forty rules has stopped being a
   *  score and become a program, and it will not be maintainable by the person
   *  who has to answer for its numbers. */
  rules: z.array(ScoringRule).max(40).default([]),
  /**
   * Points bled off per day since the record last did anything.
   *
   * Without decay a score is a LIFETIME TOTAL: a contact who was keen a year ago
   * outranks one who replied this morning, and the top of the list slowly
   * fossilises into whoever has been in the database longest. Null = no decay,
   * which is correct for a deal-health model where stage matters more than
   * recency.
   */
  decayPerDay: z.number().min(0).max(100).nullish(),
  /** Scores clamp into [0, maxScore] so the number means the same thing on every
   *  record and a runaway rule cannot produce a 40,000. */
  maxScore: z.number().int().min(1).max(1000).default(100),
  isActive: z.boolean().default(true),
};

export const CreateScoringModelInput = z.object(ScoringBody);
export type CreateScoringModelInput = z.infer<typeof CreateScoringModelInput>;

// `.partial()` keeps a `.default()`, so a patch that never mentioned `rules`
// would arrive carrying the empty array and wipe the model. Same trap as the
// report and automation patch schemas; same fix.
export const UpdateScoringModelInput = z
  .object(ScoringBody)
  .partial()
  .extend({
    rules: z.array(ScoringRule).max(40).optional(),
    maxScore: z.number().int().min(1).max(1000).optional(),
    isActive: z.boolean().optional(),
  });
export type UpdateScoringModelInput = z.infer<typeof UpdateScoringModelInput>;

/** Move a record's score by hand — "this one's worth talking to, whatever the
 *  rules say". Recorded with `source: 'manual'` and the actor, so an unexplained
 *  jump in the history is always attributable. */
export const AdjustScoreInput = z.object({
  objectKey: z.string().min(2).max(63),
  recordId: z.string().uuid(),
  delta: z.number().int().min(-1000).max(1000),
  reason: z.string().trim().min(1).max(255),
});
export type AdjustScoreInput = z.infer<typeof AdjustScoreInput>;

/** Re-score records against the current model. Bounded per call — a tenant with
 *  200k contacts recomputing synchronously would hold a transaction open for
 *  minutes; the caller pages. */
export const RecomputeScoresInput = z.object({
  objectKey: z.string().min(2).max(63),
  /** Score just these records. Omitted = walk the object from `cursor`. */
  recordIds: z.array(z.string().uuid()).max(500).optional(),
  cursor: z.string().uuid().nullish(),
  limit: z.number().int().min(1).max(500).default(200),
});
export type RecomputeScoresInput = z.infer<typeof RecomputeScoresInput>;
