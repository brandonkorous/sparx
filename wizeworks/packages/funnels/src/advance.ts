// Moving people through a campaign on the events that already happen.
//
// The automation worker resolves the facts of every event on the bus (an order
// paid, a basket left, a booking missed) and hands them here. For each running
// campaign, this decides whether the event:
//
//   1. PUTS somebody in: the first `capture` rung whose `match` it satisfies,
//   2. MOVES them along: any `qualify` / `engage` rung whose `match` it satisfies,
//   3. FINISHES them: the campaign's `goal` holds.
//
// A rung with no `match` (or an empty one) is never recognized here: it is one
// the platform is TOLD about (a form, the API, MCP), and an empty group would
// otherwise match every event there is.
//
// ── ROUNDS ──────────────────────────────────────────────────────────────────
//
// A person can go through a campaign more than once: a second abandoned basket
// next month is a second chance to recover a sale. Everything is judged against
// their CURRENT ROUND, the rows from their latest capture onward. They can be put
// in again only once that round has finished.
//
// ── WHICH BUSINESS ──────────────────────────────────────────────────────────
//
// A campaign belongs to one site. Nobody is put in by an event on another site,
// or by one with no site at all: the same person buying from an owner's second
// business did not join this campaign. Moving along and finishing may happen on
// a site-less event (a contact edited in the CRM), because by then the person is
// provably in the campaign.

import { withTenant, type Prisma, type TenantContext, type TxClient } from '@wizeworks/db';
import {
  evaluateConditions,
  isConditionGroup,
  type Condition,
  type ResolvedFields,
} from '@wizeworks/automation-schemas';
import type { FunnelStageEventPayload } from '@wizeworks/events';
import type { Funnel, FunnelStageEvent } from '@prisma/client';

import { evaluateFunnelGoal, stagesOf } from './index.js';
import type { FunnelStage, StageKind } from './schemas.js';

/** Where the automation resolvers put the event's site. A literal, because this
 *  package must not depend on the engine. */
const PROPERTY_FIELD = '__propertyId';

/** Our own announcements never move anybody: that would be a loop. */
const IGNORED_PREFIX = 'funnel.';

export interface CampaignEvent {
  type: string;
  occurredAt: Date;
  /** The event's resolved fields, exactly as automation conditions see them.
   *  `event.type` is added here so a rung can match on WHAT happened. */
  fields: ResolvedFields;
}

export interface StageAdvance {
  row: FunnelStageEvent;
  kind: StageKind;
  /** Ready to publish as `funnel.entered` (capture) or `funnel.converted`. */
  payload: FunnelStageEventPayload;
}

export interface AdvanceOptions {
  /** Only put people in; the nightly scan uses this, because a scan is not an
   *  event and must not finish or move anybody. */
  captureOnly?: boolean;
}

type Row = Pick<
  FunnelStageEvent,
  | 'stageKey'
  | 'customerId'
  | 'subjectEmail'
  | 'entrySource'
  | 'entryLandingPath'
  | 'entryCampaign'
  | 'occurredAt'
  | 'refs'
>;

interface Who {
  customerId: string | null;
  email: string | null;
}

function text(v: unknown): string | null {
  return typeof v === 'string' && v.trim().length > 0 ? v.trim() : null;
}

/** Cents from a resolved money field (dollars as a number), or null when absent. */
function cents(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) && v > 0 ? Math.round(v * 100) : null;
}

/** An order's own total is the truth; otherwise what the owner said a success
 *  is worth. Null when neither is known: shown as "not set", never as $0. */
function valueOf(funnel: Funnel, fields: ResolvedFields): number | null {
  const set = funnel.goalValueCents === null ? null : Number(funnel.goalValueCents);
  return cents(fields['order.total']) ?? set;
}

/** The records this event is about, for the report's drill-down. */
function refsOf(fields: ResolvedFields): Record<string, string> {
  const refs: Record<string, string> = {};
  for (const [field, ref] of [
    ['order.id', 'orderId'],
    ['cart.id', 'cartId'],
    ['booking.id', 'bookingId'],
    ['deal.id', 'dealId'],
    ['quote.id', 'quoteId'],
    ['invoice.id', 'invoiceId'],
    ['review.id', 'reviewId'],
  ] as const) {
    const id = text(fields[field]);
    if (id) refs[ref] = id;
  }
  return refs;
}

