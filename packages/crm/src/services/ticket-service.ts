// ticketService — service requests (docs/144 §7).
//
// A ticket has NO status field. Its state is the pipeline stage it sits on,
// which is why `moveStage` is the only sanctioned way to change it: that
// transition also stamps `resolvedAt` / `closedAt`, writes the timeline entry,
// and emits the event a business's own automations key off. A plain field write
// would move the ticket and leave all three wrong — the same trap `dealService`
// guards, for the same reason.
//
// The clock is resolved ONCE, at creation, from the policy that applied then
// (and again if the priority changes, because the promise attached to an urgent
// request is not the one attached to a low one). It is never recomputed on
// read: a policy edited in March must not silently move what was promised in
// February.

import {
  AssignTicketInput,
  CreateTicketInput,
  MoveTicketStageInput,
  TicketQuery,
  UpdateTicketInput,
} from '@sparx/crm-schemas';
import { DEFAULT_TICKET_PIPELINE_TEMPLATE } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Prisma, Ticket } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import { syncPrimaryFromColumn } from './association-service';
import { changedProperties, resolvePropertyBag, toJsonInput } from './custom-properties';
import { schemaFor } from './object-def-service';
import { nextTicketNumber } from './record-numbers';
import { computeDueDates, readClock, type SlaClockView } from './sla-clock';
import { ensureDefaultPolicy, resolveForTicket, toClockShape } from './sla-policy-service';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

/** The stage, the requester and the assignee, pulled alongside so a queue can
 *  name all three without a per-row fetch. */
