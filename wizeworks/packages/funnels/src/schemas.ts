// Funnel shapes — the client-safe contract (zod only, NO @wizeworks/db import),
// so the workbench editor imports these without pulling Prisma into the browser
// bundle. The server half re-uses the same schemas to validate at the db
// boundary, the same split @wizeworks/email-sequences keeps.

import { z } from 'zod';
import { ConditionGroup } from '@wizeworks/automation-schemas';

// ─── vocabularies ─────────────────────────────────────────────────────────────

/** `funnels.status`. A funnel only MEASURES while `active`: draft is being
 *  written, paused stops recording without losing history, archived is retired.
 *  Mirrored by a CHECK constraint in the migration. */
export const FUNNEL_STATUSES = ['draft', 'active', 'paused', 'archived'] as const;
export const FunnelStatus = z.enum(FUNNEL_STATUSES);
export type FunnelStatus = z.infer<typeof FunnelStatus>;

/** `funnels.kind`. Drives the DEFAULT ladder and the recipe gallery's grouping —
 *  a starting shape, never a constraint. `custom` exists so this list never has
 *  to grow just because somebody sells something we did not anticipate. */
export const FUNNEL_KINDS = [
  'lead',
  'recovery',
  'purchase',
  'booking',
  'winback',
  'custom',
] as const;
export const FunnelKind = z.enum(FUNNEL_KINDS);
export type FunnelKind = z.infer<typeof FunnelKind>;

/**
 * What a rung DOES, which is not the same as what it is called.
 *
 * The kind is what the UI reads to decide how to draw a stage and what the
 * engine reads to decide what may write one:
 *   · view    — reached anonymously. Counted in the rollup, never in stage events.
 *   · capture — THE LINE. The first rung a named person exists at.
 *   · qualify — they told us something that scores them.
 *   · engage  — they came back, opened, clicked, replied.
 *   · convert — the outcome the funnel exists for. Carries `valueCents`.
 *
 * Exactly one `convert` stage per ladder, and it must be last — see
 * `FunnelStages` below for why that is enforced rather than documented.
 */
export const STAGE_KINDS = ['view', 'capture', 'qualify', 'engage', 'convert'] as const;
export const StageKind = z.enum(STAGE_KINDS);
export type StageKind = z.infer<typeof StageKind>;

// ─── a stage ──────────────────────────────────────────────────────────────────

/**
 * One rung.
 *
 * `key` is the stable identity — it is what `funnel_stage_events.stage_key` and
 * `rollup_funnel_daily.stage_key` record, so renaming a stage's display `name`
 * must never orphan its history. The editor mints a key once and never rewrites
 * it; changing a key is deleting a stage and adding a different one, and the
 * history follows the key rather than the position.
 */
export const FunnelStage = z.object({
  key: z
    .string()
    .min(1)
    .max(63)
    // Lower snake/kebab only. It appears in URLs, report groupings and MCP
    // arguments, so a key with a space or a capital in it is a bug waiting for
    // somebody to hit it from a different direction.
    .regex(/^[a-z0-9][a-z0-9_-]*$/, 'Use lower-case letters, numbers, - and _.'),
  name: z.string().min(1).max(120),
  kind: StageKind,
  /**
   * WHICH PAGE counts as this rung. `view` stages only, and the only field on a
   * stage that the anonymous half reads.
   *
   * A view rung is never a row — it is a COUNT of distinct visitors to a path,
   * derived from `site_analytics_events`, which is the one place the rotating
   * visitor hash legitimately lives. So the rung has to say which path, and it
   * is matched EXACTLY against the beacon's normalized path (query and hash
   * stripped, trailing slash folded). Omitted → the funnel's entry page.
   */
  path: z.string().min(1).max(2048).optional(),
  /** What counts as reaching this rung, in the SAME condition language as
   *  automations and scoring. Empty group = "anything that gets here counts",
   *  which is the right default for a stage the engine is told about explicitly
   *  rather than one it has to recognize. */
  match: ConditionGroup.optional(),
});
export type FunnelStage = z.infer<typeof FunnelStage>;