function refIds(refs: unknown): string[] {
  if (!refs || typeof refs !== 'object' || Array.isArray(refs)) return [];
  return Object.values(refs).filter((v): v is string => typeof v === 'string');
}

function recognizes(stage: FunnelStage, fields: ResolvedFields): boolean {
  return (
    !!stage.match && stage.match.conditions.length > 0 && evaluateConditions(stage.match, fields)
  );
}

async function subjectRows(tx: TxClient, funnelId: string, who: Who): Promise<Row[]> {
  const or: Prisma.FunnelStageEventWhereInput[] = [];
  if (who.customerId) or.push({ customerId: who.customerId });
  if (who.email) or.push({ subjectEmail: { equals: who.email, mode: 'insensitive' } });
  return tx.funnelStageEvent.findMany({
    where: { funnelId, OR: or },
    orderBy: { occurredAt: 'asc' },
    select: {
      stageKey: true,
      customerId: true,
      subjectEmail: true,
      entrySource: true,
      entryLandingPath: true,
      entryCampaign: true,
      occurredAt: true,
      refs: true,
    },
  });
}

/** The rows of the person's latest round, and whether it is still open. */
function currentRound(rows: Row[], kindOf: (key: string) => StageKind | undefined) {
  let start = -1;
  rows.forEach((r, i) => {
    if (kindOf(r.stageKey) === 'capture') start = i;
  });
  if (start < 0) return null;
  const round = rows.slice(start);
  return {
    entry: round[0]!,
    rows: round,
    done: round.some((r) => kindOf(r.stageKey) === 'convert'),
  };
}

interface Ctx {
  tx: TxClient;
  tenantId: string;
  funnel: Funnel;
  event: CampaignEvent;
}

async function write(c: Ctx, stage: FunnelStage, from: Row | Who, value: number | null) {
  const entry = 'stageKey' in from ? from : null;
  const customerId = entry ? entry.customerId : from.customerId;
  const email = entry ? entry.subjectEmail : 'email' in from ? from.email : null;
  const row = await c.tx.funnelStageEvent.create({
    data: {
      tenantId: c.tenantId,
      funnelId: c.funnel.id,
      propertyId: c.funnel.propertyId,
      stageKey: stage.key,
      // The identity they ENTERED under: the abandonment sweep folds people by it.
      customerId,
      subjectEmail: customerId ? null : email,
      entrySource: entry?.entrySource ?? null,
      entryLandingPath: entry?.entryLandingPath ?? null,
      entryCampaign: entry?.entryCampaign ?? null,
      valueCents: value,
      refs: refsOf(c.event.fields),
      occurredAt: c.event.occurredAt,
    },
  });
  const advance: StageAdvance = {
    row,
    kind: stage.kind,
    payload: {
      funnelId: c.funnel.id,
      funnelName: c.funnel.name,
      propertyId: c.funnel.propertyId,
      stageKey: stage.key,
      stageKind: stage.kind,
      customerId: row.customerId,
      subjectEmail: row.subjectEmail,
      valueCents: value,
      entrySource: row.entrySource,
      entryCampaign: row.entryCampaign,
    },
  };
  return advance;
}