const ticketInclude = {
  stage: { select: { id: true, name: true, stageType: true, color: true } },
  pipeline: { select: { id: true, name: true } },
  customer: { select: { id: true, firstName: true, lastName: true, company: true, email: true } },
  b2bAccount: { select: { id: true, companyName: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
} satisfies Prisma.TicketInclude;

export type TicketRow = Prisma.TicketGetPayload<{ include: typeof ticketInclude }>;

/** A ticket plus what its two clocks currently say — the shape a list renders
 *  from. Computed at read time from the stored instants, so it costs no query. */
export interface TicketView {
  ticket: TicketRow;
  firstResponse: SlaClockView;
  resolution: SlaClockView;
}

export function toView(ticket: TicketRow, now: Date = new Date()): TicketView {
  return {
    ticket,
    firstResponse: readClock(
      now,
      ticket.firstResponseDueAt,
      ticket.firstResponseWarnAt,
      ticket.firstRespondedAt
    ),
    // A resolution promise is settled by the ticket being resolved. `closedAt`
    // is deliberately not consulted: closing an unresolved request does not
    // mean it was answered in time, and letting it read as `met` would hide
    // exactly the case a support lead needs to see.
    resolution: readClock(now, ticket.resolutionDueAt, ticket.resolutionWarnAt, ticket.resolvedAt),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// The support queue's pipeline
// ─────────────────────────────────────────────────────────────────────────

/**
 * The tenant's ticket pipeline, created on first use.
 *
 * Idempotent, and deliberately NOT part of the generic CRM bootstrap: a tenant
 * that never files a support request should not carry a support queue it did
 * not ask for. The first ticket is what says they want one.
 */
export async function ensureTicketPipeline(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<{ pipelineId: string; stageId: string; propertyId: string | null }> {
  const template = DEFAULT_TICKET_PIPELINE_TEMPLATE;
  // findFirst, not findUnique: the unique is (tenant, property, object, slug)
  // NULLS NOT DISTINCT, and Prisma cannot reach a null-property row through a
  // compound-unique key.
  const existing = await tx.pipeline.findFirst({
    where: { objectKey: 'ticket', propertyId: null, slug: template.slug },
    include: { stages: { orderBy: { sortOrder: 'asc' } } },
  });
  const pipeline =
    existing ??
    (await tx.pipeline.create({
      data: {
        tenantId,
        propertyId: null,
        objectKey: 'ticket',
        name: template.name,
        slug: template.slug,
        isDefault: template.isDefault,
        stages: {
          create: template.stages.map((s) => ({
            tenantId,
            name: s.name,
            sortOrder: s.sortOrder,
            probability: s.probability,
            stageType: s.stageType,
            color: s.color ?? null,
          })),
        },
      },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    }));

  const first = pipeline.stages[0];
  if (!first) {
    throw new CrmValidationError('The support queue has no stages to open a request on.', [
      { field: 'pipelineId', message: 'pipeline has no stages' },
    ]);
  }
  return { pipelineId: pipeline.id, stageId: first.id, propertyId: pipeline.propertyId };
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export interface ListTicketsArgs {
  query?: unknown;
  /** The sites this member may reach (docs/131 §3.3); undefined = unrestricted.
   *  A restricted member sees their sites' requests PLUS tenant-wide ones. */
  propertyIds?: string[];
  /** Injected so a list and the clocks it renders agree on "now". */
  now?: Date;
}

export async function list(
  ctx: ServiceContext,
  args: ListTicketsArgs = {}
): Promise<{ items: TicketView[]; total: number }> {
  const q = TicketQuery.parse(args.query ?? {});
  const now = args.now ?? new Date();

  return withTenant(ctx, async (tx) => {
    const where: Prisma.TicketWhereInput = {
      deletedAt: null,
      ...(args.propertyIds
        ? { OR: [{ propertyId: { in: args.propertyIds } }, { propertyId: null }] }
        : {}),
      ...(q.q
        ? {
            // Subject or the human number — "1042" is how somebody arrives at a
            // ticket from an email, and making them type it into a different box
            // than the words is the kind of detail that gets a screen abandoned.
            OR: [
              { subject: { contains: q.q, mode: 'insensitive' } },
              ...(/^\d+$/.test(q.q) ? [{ number: Number(q.q) }] : []),
            ],
          }
        : {}),
      ...(q.pipelineId ? { pipelineId: q.pipelineId } : {}),
      ...(q.stageId ? { stageId: q.stageId } : {}),
      ...(q.priority ? { priority: q.priority } : {}),
      ...(q.source ? { source: q.source } : {}),
      ...(q.customerId ? { customerId: q.customerId } : {}),
      ...(q.b2bAccountId ? { b2bAccountId: q.b2bAccountId } : {}),
      ...(q.unassigned ? { assignedToUserId: null } : {}),
      ...(q.assignedToUserId ? { assignedToUserId: q.assignedToUserId } : {}),
      ...(q.tags && q.tags.length > 0 ? { tags: { hasSome: q.tags } } : {}),
      // State is asked of the STAGE, never of a status column — the stage is
      // the status (docs/144 §7.2).
      ...(q.state === 'open'
        ? { stage: { stageType: { notIn: ['resolved', 'closed'] } } }
        : q.state === 'resolved'
          ? { stage: { stageType: 'resolved' } }
          : q.state === 'closed'
            ? { stage: { stageType: 'closed' } }
            : {}),
      // "Already missed something" — either promise counts, and a promise that
      // was kept late is not currently breached.
      ...(q.breached
        ? {
            OR: [
              { firstResponseBreachedAt: { not: null }, firstRespondedAt: null },
              { resolutionBreachedAt: { not: null }, resolvedAt: null },
            ],
          }
        : {}),
      ...(q.dueWithinMinutes
        ? {
            OR: [
              {
                firstRespondedAt: null,
                firstResponseDueAt: {
                  not: null,
                  lte: new Date(now.getTime() + q.dueWithinMinutes * 60_000),
                },
              },
              {
                resolvedAt: null,
                resolutionDueAt: {
                  not: null,
                  lte: new Date(now.getTime() + q.dueWithinMinutes * 60_000),
                },
              },
            ],
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      tx.ticket.findMany({
        where,
        include: ticketInclude,
        orderBy: orderFor(q.sort),
        take: q.take,
        skip: q.skip,
      }),
      tx.ticket.count({ where }),
    ]);
    return { items: items.map((t) => toView(t, now)), total };
  });
}

function orderFor(sort: TicketQuery['sort']): Prisma.TicketOrderByWithRelationInput[] {
  switch (sort) {
    case 'created_asc':
      return [{ createdAt: 'asc' }];
    case 'created_desc':
      return [{ createdAt: 'desc' }];
    case 'updated_desc':
      return [{ updatedAt: 'desc' }];
    case 'priority_desc':
      // Postgres orders VARCHAR alphabetically, and 'urgent' sorts LAST of the
      // four — so a naive `priority: desc` puts urgent first only by accident
      // and low second. Ordering by the due instant instead answers the same
      // question honestly: the most urgent thing is the thing due soonest.
      return [{ firstResponseDueAt: { sort: 'asc', nulls: 'last' } }, { createdAt: 'asc' }];
    case 'due_asc':
    default:
      // The queue's default, and the only sort a support lead actually wants:
      // what runs out first. Nulls last, because a request nobody promised
      // anything about must not sit above one that is about to breach.
      return [
        { firstResponseDueAt: { sort: 'asc', nulls: 'last' } },
        { resolutionDueAt: { sort: 'asc', nulls: 'last' } },
        { createdAt: 'asc' },
      ];
  }
}

export async function get(
  ctx: ServiceContext,
  ticketId: string,
  now: Date = new Date()
): Promise<TicketView> {
  const ticket = await withTenant(ctx, (tx) =>
    tx.ticket.findUnique({ where: { id: ticketId }, include: ticketInclude })
  );
  if (ticket?.deletedAt !== null) throw new CrmNotFoundError('Ticket', ticketId);
  return toView(ticket, now);
}

// ─────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────

async function syncTicketAssociations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  ticket: Ticket
): Promise<void> {
  await syncPrimaryFromColumn(tx, tenantId, 'ticket', ticket.id, 'contact', ticket.customerId);
  await syncPrimaryFromColumn(tx, tenantId, 'ticket', ticket.id, 'company', ticket.b2bAccountId);
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<TicketView> {
  const input = CreateTicketInput.parse(rawInput);
  const openedAt = new Date();

  const created = await withTenant(ctx, async (tx) => {
    // An intake that already filed this exact thing returns what it filed.
    // Automations retry, so a rule firing twice on one chat conversation is the
    // normal case — and the alternative is two tickets for one conversation,
    // which is how a support queue stops being trustworthy.
    if (input.sourceRecordId) {
      const already = await tx.ticket.findFirst({
        where: { source: input.source, sourceRecordId: input.sourceRecordId },
        include: ticketInclude,
      });
      if (already) return { row: already, isNew: false };
    }

    // Resolve where it lands. A caller that named neither pipeline nor stage
    // gets the tenant's support queue, opened on its first stage — filing the
    // first request must not require setting up a process first.
    let pipelineId = input.pipelineId ?? null;
    let stageId = input.stageId ?? null;
    let propertyId: string | null = input.propertyId ?? null;

    if (!pipelineId || !stageId) {
      const fallback = await ensureTicketPipeline(tx, ctx.tenantId);
      pipelineId ??= fallback.pipelineId;
      stageId ??= fallback.stageId;
      // Set up the promise alongside the queue, in this same transaction. Doing
      // it later would make the very first request the one ticket in the
      // tenant's history that nobody was measured on — and the first one is the
      // one somebody is watching.
      if (input.slaPolicyId === undefined) {
        // In the business's OWN hours, not UTC. "Open 9 to 5" is the only thing
        // a person means by it, and a promise bootstrapped in UTC quietly counts
        // those hours somewhere else — for a shop in Denver every deadline lands
        // six hours early, and the first anyone hears of it is a request that
        // went red overnight. The zone is already on file (the entity profile,
        // where it is a real picker); UTC stays the fallback only when nobody
        // has said yet.
        const business = await tx.tenantBusiness.findFirst({ select: { timezone: true } });
        await ensureDefaultPolicy(tx, ctx.tenantId, business?.timezone ?? undefined);
      }
    }

    const stage = await tx.pipelineStage.findUnique({ where: { id: stageId } });
    if (stage?.pipelineId !== pipelineId) {
      throw new CrmValidationError('That stage is not part of the chosen queue.', [
        { field: 'stageId', message: 'Stage and pipeline must match' },
      ]);
    }
    const pipeline = await tx.pipeline.findUnique({
      where: { id: pipelineId },
      select: { propertyId: true, objectKey: true },
    });
    if (pipeline && pipeline.objectKey !== 'ticket') {
      throw new CrmValidationError('That pipeline moves a different kind of record.', [
        { field: 'pipelineId', message: `pipeline is for ${pipeline.objectKey}, not ticket` },
      ]);
    }
    // Denormalized from the pipeline, like a deal — a request always belongs to
    // the same business as the queue it is in. An explicit propertyId on the
    // input only applies when the queue is tenant-wide.
    propertyId = pipeline?.propertyId ?? propertyId;

    const policy = await resolveForTicket(tx, {
      // `undefined` means "work it out"; explicit `null` means "no promise on
      // this one" and must not fall through to the default.
      policyId: input.slaPolicyId,
      propertyId,
    });
    const due =
      input.slaPolicyId === null
        ? computeDueDates(openedAt, input.priority, null)
        : computeDueDates(openedAt, input.priority, policy ? toClockShape(policy) : null);

    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'ticket', tx),
      existing: {},
      incoming: input.customProperties,
    });

    const row = await tx.ticket.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        number: await nextTicketNumber(tx, ctx.tenantId),
        pipelineId,
        stageId,
        customerId: input.customerId ?? null,
        b2bAccountId: input.b2bAccountId ?? null,
        assignedToUserId: input.assignedToUserId ?? null,
        subject: input.subject,
        description: input.description ?? null,
        priority: input.priority,
        source: input.source,
        sourceRecordId: input.sourceRecordId ?? null,
        tags: input.tags,
        slaPolicyId: input.slaPolicyId === null ? null : (policy?.id ?? null),
        firstResponseDueAt: due.firstResponseDueAt,
        firstResponseWarnAt: due.firstResponseWarnAt,
        resolutionDueAt: due.resolutionDueAt,
        resolutionWarnAt: due.resolutionWarnAt,
        createdAt: openedAt,
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
      include: ticketInclude,
    });

    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: row.customerId,
        b2bAccountId: row.b2bAccountId,
        type: 'ticket.opened',
        description: `Request #${String(row.number)} opened: ${row.subject}`,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: row.createdAt,
        linkedEntityType: 'Ticket',
        linkedEntityId: row.id,
        metadata: { source: row.source, priority: row.priority },
      },
    });

    await syncTicketAssociations(tx, ctx.tenantId, row);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.ticket.created',
      entityType: 'Ticket',
      entityId: row.id,
      diff: { after: { number: row.number, subject: row.subject, priority: row.priority } },
    });

    return { row, isNew: true };
  });

  if (created.isNew) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.ticket.created',
      payload: {
        ticketId: created.row.id,
        number: created.row.number,
        priority: created.row.priority,
        source: created.row.source,
        customerId: created.row.customerId,
      },
      dedupeKey: `crm.ticket.created:${created.row.id}`,
    });
  }

  return toView(created.row, openedAt);
}