/**
 * The ordered ladder.
 *
 * Three invariants, enforced here rather than written down, because every one of
 * them is silent when it breaks:
 *
 *  1. **Keys are unique.** Two rungs sharing a key merge in every report and
 *     nobody can tell which one a number came from.
 *  2. **Exactly one `convert`.** The conversion count and the attributed value
 *     both come from that rung; two of them double-counts revenue, none of them
 *     makes the goal unmeasurable while the funnel still looks configured.
 *  3. **`convert` is last.** A ladder is a sequence of narrowing, and a rung
 *     below the conversion is a rung nobody can reach without converting first —
 *     which is a different funnel, drawn wrong.
 */
export const FunnelStages = z
  .array(FunnelStage)
  .min(1, 'A funnel needs at least one stage.')
  .max(12, 'Twelve stages is already more ladder than anyone reads.')
  .superRefine((stages, ctx) => {
    const seen = new Set<string>();
    for (const [i, stage] of stages.entries()) {
      if (seen.has(stage.key)) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'key'],
          message: `Two stages share the key "${stage.key}".`,
        });
      }
      seen.add(stage.key);

      // A path on a rung that is not a view would be silently ignored: only the
      // anonymous half reads it, and everything below the capture line is
      // recorded by a subject rather than found on a page.
      if (stage.path !== undefined && stage.kind !== 'view') {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'path'],
          message: 'Only a stage people reach by visiting a page can name one.',
        });
      }
      if (stage.path !== undefined && !stage.path.startsWith('/')) {
        ctx.addIssue({
          code: 'custom',
          path: [i, 'path'],
          message: 'A page address starts with a slash, like /pricing.',
        });
      }
    }

    const convertAt = stages.findIndex((s) => s.kind === 'convert');
    const convertCount = stages.filter((s) => s.kind === 'convert').length;
    if (convertCount === 0) {
      ctx.addIssue({
        code: 'custom',
        message: 'A funnel needs a stage that counts as converting.',
      });
    } else if (convertCount > 1) {
      ctx.addIssue({
        code: 'custom',
        message: 'Only one stage can be the conversion, or the value is counted twice.',
      });
    } else if (convertAt !== stages.length - 1) {
      ctx.addIssue({
        code: 'custom',
        path: [convertAt, 'kind'],
        message: 'The converting stage has to be the last one.',
      });
    }
  });
export type FunnelStages = z.infer<typeof FunnelStages>;

// ─── the shipped ladders ──────────────────────────────────────────────────────

/**
 * The default ladder for each kind.
 *
 * These are STAMPED into a new funnel and then belong to the tenant — editing
 * one never edits the library, which is the same fork-on-install rule the
 * blueprint catalog follows. So a change here reaches new funnels only, and that
 * is the intended blast radius.
 *
 * No `match` on any of them: every rung here is one the engine is told about
 * explicitly at the point it happens, rather than one it has to recognize from a
 * stream of events. A tenant who wants a recognized rung adds the condition.
 */