async function advanceOne(c: Ctx, who: Who, eventSite: string | null, opts: AdvanceOptions) {
  let stages: FunnelStage[];
  try {
    stages = stagesOf(c.funnel);
  } catch {
    return []; // a ladder we cannot read is a campaign we cannot score
  }
  const kindOf = (key: string) => stages.find((s) => s.key === key)?.kind;
  const out: StageAdvance[] = [];

  // One writer per person per campaign, even when the same event arrives twice.
  const lockKey = `${c.funnel.id}:${who.customerId ?? who.email ?? ''}`;
  await c.tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`;
  let round = currentRound(await subjectRows(c.tx, c.funnel.id, who), kindOf);

  // 1. Put them in, on this campaign's own site only.
  const capture = stages.find((s) => s.kind === 'capture' && recognizes(s, c.event.fields));
  if (capture && eventSite === c.funnel.propertyId && (!round || round.done)) {
    const added = await write(c, capture, who, null);
    out.push(added);
    round = { entry: added.row, rows: [added.row], done: false };
  }
  if (!round || round.done || opts.captureOnly) return out;
  if (round.entry.occurredAt > c.event.occurredAt) return out;

  // 2. Move them along, once per rung per round.
  for (const stage of stages) {
    if (stage.kind !== 'qualify' && stage.kind !== 'engage') continue;
    if (round.rows.some((r) => r.stageKey === stage.key)) continue;
    if (!recognizes(stage, c.event.fields)) continue;
    const moved = await write(c, stage, round.entry, null);
    out.push(moved);
    round.rows.push(moved.row);
  }

  // 3. Finish them, unless this event is about the record that put them in.
  const convert = stages.find((s) => s.kind === 'convert');
  const eventIds = Object.values(refsOf(c.event.fields));
  const sameRecord = round.rows.some(
    (r) => r.occurredAt < c.event.occurredAt && refIds(r.refs).some((id) => eventIds.includes(id))
  );
  const justEntered = out.some((a) => a.kind === 'capture');
  if (convert && !sameRecord && !justEntered && evaluateFunnelGoal(c.funnel, c.event.fields)) {
    out.push(await write(c, convert, round.entry, valueOf(c.funnel, c.event.fields)));
  }
  return out;
}

/**
 * Move everyone this event affects through every running campaign on its site.
 *
 * Returns what was written; the caller announces it, which keeps this package
 * free of a broker. Never acts on an event with no person in it.
 */
export async function advanceOnEvent(
  ctx: TenantContext,
  event: CampaignEvent,
  opts: AdvanceOptions = {}
): Promise<StageAdvance[]> {
  if (event.type.startsWith(IGNORED_PREFIX)) return [];
  const fields: ResolvedFields = { ...event.fields, 'event.type': event.type };
  const who: Who = {
    customerId: text(fields['customer.id']),
    email: text(fields['customer.email'])?.toLowerCase() ?? null,
  };
  if (!who.customerId && !who.email) return [];
  const eventSite = text(fields[PROPERTY_FIELD]);

  return withTenant(ctx, async (tx) => {
    const funnels = await tx.funnel.findMany({
      where: { status: 'active', ...(eventSite ? { propertyId: eventSite } : {}) },
    });
    const out: StageAdvance[] = [];
    for (const funnel of funnels) {
      const c: Ctx = { tx, tenantId: ctx.tenantId, funnel, event: { ...event, fields } };
      out.push(...(await advanceOne(c, who, eventSite, opts)));
    }
    return out;
  });
}

/** Every field a condition group reads, nested groups included. */
function fieldsOf(group: NonNullable<FunnelStage['match']>): string[] {
  return group.conditions.flatMap((c) =>
    isConditionGroup(c) ? fieldsOf(c) : [(c as Condition).field]
  );
}

/** A capture rung only a scan can find: it reads nothing but the customer. */
function scannable(stage: FunnelStage): boolean {
  if (stage.kind !== 'capture' || !stage.match || stage.match.conditions.length === 0) return false;
  return fieldsOf(stage.match).every((f) => f.startsWith('customer.'));
}

/**
 * Put people in campaigns whose first step is a STATE rather than an event, like
 * "has not bought for four months". Nothing happens when somebody goes quiet, so
 * the daily pass scans customers and hands their facts here. Joins only: a scan
 * is not something the person did, so it never moves or finishes anybody.
 */
export async function captureFromScan(
  ctx: TenantContext,
  customers: ResolvedFields[],
  now: Date
): Promise<StageAdvance[]> {
  const rungs = await withTenant(ctx, async (tx) => {
    const funnels = await tx.funnel.findMany({ where: { status: 'active' } });
    return funnels.flatMap((f) => {
      try {
        return stagesOf(f).filter(scannable);
      } catch {
        return [];
      }
    });
  });
  if (rungs.length === 0) return [];

  const out: StageAdvance[] = [];
  for (const fields of customers) {
    if (!rungs.some((r) => recognizes(r, fields))) continue;
    const event: CampaignEvent = { type: 'funnels.scan', occurredAt: now, fields };
    out.push(...(await advanceOnEvent(ctx, event, { captureOnly: true })));
  }
  return out;
}