export async function update(
  ctx: ServiceContext,
  ticketId: string,
  rawInput: unknown
): Promise<TicketView> {
  const input = UpdateTicketInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Ticket', ticketId);

    // Re-prioritising re-promises. The whole point of priority is that it
    // selects a different target, so leaving the old due dates in place would
    // make the field decorative — and would keep measuring an escalated request
    // against the leisurely promise it arrived with.
    const priorityMoved = input.priority !== undefined && input.priority !== before.priority;
    const policyRepointed =
      input.slaPolicyId !== undefined && input.slaPolicyId !== before.slaPolicyId;
    let due: ReturnType<typeof computeDueDates> | null = null;
    let policyId = before.slaPolicyId;
    if (priorityMoved || policyRepointed) {
      const wantedPolicyId =
        input.slaPolicyId !== undefined ? input.slaPolicyId : before.slaPolicyId;
      const policy =
        wantedPolicyId === null
          ? null
          : await resolveForTicket(tx, { policyId: wantedPolicyId, propertyId: before.propertyId });
      policyId = policy?.id ?? null;
      // Re-run from the moment it was OPENED, not from now. The promise was
      // always "this many working minutes from when they asked"; restarting the
      // clock on an escalation would reward being slow to notice.
      due = computeDueDates(
        before.createdAt,
        input.priority ?? before.priority,
        policy ? toClockShape(policy) : null
      );
    }

    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'ticket', tx),
      existing: before.customProperties,
      incoming: input.customProperties,
    });

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        ...(input.subject !== undefined ? { subject: input.subject } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.priority !== undefined ? { priority: input.priority } : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.b2bAccountId !== undefined ? { b2bAccountId: input.b2bAccountId } : {}),
        ...(input.assignedToUserId !== undefined
          ? { assignedToUserId: input.assignedToUserId }
          : {}),
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(due
          ? {
              slaPolicyId: policyId,
              firstResponseDueAt: due.firstResponseDueAt,
              firstResponseWarnAt: due.firstResponseWarnAt,
              resolutionDueAt: due.resolutionDueAt,
              resolutionWarnAt: due.resolutionWarnAt,
              // A new promise has not been announced about yet. Clearing these
              // is what lets a request escalated past its new target warn
              // again, instead of staying silent because the OLD promise had
              // already been reported on.
              firstResponseWarnedAt: null,
              firstResponseBreachedAt: null,
              resolutionWarnedAt: null,
              resolutionBreachedAt: null,
            }
          : {}),
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
      include: ticketInclude,
    });

    if (input.customerId !== undefined || input.b2bAccountId !== undefined) {
      await syncTicketAssociations(tx, ctx.tenantId, updated);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.ticket.updated',
      entityType: 'Ticket',
      entityId: updated.id,
      diff: priorityMoved
        ? { before: { priority: before.priority }, after: { priority: updated.priority } }
        : null,
    });

    return {
      updated,
      changed: changedProperties(before.customProperties, updated.customProperties),
    };
  });

  if (result.changed.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.property.changed',
      payload: { objectKey: 'ticket', recordId: result.updated.id, properties: result.changed },
      dedupeKey: `crm.property.changed:${result.updated.id}:${result.updated.updatedAt.toISOString()}`,
    });
  }

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.ticket.updated',
    payload: { ticketId: result.updated.id, priority: result.updated.priority },
    dedupeKey: `crm.ticket.updated:${result.updated.id}:${result.updated.updatedAt.toISOString()}`,
  });

  return toView(result.updated);
}

