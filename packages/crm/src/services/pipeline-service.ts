// pipelineService — sales pipelines + their stages (docs/11 §4).
//
// A tenant runs multiple pipelines; each has its own ordered stage list.
// Stage reorder rewrites sort_order atomically inside one transaction so
// the UNIQUE (pipeline_id, sort_order) constraint never spuriously trips
// while half the rows have the new order and half the old.

import {
  CreatePipelineInput,
  CreatePipelineStageInput,
  ReorderPipelineStagesInput,
  UpdatePipelineInput,
  UpdatePipelineStageInput,
  stageTypesFor,
  type StageType,
} from '@sparx/crm-schemas';
import { DEFAULT_PIPELINE_TEMPLATE } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Pipeline, PipelineStage, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError, CrmValidationError } from '../errors';

/**
 * A stage's meaning has to belong to the object the pipeline moves.
 *
 * `StageType` is one permissive enum across every object (docs/144 §7.2), which
 * is right for storage and wrong at the boundary: a DEAL parked on a "Resolved"
 * stage is counted as neither won nor lost, so it vanishes from the forecast and
 * from the funnel's denominator at the same time — silently, and only in the
 * reports, which is where nobody looks for a data-entry mistake.
 */
function assertStageTypeFits(objectKey: string, stageType: StageType): void {
  const allowed = stageTypesFor(objectKey);
  if (allowed.includes(stageType)) return;
  throw new CrmValidationError(
    `A ${objectKey} stage cannot be "${stageType}". Use one of: ${allowed.join(', ')}.`,
    [{ field: 'stageType', message: `not valid for ${objectKey}` }]
  );
}