export const DEFAULT_STAGES: Record<FunnelKind, FunnelStages> = {
  lead: [
    { key: 'viewed', name: 'Saw the page', kind: 'view' },
    { key: 'captured', name: 'Left their details', kind: 'capture' },
    { key: 'qualified', name: 'Told us what they need', kind: 'qualify' },
    { key: 'converted', name: 'Became a customer', kind: 'convert' },
  ],
  recovery: [
    { key: 'abandoned', name: 'Left something behind', kind: 'capture' },
    { key: 'reminded', name: 'We got in touch', kind: 'engage' },
    { key: 'returned', name: 'Came back', kind: 'engage' },
    { key: 'recovered', name: 'Finished the order', kind: 'convert' },
  ],
  purchase: [
    { key: 'viewed', name: 'Saw the offer', kind: 'view' },
    { key: 'started', name: 'Started checking out', kind: 'capture' },
    { key: 'purchased', name: 'Paid', kind: 'convert' },
  ],
  booking: [
    { key: 'viewed', name: 'Looked at the times', kind: 'view' },
    { key: 'enquired', name: 'Asked about a slot', kind: 'capture' },
    { key: 'booked', name: 'Booked it in', kind: 'convert' },
  ],
  winback: [
    { key: 'lapsed', name: 'Stopped buying', kind: 'capture' },
    { key: 'contacted', name: 'We reached out', kind: 'engage' },
    { key: 'reordered', name: 'Bought again', kind: 'convert' },
  ],
  // Deliberately a real two-rung ladder rather than an empty one. A custom funnel
  // that starts blank makes the author's first job "work out what a stage is",
  // and the answer is always the same two: somebody arrived, somebody did the
  // thing. They rename these; they do not invent the shape.
  custom: [
    { key: 'entered', name: 'Entered', kind: 'capture' },
    { key: 'converted', name: 'Converted', kind: 'convert' },
  ],
};

// ─── when standing still becomes giving up ────────────────────────────────────

/**
 * How long a subject may sit on a rung before the sweep calls it abandoned.
 *
 * These are DEFAULTS, overridable per funnel, and each number is a guess about
 * how long the thing being waited for normally takes:
 *
 *   · purchase (4h)     — somebody who started checking out and did not finish
 *                         has almost always decided within the afternoon.
 *   · recovery (24h)    — the cart-recovery window every merchant already knows;
 *                         a reminder the next day still reads as helpful.
 *   · booking (72h)     — an enquiry about a slot is often waiting on somebody
 *                         else's diary, so a same-day chase is pushy.
 *   · lead (14d)        — a lead going quiet for a fortnight is a real signal;
 *                         a week is just somebody on holiday.
 *   · winback (30d)     — the whole funnel is about a long silence, so the bar
 *                         for "even this failed" has to be higher than the rest.
 *   · custom (7d)       — no idea what it measures, so a week: long enough not
 *                         to nag, short enough to still be actionable.
 *
 * None of them is "never". A funnel that never gives up never fires the
 * follow-up that recovers the sale, which is most of why a business builds one.
 */
export const DEFAULT_STALL_HOURS: Record<FunnelKind, number> = {
  lead: 14 * 24,
  recovery: 24,
  purchase: 4,
  booking: 72,
  winback: 30 * 24,
  custom: 7 * 24,
};

/** This funnel's patience, in hours: its own setting, else its kind's default. */
export function stallHoursOf(funnel: { kind: string; stallAfterHours?: number | null }): number {
  if (typeof funnel.stallAfterHours === 'number' && funnel.stallAfterHours > 0) {
    return funnel.stallAfterHours;
  }
  const kind = FunnelKind.safeParse(funnel.kind);
  return DEFAULT_STALL_HOURS[kind.success ? kind.data : 'custom'];
}

// ─── the anonymous half's one lookup ──────────────────────────────────────────

/**
 * The path a published page serves at.
 *
 * The home page's slug is null (or the legacy `''` / `'/'` sentinels), and every
 * other singleton serves at its slug. Kept here rather than in the reconcile
 * because the ladder read, the rollup and the activation check all need the same
 * answer, and three copies of a slug convention is how two of them go stale.
 */
export function pathForSlug(slug: string | null | undefined): string {
  if (!slug || slug === '/') return '/';
  return slug.startsWith('/') ? slug : `/${slug}`;
}

/**
 * Which path counts as this rung, or null when nothing can say.
 *
 * Null is a real answer and must stay one: a view rung whose page was deleted
 * counts nothing, and reporting that as zero visitors would state as a
 * measurement what is actually a missing address. `updateFunnel` refuses to
 * ACTIVATE a funnel in that state, so it can only arise afterwards.
 */