/**
 * Move a request through its process. The ONLY sanctioned state change.
 *
 * Reaching a `resolved` stage stamps `resolvedAt` — which settles the
 * resolution clock — and a `closed` stage stamps both. Moving BACK to an open
 * stage clears them, because a reopened request is genuinely unresolved again
 * and a queue that still showed it as answered would be lying.
 *
 * Settling a request also settles the FIRST REPLY promise, if nothing else
 * already did. You cannot sort something out without having got back to the
 * person — the resolution IS the reply, at the latest. Without this the most
 * ordinary support flow there is (they ring up, you fix it on the call, you mark
 * it Resolved) leaves `firstRespondedAt` null, and `stillOwed('first_response')`
 * in the sweep only excludes CLOSED requests — so days later the business is
 * told it missed the reply deadline on a request it answered immediately. An
 * alert that fires on work already done is worse than no alert: it teaches
 * people to ignore the ones that are real.
 */
export async function moveStage(
  ctx: ServiceContext,
  ticketId: string,
  rawInput: unknown
): Promise<TicketView> {
  const input = MoveTicketStageInput.parse(rawInput);

  const { ticket, moved, fromStageType, toStageType } = await withTenant(ctx, async (tx) => {
    const before = await tx.ticket.findUnique({
      where: { id: ticketId },
      include: { stage: true },
    });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Ticket', ticketId);

    const toStage = await tx.pipelineStage.findUnique({ where: { id: input.toStageId } });
    if (!toStage) throw new CrmNotFoundError('PipelineStage', input.toStageId);
    if (toStage.pipelineId !== before.pipelineId) {
      throw new CrmValidationError('That stage belongs to a different queue.', [
        { field: 'toStageId', message: 'Stage belongs to a different pipeline' },
      ]);
    }
    if (toStage.id === before.stageId) {
      const same = await tx.ticket.findUnique({ where: { id: ticketId }, include: ticketInclude });
      if (!same) throw new CrmNotFoundError('Ticket', ticketId);
      return {
        ticket: same,
        moved: false,
        fromStageType: before.stage.stageType,
        toStageType: toStage.stageType,
      };
    }

    const now = new Date();
    const isResolved = toStage.stageType === 'resolved';
    const isClosed = toStage.stageType === 'closed';

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: {
        stageId: toStage.id,
        // Resolving something already resolved keeps the FIRST resolution time
        // — that is when the customer got their answer, and overwriting it on
        // an administrative re-move would quietly improve every report.
        resolvedAt: isResolved || isClosed ? (before.resolvedAt ?? now) : null,
        closedAt: isClosed ? (before.closedAt ?? now) : null,
        // Same `?? now` reasoning, one promise earlier: a real reply that was
        // already recorded is the honest first-response time, and settling the
        // request must never overwrite it with a later one. Deliberately NOT
        // cleared when moving back to an open stage — reopening means the job is
        // unfinished again, not that the earlier reply never happened.
        firstRespondedAt:
          isResolved || isClosed ? (before.firstRespondedAt ?? now) : before.firstRespondedAt,
      },
      include: ticketInclude,
    });

    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: updated.customerId,
        b2bAccountId: updated.b2bAccountId,
        type: isResolved || isClosed ? 'ticket.resolved' : 'ticket.replied',
        description: input.note
          ? `Request #${String(updated.number)}: ${before.stage.name} → ${toStage.name} — ${input.note}`
          : `Request #${String(updated.number)}: ${before.stage.name} → ${toStage.name}`,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: now,
        linkedEntityType: 'Ticket',
        linkedEntityId: updated.id,
        metadata: {
          fromStageId: before.stageId,
          fromStageName: before.stage.name,
          toStageId: toStage.id,
          toStageName: toStage.name,
        },
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.ticket.stage_changed',
      entityType: 'Ticket',
      entityId: updated.id,
      diff: {
        before: { stageId: before.stageId, stageType: before.stage.stageType },
        after: { stageId: toStage.id, stageType: toStage.stageType },
      },
    });

    return {
      ticket: updated,
      moved: true,
      fromStageType: before.stage.stageType,
      toStageType: toStage.stageType,
    };
  });

  if (moved) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.ticket.stage_changed',
      payload: {
        ticketId: ticket.id,
        fromStageType,
        toStageId: ticket.stageId,
        toStageType,
      },
      dedupeKey: `crm.ticket.stage_changed:${ticket.id}:${ticket.updatedAt.toISOString()}`,
    });
    if (toStageType === 'resolved' || toStageType === 'closed') {
      await publishCrmEvent({
        tenantId: ctx.tenantId,
        topic: 'crm.ticket.resolved',
        payload: { ticketId: ticket.id, number: ticket.number, closed: toStageType === 'closed' },
        dedupeKey: `crm.ticket.resolved:${ticket.id}:${ticket.updatedAt.toISOString()}`,
      });
    }
  }

  return toView(ticket);
}

