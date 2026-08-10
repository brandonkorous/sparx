// scoringService (docs/144 §10) — the number, and why it is that number.
//
// ══════════════════════════════════════════════════════════════════════════
// A SCORE NOBODY CAN EXPLAIN IS A SCORE NOBODY USES
// ══════════════════════════════════════════════════════════════════════════
//
// The mechanism is not the interesting part — sum the matching rules, subtract
// decay, clamp. What makes this worth building rather than shipping a hidden
// number is that every change writes a `score_events` row carrying the delta, the
// resulting total and the rule's own label. So a contact's score panel reads:
//
//     74   Opened three emails            +20
//          Works at a company you sell to +15
//          No order in 90 days            −10
//          …
//
// A business owner can look at that and either agree or go change the rule. A
// gauge with no history is something they learn to scroll past.
//
// SCORING IS IDEMPOTENT AND WRITES NOTHING WHEN NOTHING MOVED. Re-scoring the
// same record against the same model produces the same number and NO event row.
// This matters more than it sounds: the evaluator runs on every event that could
// plausibly change a projection, so a chatty integration would otherwise bury the
// real reasons under thousands of "+0, recompute" rows and destroy the exact
// readability the table exists for.

import {
  AdjustScoreInput,
  CreateScoringModelInput,
  RecomputeScoresInput,
  UpdateScoringModelInput,
  ScoringRule,
} from '@sparx/crm-schemas';
import { evaluateConditions, type ResolvedFields } from '@sparx/automation-schemas';
import { withTenant } from '@sparx/db';
import type { Prisma, ScoreEvent, ScoringModel, TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { scoringFieldsForRecord } from './scoring-fields';

/** How many points a record is worth, and which rules said so. */
export interface ScoreBreakdown {
  score: number;
  reasons: { label: string; points: number }[];
  /** Points removed by decay, as a positive number. Zero when the model has no
   *  decay or the record did something today. */
  decayed: number;
}

function parseRules(stored: unknown): ScoringRule[] {
  const parsed = ScoringRule.array().safeParse(stored);
  return parsed.success ? parsed.data : [];
}

/**
 * Compute a score from a model and a record's fields. Pure — no DB, no writes —
 * so it can be unit-tested exhaustively and reused by a preview that shows an
 * author what their rules would do before they save them.
 */
export function computeScore(
  model: Pick<ScoringModel, 'rules' | 'decayPerDay' | 'maxScore'>,
  fields: ResolvedFields,
  daysIdle: number | null
): ScoreBreakdown {
  const reasons: { label: string; points: number }[] = [];
  let raw = 0;

  for (const rule of parseRules(model.rules)) {
    // An empty condition group passes for everything. That is right for a
    // baseline rule ("every contact starts at 10") and is the author's choice to
    // make, so it is not special-cased away here.
    if (!evaluateConditions(rule.condition, fields)) continue;
    raw += rule.points;
    reasons.push({ label: rule.label, points: rule.points });
  }

  const perDay = model.decayPerDay === null ? 0 : Number(model.decayPerDay);
  // Decay applies to the EARNED total, not to the clamped one: clamping first
  // would make a record at the ceiling decay from 100 regardless of how far past
  // it their rules actually put them, so two very different records would age
  // identically.
  const decayed = perDay > 0 && daysIdle !== null ? Math.floor(perDay * Math.max(0, daysIdle)) : 0;

  const score = Math.max(0, Math.min(model.maxScore, raw - decayed));
  return { score, reasons, decayed: Math.min(decayed, Math.max(0, raw)) };
}

/** The active model for an object, preferring the record's own site over the
 *  tenant-wide one. Null when the tenant has written none — which is the normal
 *  state, and means "don't score", not "score zero". */
async function activeModel(
  tx: TxClient,
  objectKey: string,
  propertyId: string | null
): Promise<ScoringModel | null> {
  const models = await tx.scoringModel.findMany({
    where: {
      objectKey,
      isActive: true,
      archivedAt: null,
      ...(propertyId ? { OR: [{ propertyId }, { propertyId: null }] } : { propertyId: null }),
    },
    // A site's own model beats the tenant-wide fallback. `nulls: 'last'` is what
    // does the work — without it Postgres sorts nulls first on DESC and the
    // fallback would win on every site that has its own.
    orderBy: { propertyId: { sort: 'desc', nulls: 'last' } },
    take: 1,
  });
  return models[0] ?? null;
}

/** Days since the record last did anything — the input decay is a function of.
 *  Null when it has never done anything, which means no decay rather than
 *  infinite decay: a contact added this morning has not gone cold. */
function idleDays(fields: ResolvedFields): number | null {
  const value = fields['customer.daysSinceActivity'] ?? fields['deal.daysSinceActivity'];
  return typeof value === 'number' ? value : null;
}

export interface ScoreResult {
  recordId: string;
  score: number;
  previous: number;
  changed: boolean;
  reasons: { label: string; points: number }[];
}

/**
 * Score ONE record and persist the result.
 *
 * Runs inside the caller's transaction when given one, so the consumer that
 * re-scores on an event doesn't open a second. Returns `changed: false` and
 * writes nothing when the number didn't move.
 */
export async function scoreRecord(
  tx: TxClient,
  tenantId: string,
  objectKey: string,
  recordId: string,
  opts: { now?: Date; model?: ScoringModel | null } = {}
): Promise<ScoreResult | null> {
  const now = opts.now ?? new Date();
  const fields = await scoringFieldsForRecord(tx, objectKey, recordId, now);
  if (!fields) return null;

  const propertyId = await recordProperty(tx, objectKey, recordId);
  const model =
    opts.model !== undefined ? opts.model : await activeModel(tx, objectKey, propertyId);
  if (!model) return null;

  const breakdown = computeScore(model, fields, idleDays(fields));
  const previous = await currentScore(tx, objectKey, recordId);
  if (previous === null) return null;

  if (previous === breakdown.score) {
    return {
      recordId,
      score: breakdown.score,
      previous,
      changed: false,
      reasons: breakdown.reasons,
    };
  }

  await writeScore(tx, objectKey, recordId, breakdown.score, now);
  await tx.scoreEvent.create({
    data: {
      tenantId,
      modelId: model.id,
      objectKey,
      recordId,
      delta: breakdown.score - previous,
      score: breakdown.score,
      // The reasons, joined — the row has to be readable on its own, since the
      // rules it was computed from are editable and may not say the same thing
      // tomorrow.
      reason: summarize(breakdown),
      source: 'rule',
      occurredAt: now,
    },
  });

  return { recordId, score: breakdown.score, previous, changed: true, reasons: breakdown.reasons };
}

/** The reasons as one readable line, capped to the column. Truncation appends a
 *  count rather than an ellipsis, so a clipped row still says how much it left
 *  out. */
function summarize(breakdown: ScoreBreakdown): string {
  const parts = breakdown.reasons.map(
    (r) => `${r.label} ${r.points >= 0 ? '+' : ''}${String(r.points)}`
  );
  if (breakdown.decayed > 0) parts.push(`inactivity −${String(breakdown.decayed)}`);
  if (parts.length === 0) return 'No rules matched';

  const joined = parts.join(', ');
  if (joined.length <= 255) return joined;

  let out = '';
  let shown = 0;
  for (const part of parts) {
    if (out.length + part.length + 2 > 230) break;
    out = out === '' ? part : `${out}, ${part}`;
    shown += 1;
  }
  return `${out} (+${String(parts.length - shown)} more)`;
}

async function recordProperty(
  tx: TxClient,
  objectKey: string,
  recordId: string
): Promise<string | null> {
  if (objectKey === 'contact') {
    const row = await tx.customer.findUnique({
      where: { id: recordId },
      select: { propertyId: true },
    });
    return row?.propertyId ?? null;
  }
  if (objectKey === 'deal') {
    const row = await tx.deal.findUnique({ where: { id: recordId }, select: { propertyId: true } });
    return row?.propertyId ?? null;
  }
  return null;
}

/** The record's stored score, or null when the record is gone. Null is NOT zero:
 *  scoring a deleted record would write an event about nothing. */
async function currentScore(
  tx: TxClient,
  objectKey: string,
  recordId: string
): Promise<number | null> {
  if (objectKey === 'contact') {
    const row = await tx.customer.findUnique({ where: { id: recordId }, select: { score: true } });
    return row?.score ?? null;
  }
  if (objectKey === 'deal') {
    const row = await tx.deal.findUnique({ where: { id: recordId }, select: { score: true } });
    return row?.score ?? null;
  }
  return null;
}

async function writeScore(
  tx: TxClient,
  objectKey: string,
  recordId: string,
  score: number,
  now: Date
): Promise<void> {
  if (objectKey === 'contact') {
    await tx.customer.update({ where: { id: recordId }, data: { score, scoredAt: now } });
    return;
  }
  if (objectKey === 'deal') {
    await tx.deal.update({ where: { id: recordId }, data: { score, scoredAt: now } });
  }
}

// ─── models ──────────────────────────────────────────────────────────────────

export async function listModels(
  ctx: ServiceContext,
  args: { objectKey?: string; propertyIds?: string[] | null } = {}
): Promise<ScoringModel[]> {
  return withTenant(ctx, (tx) =>
    tx.scoringModel.findMany({
      where: {
        archivedAt: null,
        ...(args.objectKey ? { objectKey: args.objectKey } : {}),
        ...(args.propertyIds
          ? { OR: [{ propertyId: null }, { propertyId: { in: args.propertyIds } }] }
          : {}),
      },
      orderBy: [{ objectKey: 'asc' }, { name: 'asc' }],
    })
  );
}

export async function getModel(ctx: ServiceContext, id: string): Promise<ScoringModel> {
  const row = await withTenant(ctx, (tx) => tx.scoringModel.findFirst({ where: { id } }));
  if (!row || row.archivedAt) throw new CrmNotFoundError('ScoringModel', id);
  return row;
}

export async function createModel(ctx: ServiceContext, rawInput: unknown): Promise<ScoringModel> {
  const input = CreateScoringModelInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    // The partial unique index would reject a second active model with a raw
    // Postgres error. Demoting the incumbent instead makes "make this the one
    // that runs" mean what a person expects.
    if (input.isActive) {
      await deactivateOthers(tx, input.objectKey, input.propertyId ?? null);
    }
    const row = await tx.scoringModel.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        objectKey: input.objectKey,
        name: input.name,
        description: input.description ?? null,
        rules: input.rules as unknown as Prisma.InputJsonValue,
        decayPerDay: input.decayPerDay ?? null,
        maxScore: input.maxScore,
        isActive: input.isActive,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.scoring_model.created',
      entityType: 'ScoringModel',
      entityId: row.id,
      diff: { after: { name: row.name, objectKey: row.objectKey } },
    });
    return row;
  });
}