export function stagePath(stage: FunnelStage, entryPath: string | null): string | null {
  if (stage.kind !== 'view') return null;
  return stage.path ?? entryPath;
}

// ─── write inputs ─────────────────────────────────────────────────────────────

/** Money a tenant sets by hand. Positive integers only — the migration's CHECK
 *  says the same thing, and the two agree on purpose: "not priced" is `null` and
 *  never `0`, which would render as a real answer of nothing. */
const GoalValueCents = z.number().int().positive().max(100_000_000);

export const CreateFunnelInput = z.object({
  /** REQUIRED, unlike an automation's. A campaign belongs to one business; one
   *  spanning a machine shop and a donut shop is not a thing anybody means. */
  propertyId: z.string().uuid(),
  name: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  kind: FunnelKind.default('lead'),
  /** Omitted → the kind's default ladder is stamped in. */
  stages: FunnelStages.optional(),
  goal: ConditionGroup.optional(),
  goalValueCents: GoalValueCents.optional(),
  automationId: z.string().uuid().optional(),
  sequenceId: z.string().uuid().optional(),
  entryPageId: z.string().uuid().optional(),
  entryFormNodeId: z.string().min(1).max(64).optional(),
  /** Hours of silence before the sweep calls a subject abandoned. Omitted → the
   *  kind's default. Bounded to a year, matching the migration's CHECK: a typo
   *  must not be able to park a campaign forever. */
  stallAfterHours: z.number().int().positive().max(8760).optional(),
  /** Which shipped recipe this was stamped from, for the gallery's "you already
   *  have this one". Provenance only — the copy is the tenant's from here. */
  recipeKey: z.string().min(1).max(63).optional(),
});
export type CreateFunnelInput = z.input<typeof CreateFunnelInput>;

export const UpdateFunnelInput = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().max(2000).nullable().optional(),
  status: FunnelStatus.optional(),
  kind: FunnelKind.optional(),
  stages: FunnelStages.optional(),
  goal: ConditionGroup.nullable().optional(),
  goalValueCents: GoalValueCents.nullable().optional(),
  automationId: z.string().uuid().nullable().optional(),
  sequenceId: z.string().uuid().nullable().optional(),
  entryPageId: z.string().uuid().nullable().optional(),
  entryFormNodeId: z.string().min(1).max(64).nullable().optional(),
  /** Null clears the override and returns the funnel to its kind's default. */
  stallAfterHours: z.number().int().positive().max(8760).nullable().optional(),
});
export type UpdateFunnelInput = z.input<typeof UpdateFunnelInput>;

/**
 * One person reaching one rung.
 *
 * `customerId` XOR `subjectEmail` — the same exclusive-or the migration's CHECK
 * enforces, said here so the caller gets a readable error instead of a
 * constraint violation. Neither is the anonymous row this table must never hold;
 * both is two identities for one person, which double-counts them.
 */
export const RecordStageInput = z
  .object({
    funnelId: z.string().uuid(),
    stageKey: z.string().min(1).max(63),
    customerId: z.string().uuid().optional(),
    subjectEmail: z.string().email().max(255).optional(),
    /** Copied from the visitor's earliest pageview of the day at capture, then
     *  frozen. Same vocabulary as `site_analytics_events.source`. */
    entrySource: z.string().max(20).optional(),
    entryLandingPath: z.string().max(2048).optional(),
    entryCampaign: z.string().max(64).optional(),
    /** Converting stage only. Omit it when nobody can say what this was worth —
     *  an unknown value must never be recorded as a value of nothing. */
    valueCents: z.number().int().nonnegative().optional(),
    refs: z.record(z.string(), z.string()).optional(),
    occurredAt: z.coerce.date().optional(),
  })
  .refine((v) => Boolean(v.customerId) !== Boolean(v.subjectEmail), {
    message: 'Name exactly one subject: a customer, or an email address.',
  });
export type RecordStageInput = z.input<typeof RecordStageInput>;