export async function assign(
  ctx: ServiceContext,
  ticketId: string,
  rawInput: unknown
): Promise<TicketView> {
  const input = AssignTicketInput.parse(rawInput);

  const ticket = await withTenant(ctx, async (tx) => {
    const before = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Ticket', ticketId);

    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { assignedToUserId: input.assignedToUserId },
      include: ticketInclude,
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.ticket.assigned',
      entityType: 'Ticket',
      entityId: updated.id,
      diff: {
        before: { assignedToUserId: before.assignedToUserId },
        after: { assignedToUserId: updated.assignedToUserId },
      },
    });
    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.ticket.assigned',
    payload: { ticketId: ticket.id, assignedToUserId: ticket.assignedToUserId },
    dedupeKey: `crm.ticket.assigned:${ticket.id}:${ticket.updatedAt.toISOString()}`,
  });

  return toView(ticket);
}

/**
 * Record that somebody answered.
 *
 * Called by the engagement spine when an OUTBOUND message lands on a ticket —
 * which is the honest signal, and far better than asking a person to press a
 * "mark as responded" button they will forget on exactly the days it matters.
 *
 * First response only: writes nothing if one is already recorded, so a thread
 * of six replies still measures the first.
 */
export async function recordFirstResponse(
  ctx: ServiceContext,
  ticketId: string,
  at: Date = new Date()
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    // updateMany with the null guard rather than read-then-write: two replies
    // sent at once would otherwise both see "no response yet" and race.
    await tx.ticket.updateMany({
      where: { id: ticketId, firstRespondedAt: null, deletedAt: null },
      data: { firstRespondedAt: at },
    });
  });
}