export async function updateModel(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<ScoringModel> {
  const input = UpdateScoringModelInput.parse(rawInput);
  const before = await getModel(ctx, id);

  return withTenant(ctx, async (tx) => {
    const objectKey = input.objectKey ?? before.objectKey;
    const propertyId = input.propertyId === undefined ? before.propertyId : input.propertyId;
    if (input.isActive) await deactivateOthers(tx, objectKey, propertyId ?? null, id);

    const row = await tx.scoringModel.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.objectKey === undefined ? {} : { objectKey: input.objectKey }),
        ...(input.propertyId === undefined ? {} : { propertyId: input.propertyId ?? null }),
        ...(input.rules === undefined
          ? {}
          : { rules: input.rules as unknown as Prisma.InputJsonValue }),
        ...(input.decayPerDay === undefined ? {} : { decayPerDay: input.decayPerDay ?? null }),
        ...(input.maxScore === undefined ? {} : { maxScore: input.maxScore }),
        ...(input.isActive === undefined ? {} : { isActive: input.isActive }),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.scoring_model.updated',
      entityType: 'ScoringModel',
      entityId: row.id,
      diff: { before: { name: before.name }, after: { name: row.name } },
    });
    return row;
  });
}

export async function archiveModel(ctx: ServiceContext, id: string): Promise<ScoringModel> {
  await getModel(ctx, id);
  return withTenant(ctx, (tx) =>
    tx.scoringModel.update({
      where: { id },
      // Deactivating on the way out keeps the partial unique index free for
      // whichever model becomes the one that runs.
      data: { archivedAt: new Date(), isActive: false },
    })
  );
}