// ─────────────────────────────────────────────────────────────────────────
// Pipelines
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  args: {
    q?: string;
    includeArchived?: boolean;
    /**
     * Which object's processes to list (docs/144 §7.2). Defaults to `deal`,
     * NOT to "everything": every caller that existed before pipelines became
     * generic meant sales, and returning the support queue to a deal-board
     * stage picker would put "Waiting on Customer" in front of a rep.
     * Pass `'all'` to genuinely mean all of them.
     */
    objectKey?: string;
    /** Member's reachable sites (docs/131 §3.3); undefined = unrestricted. */
    propertyIds?: string[];
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: (Pipeline & { stages: PipelineStage[] })[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const objectKey = args.objectKey ?? 'deal';
    const where: Prisma.PipelineWhereInput = {
      ...(objectKey === 'all' ? {} : { objectKey }),
      ...(args.includeArchived ? {} : { archivedAt: null }),
      ...(args.propertyIds
        ? { OR: [{ propertyId: { in: args.propertyIds } }, { propertyId: null }] }
        : {}),
      ...(args.q ? { name: { contains: args.q, mode: 'insensitive' } } : {}),
    };
    const [items, total] = await Promise.all([
      tx.pipeline.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
        take: Math.min(args.take ?? 50, 250),
        skip: args.skip ?? 0,
      }),
      tx.pipeline.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(
  ctx: ServiceContext,
  pipelineId: string
): Promise<Pipeline & { stages: PipelineStage[] }> {
  const pipeline = await withTenant(ctx, (tx) =>
    tx.pipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
  );
  if (!pipeline) throw new CrmNotFoundError('Pipeline', pipelineId);
  return pipeline;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Pipeline> {
  const input = CreatePipelineInput.parse(rawInput);

  const pipeline = await withTenant(ctx, async (tx) => {
    const created = await tx.pipeline.create({
      data: {
        tenantId: ctx.tenantId,
        // The site this sales process belongs to (docs/131 §5); the route
        // defaults it to the site being worked in, explicit null = tenant-wide.
        propertyId: input.propertyId ?? null,
        objectKey: input.objectKey,
        name: input.name,
        slug: input.slug,
        isDefault: input.isDefault,
        sortOrder: input.sortOrder,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline.created',
      entityType: 'Pipeline',
      entityId: created.id,
      diff: { after: { name: created.name, slug: created.slug } },
    });
    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.pipeline.created',
    payload: { pipelineId: pipeline.id, slug: pipeline.slug },
    dedupeKey: `crm.pipeline.created:${pipeline.id}`,
  });
  return pipeline;
}

export async function update(
  ctx: ServiceContext,
  pipelineId: string,
  rawInput: unknown
): Promise<Pipeline> {
  const input = UpdatePipelineInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.pipeline.findUnique({ where: { id: pipelineId } });
    if (!before) throw new CrmNotFoundError('Pipeline', pipelineId);
    const updated = await tx.pipeline.update({
      where: { id: pipelineId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline.updated',
      entityType: 'Pipeline',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

export async function archive(ctx: ServiceContext, pipelineId: string): Promise<Pipeline> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.pipeline.findUnique({ where: { id: pipelineId } });
    if (!before) throw new CrmNotFoundError('Pipeline', pipelineId);
    const updated = await tx.pipeline.update({
      where: { id: pipelineId },
      data: { archivedAt: new Date(), isDefault: false },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline.archived',
      entityType: 'Pipeline',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Stages
// ─────────────────────────────────────────────────────────────────────────

export async function createStage(
  ctx: ServiceContext,
  pipelineId: string,
  rawInput: unknown
): Promise<PipelineStage> {
  const input = CreatePipelineStageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const pipeline = await tx.pipeline.findUnique({ where: { id: pipelineId } });
    if (!pipeline) throw new CrmNotFoundError('Pipeline', pipelineId);
    assertStageTypeFits(pipeline.objectKey, input.stageType);
    const created = await tx.pipelineStage.create({
      data: {
        tenantId: ctx.tenantId,
        pipelineId,
        name: input.name,
        sortOrder: input.sortOrder,
        probability: input.probability,
        stageType: input.stageType,
        color: input.color ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline_stage.created',
      entityType: 'PipelineStage',
      entityId: created.id,
      diff: { after: { name: created.name } },
    });
    return created;
  });
}

export async function updateStage(
  ctx: ServiceContext,
  stageId: string,
  rawInput: unknown
): Promise<PipelineStage> {
  const input = UpdatePipelineStageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.pipelineStage.findUnique({
      where: { id: stageId },
      include: { pipeline: { select: { objectKey: true } } },
    });
    if (!before) throw new CrmNotFoundError('PipelineStage', stageId);
    if (input.stageType !== undefined) {
      assertStageTypeFits(before.pipeline.objectKey, input.stageType);
    }
    const updated = await tx.pipelineStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.stageType !== undefined ? { stageType: input.stageType } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline_stage.updated',
      entityType: 'PipelineStage',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

/**
 * Delete a stage from a pipeline.
 *
 * Two guards make this safe rather than destructive:
 *   • A pipeline must keep at least one stage — deleting the last is refused
 *     (409), because its records have nowhere to live otherwise.
 *   • A stage that still has open records on it cannot just vanish: the caller
 *     must name a DIFFERENT stage on the SAME pipeline to move them to, and the
 *     move + delete run in one transaction. With nothing on it, the stage is
 *     removed directly. Returns the pipeline with its remaining stages.
 *
 * "Records" means deals or tickets, whichever this pipeline moves (docs/144
 * §7.2) — the wording below follows, because "this stage still has deals on it"
 * is meaningless on a support queue.
 */
export async function deleteStage(
  ctx: ServiceContext,
  args: { pipelineId: string; stageId: string; reassignToStageId?: string }
): Promise<Pipeline & { stages: PipelineStage[] }> {
  const result = await withTenant(ctx, async (tx) => {
    const pipeline = await tx.pipeline.findUnique({
      where: { id: args.pipelineId },
      include: { stages: true },
    });
    if (!pipeline) throw new CrmNotFoundError('Pipeline', args.pipelineId);

    const stage = pipeline.stages.find((s) => s.id === args.stageId);
    if (!stage) throw new CrmNotFoundError('PipelineStage', args.stageId);

    if (pipeline.stages.length <= 1) {
      throw new CrmConflictError(
        'A pipeline must keep at least one stage. Add another stage before removing this one.',
        'stageId'
      );
    }

    // Whichever kind of record this pipeline moves. A support queue's stage can
    // be as full as a sales pipeline's, and counting only deals would have
    // deleted a stage out from under every open request on it — the FK would
    // then refuse the delete with a constraint error nobody could act on.
    const isTickets = pipeline.objectKey === 'ticket';
    const recordsOnStage = isTickets
      ? await tx.ticket.count({ where: { stageId: args.stageId, deletedAt: null } })
      : await tx.deal.count({ where: { stageId: args.stageId, deletedAt: null } });

    const noun = isTickets ? 'requests' : 'deals';
    let movedRecords = 0;
    if (recordsOnStage > 0) {
      if (!args.reassignToStageId) {
        throw new CrmValidationError(
          `This stage still has ${noun} on it. Choose a stage to move them to before removing it.`,
          [{ field: 'reassignToStageId', message: `required when the stage has ${noun}` }]
        );
      }
      if (args.reassignToStageId === args.stageId) {
        throw new CrmValidationError(`Choose a different stage to move the ${noun} to.`, [
          { field: 'reassignToStageId', message: 'must differ from the stage being removed' },
        ]);
      }
      const target = pipeline.stages.find((s) => s.id === args.reassignToStageId);
      if (!target) throw new CrmNotFoundError('PipelineStage', args.reassignToStageId);

      const moved = isTickets
        ? await tx.ticket.updateMany({
            where: { stageId: args.stageId, deletedAt: null },
            data: { stageId: args.reassignToStageId },
          })
        : await tx.deal.updateMany({
            where: { stageId: args.stageId, deletedAt: null },
            data: { stageId: args.reassignToStageId },
          });
      movedRecords = moved.count;
    }

    await tx.pipelineStage.delete({ where: { id: args.stageId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline_stage.deleted',
      entityType: 'PipelineStage',
      entityId: args.stageId,
      diff: {
        before: { name: stage.name, pipelineId: args.pipelineId },
        after: { movedRecords, reassignedTo: args.reassignToStageId ?? null },
      },
    });

    const refreshed = await tx.pipeline.findUnique({
      where: { id: args.pipelineId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    // Just deleted a stage on it, so it exists — narrow for the type checker.
    if (!refreshed) throw new CrmNotFoundError('Pipeline', args.pipelineId);
    return refreshed;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.pipeline.updated',
    payload: { pipelineId: args.pipelineId, change: 'stage_deleted' },
    dedupeKey: `crm.pipeline.stage_deleted:${args.stageId}`,
  });

  return result;
}

/** Reorder stages atomically. Postgres' UNIQUE (pipeline_id, sort_order)
 *  index would trip if we set the new order one row at a time, so we run
 *  a two-pass update inside a single transaction: bump every stage to a
 *  negative-offset slot first (which never collides), then write the new
 *  positive order. The whole pass is one transaction. */
export async function reorderStages(
  ctx: ServiceContext,
  pipelineId: string,
  rawInput: unknown
): Promise<PipelineStage[]> {
  const input = ReorderPipelineStagesInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const pipeline = await tx.pipeline.findUnique({
      where: { id: pipelineId },
      include: { stages: true },
    });
    if (!pipeline) throw new CrmNotFoundError('Pipeline', pipelineId);

    const ownedIds = new Set(pipeline.stages.map((s) => s.id));
    for (const id of input.stageIds) {
      if (!ownedIds.has(id)) {
        throw new CrmNotFoundError('PipelineStage', id);
      }
    }

    // Pass 1: shift every stage to a non-colliding negative range.
    let pass1 = -1;
    for (const stage of pipeline.stages) {
      await tx.pipelineStage.update({
        where: { id: stage.id },
        data: { sortOrder: pass1-- },
      });
    }
    // Pass 2: assign requested positive order.
    for (let i = 0; i < input.stageIds.length; i++) {
      const id = input.stageIds[i];
      if (!id) continue; // noUncheckedIndexedAccess: must narrow
      await tx.pipelineStage.update({ where: { id }, data: { sortOrder: i } });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.pipeline_stage.reordered',
      entityType: 'Pipeline',
      entityId: pipelineId,
      diff: { after: { stageOrder: input.stageIds } },
    });

    return tx.pipelineStage.findMany({
      where: { pipelineId },
      orderBy: { sortOrder: 'asc' },
    });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Bootstrap — applies the default pipeline template for a tenant.
// Called once on tenant creation; idempotent so a re-run on an already-
// bootstrapped tenant is a no-op.
// ─────────────────────────────────────────────────────────────────────────

export async function bootstrapDefaultPipeline(
  ctx: ServiceContext
): Promise<Pipeline & { stages: PipelineStage[] }> {
  return withTenant(ctx, async (tx) => {
    // The default pipeline is TENANT-WIDE (property_id null) — the starter sales
    // process every business inherits until it authors its own. findFirst, not
    // findUnique: the unique is now (tenant, property, slug) NULLS NOT DISTINCT,
    // and Prisma cannot reach a null-property row through a compound-unique key.
    const existing = await tx.pipeline.findFirst({
      where: { propertyId: null, objectKey: 'deal', slug: DEFAULT_PIPELINE_TEMPLATE.slug },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) return existing;

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: null,
        objectKey: 'deal',
        name: DEFAULT_PIPELINE_TEMPLATE.name,
        slug: DEFAULT_PIPELINE_TEMPLATE.slug,
        isDefault: DEFAULT_PIPELINE_TEMPLATE.isDefault,
        stages: {
          create: DEFAULT_PIPELINE_TEMPLATE.stages.map((s) => ({
            tenantId: ctx.tenantId,
            name: s.name,
            sortOrder: s.sortOrder,
            probability: s.probability,
            stageType: s.stageType,
            color: s.color ?? null,
          })),
        },
      },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'crm.pipeline.bootstrapped',
      entityType: 'Pipeline',
      entityId: pipeline.id,
      diff: { after: { slug: pipeline.slug } },
    });
    return pipeline;
  });
}