/**
 * Record something the CUSTOMER said on their own request — the portal reply.
 *
 * The important thing this does is what it does NOT do: it never touches
 * `firstRespondedAt`. That column means "the business got back to them", and a
 * customer chasing their own unanswered request must not be what settles the
 * promise to answer it. Getting that backwards would make the queue read best
 * exactly when it was performing worst — the more a customer had to chase, the
 * more requests would look replied-to.
 *
 * It deliberately does not reopen a resolved request either. Whether "thanks,
 * that fixed it" should reopen a request is the tenant's call, not ours, and the
 * event published here is what lets them decide it in an automation. What the
 * message always does is land on the timeline, which is shared with the
 * customer's record — so whoever picks the request up next sees it.
 */
export async function recordCustomerMessage(
  ctx: ServiceContext,
  ticketId: string,
  args: { customerId: string; body: string }
): Promise<void> {
  const ticket = await withTenant(ctx, async (tx) => {
    // Re-assert ownership inside the transaction rather than trusting the
    // caller's check: this is reachable from a public route, and the id in the
    // URL is a customer's to edit.
    const row = await tx.ticket.findFirst({
      where: { id: ticketId, customerId: args.customerId, deletedAt: null },
      select: { id: true, number: true, customerId: true, b2bAccountId: true },
    });
    if (!row) throw new CrmNotFoundError('Ticket', ticketId);

    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: row.customerId,
        b2bAccountId: row.b2bAccountId,
        type: 'ticket.customer_replied',
        description: `Request #${String(row.number)}: ${args.body}`,
        // The customer, not a member of staff — so the timeline attributes it to
        // them and no audit trail claims an employee wrote it.
        actorId: null,
        actorType: 'customer',
        occurredAt: new Date(),
        linkedEntityType: 'Ticket',
        linkedEntityId: row.id,
        metadata: {},
      },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.ticket.updated',
    payload: {
      ticketId: ticket.id,
      number: ticket.number,
      customerId: ticket.customerId,
      customerReplied: true,
    },
    // Time-based rather than id-based: unlike opening a request, a customer may
    // legitimately say several things, and each one has to get through.
    dedupeKey: `crm.ticket.customer_replied:${ticket.id}:${Date.now().toString()}`,
  });
}