async function deactivateOthers(
  tx: TxClient,
  objectKey: string,
  propertyId: string | null,
  exceptId?: string
): Promise<void> {
  await tx.scoringModel.updateMany({
    where: {
      objectKey,
      propertyId,
      isActive: true,
      archivedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isActive: false },
  });
}

// ─── running it ──────────────────────────────────────────────────────────────

/** Re-score a batch. Bounded per call: a tenant with 200k contacts recomputing
 *  in one transaction would hold it open for minutes, so the caller pages. */
export async function recompute(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ scanned: number; changed: number; nextCursor: string | null }> {
  const input = RecomputeScoresInput.parse(rawInput);
  const now = new Date();

  return withTenant(ctx, async (tx) => {
    const ids =
      input.recordIds ??
      (await pageRecordIds(tx, input.objectKey, input.cursor ?? null, input.limit));

    let changed = 0;
    for (const recordId of ids) {
      // No `model` passed: each record resolves its OWN site's model. Hoisting
      // one lookup out of the loop would score a donut-shop contact by the
      // machine shop's rules whenever a tenant runs two businesses.
      const result = await scoreRecord(tx, ctx.tenantId, input.objectKey, recordId, { now });
      if (result?.changed) changed += 1;
    }

    // Only a FULL page can have more behind it; a short page is the end. Paging
    // off the count rather than a second query is what keeps the caller from
    // looping forever on an empty tail.
    const nextCursor =
      input.recordIds === undefined && ids.length === input.limit
        ? (ids[ids.length - 1] ?? null)
        : null;

    return { scanned: ids.length, changed, nextCursor };
  });
}

