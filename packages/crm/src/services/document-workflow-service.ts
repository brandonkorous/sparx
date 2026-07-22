// documentWorkflowService — invoicing document workflows + their stages
// (docs/87 §3). A tenant configures one or more workflows (e.g. "Invoice",
// "Service / Repair"); each has an ordered stage list whose `customerLabel`
// is what the customer sees and whose `stageType` drives system behavior.
//
// Mirrors pipelineService (22-crm-pipelines / pipeline-service.ts). Unlike
// pipeline_stages there is no UNIQUE (workflow_id, sort_order) constraint, so
// stage reorder is a straight rewrite inside one transaction.

import {
  CreateDocumentStageInput,
  CreateDocumentWorkflowInput,
  ReorderDocumentStagesInput,
  UpdateDocumentStageInput,
  UpdateDocumentWorkflowInput,
} from '@sparx/crm-schemas';
import { DEFAULT_DOCUMENT_WORKFLOWS } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { DocumentStage, DocumentWorkflow, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

type WorkflowWithStages = DocumentWorkflow & { stages: DocumentStage[] };

// ─────────────────────────────────────────────────────────────────────────
// Workflows
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  args: { includeArchived?: boolean } = {}
): Promise<WorkflowWithStages[]> {
  return withTenant(ctx, (tx) =>
    tx.documentWorkflow.findMany({
      where: args.includeArchived ? {} : { archivedAt: null },
      orderBy: [{ isDefault: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
  );
}

/** Columns a caller may order by. A whitelist rather than a free-form field
 *  name: this reaches the database, and `orderBy` is not a place to forward
 *  user input to. */
export type ListWorkflowsSortBy = 'name' | 'slug' | 'stages' | 'state' | 'updatedAt' | 'createdAt';

/**
 * The tenant's OWN arrangement — default workflow first, then the order they
 * put them in. It is the only ordering that carries meaning rather than just
 * being a sort, so it stays the answer when no sort is asked for.
 */
const DEFAULT_ORDER: Prisma.DocumentWorkflowOrderByWithRelationInput[] = [
  { isDefault: 'desc' },
  { sortOrder: 'asc' },
  { createdAt: 'asc' },
];

function orderByFor(
  sortBy: ListWorkflowsSortBy | undefined,
  order: 'asc' | 'desc'
): Prisma.DocumentWorkflowOrderByWithRelationInput[] {
  switch (sortBy) {
    case 'name':
      return [{ name: order }, { id: order }];
    case 'slug':
      return [{ slug: order }, { id: order }];
    // How many steps a workflow has, ordered in the database rather than by
    // counting the included stages in JS — a page of 25 can only sort the 25 it
    // was given, which puts the shortest workflow on page 4 above the longest
    // one on page 1.
    case 'stages':
      return [{ stages: { _count: order } }, { name: 'asc' }];
    // Active/archived is a null check, so the nulls decide the grouping:
    // ascending reads "active first", which is the useful direction.
    case 'state':
      return [
        { archivedAt: { sort: order, nulls: order === 'asc' ? 'first' : 'last' } },
        { name: 'asc' },
      ];
    case 'updatedAt':
      return [{ updatedAt: order }, { id: order }];
    case 'createdAt':
      return [{ createdAt: order }, { id: order }];
    default:
      return DEFAULT_ORDER;
  }
}

// Paginated/searchable/sortable variant — kept separate from `list()` above
// (which several MCP tools + tests depend on returning a bare array) rather
// than changing that function's shape.
//
// Paging and sorting are both server-side because the row count is not bounded
// by anything: a tenant with one brand has three workflows, and a manufacturer
// running a different document flow per product line, region or dealer tier can
// have hundreds. Sorting the loaded page in the browser would silently mean
// "sort these 25", which is a different answer from the one the header claims.
export async function listPaged(
  ctx: ServiceContext,
  args: {
    q?: string;
    /**
     * Supersedes `includeArchived`, which can only ever say "active" or
     * "everything" — there is no way to ask it for the archived ones alone. A
     * caller that CAN page cannot narrow the result client-side to get them
     * either: filtering a 25-row window leaves 3 rows on a page that claims 25,
     * and a total that counts rows the screen is hiding.
     */
    state?: 'active' | 'archived' | 'all';
    /** Legacy two-way flag. Ignored when `state` is given. */
    includeArchived?: boolean;
    take?: number;
    skip?: number;
    sortBy?: ListWorkflowsSortBy;
    order?: 'asc' | 'desc';
  } = {}
): Promise<{ items: WorkflowWithStages[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const archivedWhere = (): Prisma.DocumentWorkflowWhereInput => {
      switch (args.state) {
        case 'archived':
          return { archivedAt: { not: null } };
        case 'all':
          return {};
        case 'active':
          return { archivedAt: null };
        default:
          return args.includeArchived ? {} : { archivedAt: null };
      }
    };

    const where: Prisma.DocumentWorkflowWhereInput = {
      ...archivedWhere(),
      ...(args.q
        ? {
            OR: [
              { name: { contains: args.q, mode: 'insensitive' } },
              { slug: { contains: args.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.documentWorkflow.findMany({
        where,
        orderBy: orderByFor(args.sortBy, args.order ?? 'asc'),
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
        take: Math.min(args.take ?? 50, 250),
        skip: args.skip ?? 0,
      }),
      tx.documentWorkflow.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, workflowId: string): Promise<WorkflowWithStages> {
  const workflow = await withTenant(ctx, (tx) =>
    tx.documentWorkflow.findUnique({
      where: { id: workflowId },
      include: { stages: { orderBy: { sortOrder: 'asc' } } },
    })
  );
  if (!workflow) throw new CrmNotFoundError('DocumentWorkflow', workflowId);
  return workflow;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<DocumentWorkflow> {
  const input = CreateDocumentWorkflowInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    // Only one default per tenant — clearing here keeps the invariant even if
    // two workflows are created with isDefault in the same session.
    if (input.isDefault) {
      await tx.documentWorkflow.updateMany({
        where: { isDefault: true },
        data: { isDefault: false },
      });
    }
    const created = await tx.documentWorkflow.create({
      data: {
        tenantId: ctx.tenantId,
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
      action: 'invoicing.workflow.created',
      entityType: 'DocumentWorkflow',
      entityId: created.id,
      diff: { after: { name: created.name, slug: created.slug } },
    });
    return created;
  });
}

export async function update(
  ctx: ServiceContext,
  workflowId: string,
  rawInput: unknown
): Promise<DocumentWorkflow> {
  const input = UpdateDocumentWorkflowInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.documentWorkflow.findUnique({ where: { id: workflowId } });
    if (!before) throw new CrmNotFoundError('DocumentWorkflow', workflowId);
    if (input.isDefault) {
      await tx.documentWorkflow.updateMany({
        where: { isDefault: true, id: { not: workflowId } },
        data: { isDefault: false },
      });
    }
    const updated = await tx.documentWorkflow.update({
      where: { id: workflowId },
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
      action: 'invoicing.workflow.updated',
      entityType: 'DocumentWorkflow',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

export async function archive(ctx: ServiceContext, workflowId: string): Promise<DocumentWorkflow> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.documentWorkflow.findUnique({ where: { id: workflowId } });
    if (!before) throw new CrmNotFoundError('DocumentWorkflow', workflowId);
    const updated = await tx.documentWorkflow.update({
      where: { id: workflowId },
      data: { archivedAt: new Date(), isDefault: false },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.workflow.archived',
      entityType: 'DocumentWorkflow',
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
  workflowId: string,
  rawInput: unknown
): Promise<DocumentStage> {
  const input = CreateDocumentStageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const workflow = await tx.documentWorkflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new CrmNotFoundError('DocumentWorkflow', workflowId);
    const created = await tx.documentStage.create({
      data: {
        tenantId: ctx.tenantId,
        workflowId,
        name: input.name,
        customerLabel: input.customerLabel,
        stageType: input.stageType,
        snapshotOnEnter: input.snapshotOnEnter,
        numberOnEnter: input.numberOnEnter,
        numberPrefix: input.numberPrefix ?? null,
        locksEditing: input.locksEditing,
        color: input.color ?? null,
        sortOrder: input.sortOrder,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.stage.created',
      entityType: 'DocumentStage',
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
): Promise<DocumentStage> {
  const input = UpdateDocumentStageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.documentStage.findUnique({ where: { id: stageId } });
    if (!before) throw new CrmNotFoundError('DocumentStage', stageId);
    const updated = await tx.documentStage.update({
      where: { id: stageId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.customerLabel !== undefined ? { customerLabel: input.customerLabel } : {}),
        ...(input.stageType !== undefined ? { stageType: input.stageType } : {}),
        ...(input.snapshotOnEnter !== undefined ? { snapshotOnEnter: input.snapshotOnEnter } : {}),
        ...(input.numberOnEnter !== undefined ? { numberOnEnter: input.numberOnEnter } : {}),
        ...(input.numberPrefix !== undefined ? { numberPrefix: input.numberPrefix } : {}),
        ...(input.locksEditing !== undefined ? { locksEditing: input.locksEditing } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.stage.updated',
      entityType: 'DocumentStage',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

export async function deleteStage(ctx: ServiceContext, stageId: string): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.documentStage.findUnique({ where: { id: stageId } });
    if (!before) throw new CrmNotFoundError('DocumentStage', stageId);
    await tx.documentStage.delete({ where: { id: stageId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.stage.deleted',
      entityType: 'DocumentStage',
      entityId: stageId,
      diff: { before: { name: before.name } },
    });
    return { id: stageId };
  });
}

/** Reorder stages to the supplied order. No UNIQUE(workflow_id, sort_order)
 *  constraint exists, so a single pass inside one transaction is safe. */
export async function reorderStages(
  ctx: ServiceContext,
  workflowId: string,
  rawInput: unknown
): Promise<DocumentStage[]> {
  const input = ReorderDocumentStagesInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const workflow = await tx.documentWorkflow.findUnique({
      where: { id: workflowId },
      include: { stages: true },
    });
    if (!workflow) throw new CrmNotFoundError('DocumentWorkflow', workflowId);

    const ownedIds = new Set(workflow.stages.map((s) => s.id));
    for (const id of input.stageIds) {
      if (!ownedIds.has(id)) throw new CrmNotFoundError('DocumentStage', id);
    }
    for (let i = 0; i < input.stageIds.length; i++) {
      const id = input.stageIds[i];
      if (!id) continue; // noUncheckedIndexedAccess
      await tx.documentStage.update({ where: { id }, data: { sortOrder: i } });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.stage.reordered',
      entityType: 'DocumentWorkflow',
      entityId: workflowId,
      diff: { after: { stageOrder: input.stageIds } },
    });
    return tx.documentStage.findMany({ where: { workflowId }, orderBy: { sortOrder: 'asc' } });
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Bootstrap — seed the built-in workflows for a tenant on module activation.
// Idempotent: a workflow whose slug already exists is skipped, so a re-run is
// a no-op and never duplicates.
// ─────────────────────────────────────────────────────────────────────────

export async function bootstrapDefaultWorkflows(
  ctx: ServiceContext
): Promise<WorkflowWithStages[]> {
  return withTenant(ctx, async (tx) => {
    const result: WorkflowWithStages[] = [];
    for (const template of DEFAULT_DOCUMENT_WORKFLOWS) {
      const existing = await tx.documentWorkflow.findUnique({
        where: { tenantId_slug: { tenantId: ctx.tenantId, slug: template.slug } },
        include: { stages: { orderBy: { sortOrder: 'asc' } } },
      });
      if (existing) {
        result.push(existing);
        continue;
      }
      const workflow = await tx.documentWorkflow.create({
        data: {
          tenantId: ctx.tenantId,
          name: template.name,
          slug: template.slug,
          isDefault: template.isDefault,
          sortOrder: template.sortOrder,
          stages: {
            create: template.stages.map((s) => ({
              tenantId: ctx.tenantId,
              name: s.name,
              customerLabel: s.customerLabel,
              stageType: s.stageType,
              snapshotOnEnter: s.snapshotOnEnter,
              numberOnEnter: s.numberOnEnter,
              numberPrefix: s.numberPrefix ?? null,
              locksEditing: s.locksEditing,
              color: s.color ?? null,
              sortOrder: s.sortOrder,
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
        action: 'invoicing.workflow.bootstrapped',
        entityType: 'DocumentWorkflow',
        entityId: workflow.id,
        diff: { after: { slug: workflow.slug } },
      });
      result.push(workflow);
    }
    return result;
  });
}