/**
 * Point a conversation at a request.
 *
 * Called by the intake when an inbound email opens a ticket, so the words the
 * customer actually wrote appear ON the ticket rather than in a separate
 * conversation list. Without this the two exist side by side and nobody links
 * them, which is the failure mode a support queue is supposed to fix.
 *
 * Idempotent, and refuses to steal a thread that already belongs to a different
 * request — a thread claimed twice would move a customer's words off the ticket
 * someone is reading.
 */
export async function linkThread(
  ctx: ServiceContext,
  args: { ticketId: string; threadId: string }
): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await tx.engagementThread.updateMany({
      where: { id: args.threadId, OR: [{ ticketId: null }, { ticketId: args.ticketId }] },
      data: { ticketId: args.ticketId },
    });
  });
}

/**
 * Soft-delete — for a request that should never have existed (spam, a
 * duplicate), not for one that is finished. The normal end of a request is
 * `moveStage` onto a closed stage, which keeps it in the queue's history.
 */
export async function softDelete(ctx: ServiceContext, ticketId: string): Promise<Ticket> {
  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.ticket.findUnique({ where: { id: ticketId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Ticket', ticketId);
    const updated = await tx.ticket.update({
      where: { id: ticketId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.ticket.deleted',
      entityType: 'Ticket',
      entityId: updated.id,
      diff: { before: { subject: before.subject }, after: { deletedAt: updated.deletedAt } },
    });
    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.ticket.updated',
    payload: { ticketId: result.id, change: 'deleted' },
    dedupeKey: `crm.ticket.deleted:${result.id}`,
  });

  return result;
}