async function pageRecordIds(
  tx: TxClient,
  objectKey: string,
  cursor: string | null,
  limit: number
): Promise<string[]> {
  // Keyset pagination on `id`. An offset would re-scan and could skip a record
  // that another write moved while the caller was paging.
  const where = { deletedAt: null, ...(cursor ? { id: { gt: cursor } } : {}) };
  if (objectKey === 'contact') {
    const rows = await tx.customer.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }
  if (objectKey === 'deal') {
    const rows = await tx.deal.findMany({
      where,
      select: { id: true },
      orderBy: { id: 'asc' },
      take: limit,
    });
    return rows.map((r) => r.id);
  }
  return [];
}

/** Move a score by hand. Recorded with the actor, so an unexplained jump in the
 *  history is always attributable to a person. */
export async function adjust(ctx: ServiceContext, rawInput: unknown): Promise<ScoreResult> {
  const input = AdjustScoreInput.parse(rawInput);
  const now = new Date();

  return withTenant(ctx, async (tx) => {
    const previous = await currentScore(tx, input.objectKey, input.recordId);
    if (previous === null) throw new CrmNotFoundError('Record', input.recordId);

    const model = await activeModel(
      tx,
      input.objectKey,
      await recordProperty(tx, input.objectKey, input.recordId)
    );
    const ceiling = model?.maxScore ?? 100;
    const score = Math.max(0, Math.min(ceiling, previous + input.delta));

    if (score === previous) {
      throw new CrmValidationError('That would not change the score.', [
        {
          field: 'delta',
          message: `the score is already ${String(previous)}, and the range is 0–${String(ceiling)}`,
        },
      ]);
    }

    await writeScore(tx, input.objectKey, input.recordId, score, now);
    await tx.scoreEvent.create({
      data: {
        tenantId: ctx.tenantId,
        modelId: model?.id ?? null,
        objectKey: input.objectKey,
        recordId: input.recordId,
        delta: score - previous,
        score,
        reason: input.reason,
        source: 'manual',
        actorId: ctx.userId ?? null,
        occurredAt: now,
      },
    });

    return { recordId: input.recordId, score, previous, changed: true, reasons: [] };
  });
}

/** A record's score history, newest first — the "why is this 74" panel. */
export async function history(
  ctx: ServiceContext,
  args: { objectKey: string; recordId: string; limit?: number }
): Promise<ScoreEvent[]> {
  return withTenant(ctx, (tx) =>
    tx.scoreEvent.findMany({
      where: { objectKey: args.objectKey, recordId: args.recordId },
      orderBy: { occurredAt: 'desc' },
      take: Math.min(args.limit ?? 50, 200),
    })
  );
}

/**
 * What the current model WOULD score this record, without writing anything.
 *
 * The rule editor's live preview. Same code path as the real thing, so what the
 * author sees is what they will get — a preview computed by a second
 * implementation is a preview that eventually lies.
 */
export async function preview(
  ctx: ServiceContext,
  args: {
    objectKey: string;
    recordId: string;
    rules?: unknown;
    decayPerDay?: number | null;
    maxScore?: number;
  }
): Promise<ScoreBreakdown | null> {
  const now = new Date();
  return withTenant(ctx, async (tx) => {
    const fields = await scoringFieldsForRecord(tx, args.objectKey, args.recordId, now);
    if (!fields) return null;

    const saved = await activeModel(
      tx,
      args.objectKey,
      await recordProperty(tx, args.objectKey, args.recordId)
    );
    // An unsaved rule set beats the stored one — that is the whole point of a
    // preview. Falls back to the saved model so "what does this record score
    // today" works with no arguments.
    const model = {
      rules: (args.rules ?? saved?.rules ?? []) as Prisma.JsonValue,
      decayPerDay: (args.decayPerDay ?? saved?.decayPerDay ?? null) as ScoringModel['decayPerDay'],
      maxScore: args.maxScore ?? saved?.maxScore ?? 100,
    };
    return computeScore(model, fields, idleDays(fields));
  });
}
