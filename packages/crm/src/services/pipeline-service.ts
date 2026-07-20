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
} from '@sparx/crm-schemas';
import { DEFAULT_PIPELINE_TEMPLATE } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Pipeline, PipelineStage, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

// ─────────────────────────────────────────────────────────────────────────
// Pipelines
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  args: {
    q?: string;
    includeArchived?: boolean;
    /** Member's reachable sites (docs/131 §3.3); undefined = unrestricted. */
    propertyIds?: string[];
    take?: number;
    skip?: number;
  } = {}
): Promise<{ items: (Pipeline & { stages: PipelineStage[] })[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.PipelineWhereInput = {
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
    const before = await tx.pipelineStage.findUnique({ where: { id: stageId } });
    if (!before) throw new CrmNotFoundError('PipelineStage', stageId);
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
      where: { propertyId: null, slug: DEFAULT_PIPELINE_TEMPLATE.slug },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    });
    if (existing) return existing;

    const pipeline = await tx.pipeline.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: null,
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
