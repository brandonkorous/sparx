// dealService — sales opportunities (docs/11 §4).
//
// Locked decisions in play here:
//   #5 — deals attach to orders/billing documents via join tables
//        (deal_orders / deal_billing_documents), never via columns on
//        orders/documents. attachOrder / attachDocument are the only paths
//        that write to those tables.
//   #6 — moveStage emits crm.deal.stage_changed; the email module's
//        automation engine subscribes to this topic to trigger the
//        documented templates. Going through update() instead of
//        moveStage() would skip the event — moveStage is the only
//        sanctioned stage-change path.

import { CreateDealInput, MoveDealStageInput, UpdateDealInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { Deal, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import { syncPrimaryFromColumn } from './association-service';
import { changedProperties, resolvePropertyBag, toJsonInput } from './custom-properties';
import { schemaFor } from './object-def-service';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

/**
 * Record what `customer_id` / `b2b_account_id` already say, as primary
 * relationships (docs/144 §6).
 *
 * The bridge in the direction nobody thinks about: the association panel is not
 * the only thing that links a deal to a customer — the order consumer, the
 * import worker and every existing form write the column directly. Without this,
 * the graph would only know about deals someone had opened the panel on, and
 * "who is involved" would be right for new deals and blank for every old one.
 */
async function syncDealAssociations(
  tx: Prisma.TransactionClient,
  tenantId: string,
  deal: Deal
): Promise<void> {
  await syncPrimaryFromColumn(tx, tenantId, 'deal', deal.id, 'contact', deal.customerId);
  await syncPrimaryFromColumn(tx, tenantId, 'deal', deal.id, 'company', deal.companyId);
}

export interface ListDealsFilter {
  q?: string;
  pipelineId?: string;
  stageId?: string;
  assignedRepId?: string | null;
  customerId?: string;
  companyId?: string;
  /** The sites this member may reach (docs/131 §3.3 read-scoping); undefined = an
   *  unrestricted member who sees every site. A restricted member sees deals on
   *  their granted sites PLUS tenant-wide (null-property) deals — the same
   *  "site's own + shared" shape every other scoped read uses. */
  propertyIds?: string[];
  /** "open" excludes deals on won/lost stages; "closed" includes only those. */
  state?: 'open' | 'closed';
  take?: number;
  skip?: number;
}

// The stage a deal sits on and the customer it is for, pulled alongside so a
// list can name both without a per-row fetch. Additive — a consumer that ignores
// the nested objects is unaffected.
const dealSubjectInclude = {
  stage: { select: { name: true, stageType: true } },
  customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
} satisfies Prisma.DealInclude;

export async function list(
  ctx: ServiceContext,
  filter: ListDealsFilter = {}
): Promise<{ items: Deal[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.DealWhereInput = {
      deletedAt: null,
      ...(filter.propertyIds
        ? { OR: [{ propertyId: { in: filter.propertyIds } }, { propertyId: null }] }
        : {}),
      ...(filter.q ? { title: { contains: filter.q, mode: 'insensitive' } } : {}),
      ...(filter.pipelineId ? { pipelineId: filter.pipelineId } : {}),
      ...(filter.stageId ? { stageId: filter.stageId } : {}),
      ...(filter.assignedRepId !== undefined ? { assignedRepId: filter.assignedRepId } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.companyId ? { companyId: filter.companyId } : {}),
      ...(filter.state === 'open'
        ? { closedAt: null }
        : filter.state === 'closed'
          ? { closedAt: { not: null } }
          : {}),
    };
    const [items, total] = await Promise.all([
      tx.deal.findMany({
        where,
        include: dealSubjectInclude,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.deal.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, dealId: string): Promise<Deal> {
  const deal = await withTenant(ctx, (tx) =>
    tx.deal.findUnique({ where: { id: dealId }, include: dealSubjectInclude })
  );
  if (deal?.deletedAt !== null) throw new CrmNotFoundError('Deal', dealId);
  return deal;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Deal> {
  const input = CreateDealInput.parse(rawInput);

  const deal = await withTenant(ctx, async (tx) => {
    // Validate the stage belongs to the supplied pipeline. RLS already
    // scopes both to the tenant; this check catches stage-pipeline mismatch
    // before the FK constraint trips.
    const stage = await tx.pipelineStage.findUnique({ where: { id: input.stageId } });
    if (stage?.pipelineId !== input.pipelineId) {
      throw new CrmValidationError('Stage does not belong to the supplied pipeline', [
        { field: 'stageId', message: 'Stage and pipeline must match' },
      ]);
    }

    // The deal inherits its site from the pipeline it lives in (docs/131 §5),
    // read here and denormalized onto the row — not taken from the request, so a
    // deal always belongs to the same business as its pipeline.
    const pipeline = await tx.pipeline.findUnique({
      where: { id: input.pipelineId },
      select: { propertyId: true },
    });

    // Tenant-declared extra fields (docs/144 §3), validated + calculated in the
    // same transaction that writes the deal.
    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'deal', tx),
      existing: {},
      incoming: input.customProperties ?? {},
    });

    const created = await tx.deal.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: pipeline?.propertyId ?? null,
        pipelineId: input.pipelineId,
        stageId: input.stageId,
        customerId: input.customerId ?? null,
        companyId: input.companyId ?? null,
        assignedRepId: input.assignedRepId ?? null,
        title: input.title,
        value: input.value,
        currency: input.currency,
        probability: input.probability,
        expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
        source: input.source ?? null,
        tags: input.tags ?? [],
        metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
    });

    // Also drop a CRM activity for the deal creation so the timeline picks
    // it up. Keeping this inline (vs going through activityService) keeps
    // the side effect inside the same transaction as the deal write.
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: created.customerId,
        dealId: created.id,
        companyId: created.companyId,
        type: 'deal.created',
        description: `Deal "${created.title}" created`,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: created.createdAt,
        linkedEntityType: 'Deal',
        linkedEntityId: created.id,
      },
    });

    // The relationship graph (docs/144 §6) records what the FK columns already
    // say, so "who is involved in this deal" is answerable from one place from
    // the very first deal — rather than only for deals created after someone
    // opened the association panel.
    await syncDealAssociations(tx, ctx.tenantId, created);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.created',
      entityType: 'Deal',
      entityId: created.id,
      diff: { after: { title: created.title, value: created.value.toString() } },
    });

    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.created',
    payload: { dealId: deal.id, pipelineId: deal.pipelineId, stageId: deal.stageId },
    dedupeKey: `crm.deal.created:${deal.id}`,
  });

  return deal;
}

export async function update(
  ctx: ServiceContext,
  dealId: string,
  rawInput: unknown
): Promise<Deal> {
  const input = UpdateDealInput.parse(rawInput);

  // Guardrail: stageId changes MUST go through moveStage() so the
  // stage_changed event fires. We reject stageId in the generic update
  // path rather than silently emitting the wrong event.
  if (input.stageId !== undefined) {
    throw new CrmValidationError(
      'Stage changes must go through dealService.moveStage so the deal.stage_changed event fires',
      [{ field: 'stageId', message: 'Use moveStage() to change the stage' }]
    );
  }

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.deal.findUnique({ where: { id: dealId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Deal', dealId);

    // Merged onto what is stored — a PATCH carrying one extra detail means
    // "change this one", never "delete the others".
    const customProperties = resolvePropertyBag({
      schema: await schemaFor(ctx, 'deal', tx),
      existing: before.customProperties,
      incoming: input.customProperties,
    });

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: {
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.currency !== undefined ? { currency: input.currency } : {}),
        ...(input.probability !== undefined ? { probability: input.probability } : {}),
        ...(input.expectedCloseDate !== undefined
          ? {
              expectedCloseDate: input.expectedCloseDate ? new Date(input.expectedCloseDate) : null,
            }
          : {}),
        ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
        ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
        ...(input.assignedRepId !== undefined ? { assignedRepId: input.assignedRepId } : {}),
        ...(input.source !== undefined ? { source: input.source } : {}),
        // Correcting the reason is a plain edit — the stage is not moving, so it
        // deliberately does NOT go down the `moveStage` path or emit its event.
        ...(input.closedReason !== undefined ? { closedReason: input.closedReason } : {}),
        ...(input.tags !== undefined ? { tags: input.tags } : {}),
        ...(input.metadata !== undefined
          ? { metadata: input.metadata as Prisma.InputJsonValue }
          : {}),
        ...(customProperties !== undefined
          ? { customProperties: toJsonInput(customProperties) }
          : {}),
      },
    });
    // Repointing `customerId` / `companyId` moves the PRIMARY relationship
    // with it. Skipped when neither was in the patch, so an ordinary rename
    // costs nothing.
    if (input.customerId !== undefined || input.companyId !== undefined) {
      await syncDealAssociations(tx, ctx.tenantId, updated);
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.updated',
      entityType: 'Deal',
      entityId: updated.id,
      diff: null,
    });
    return {
      updated,
      changed: changedProperties(before.customProperties, updated.customProperties),
    };
  });

  // Fires only when a DECLARED property actually moved (docs/144 §9) — renaming
  // a deal must not wake every workflow watching its properties.
  if (result.changed.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.property.changed',
      payload: { objectKey: 'deal', recordId: result.updated.id, properties: result.changed },
      dedupeKey: `crm.property.changed:${result.updated.id}:${result.updated.updatedAt.toISOString()}`,
    });
  }

  return result.updated;
}

/** Move a deal to a new stage. The single sanctioned stage-change path —
 *  emits crm.deal.stage_changed which the email automation engine listens
 *  for. On move-to-won or move-to-lost, also sets closed_at/closed_reason. */
export async function moveStage(
  ctx: ServiceContext,
  dealId: string,
  rawInput: unknown
): Promise<Deal> {
  const input = MoveDealStageInput.parse(rawInput);

  const { deal, fromStageId, fromStageType, toStageType } = await withTenant(ctx, async (tx) => {
    const before = await tx.deal.findUnique({
      where: { id: dealId },
      include: { stage: true },
    });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Deal', dealId);

    const toStage = await tx.pipelineStage.findUnique({ where: { id: input.toStageId } });
    if (!toStage) throw new CrmNotFoundError('PipelineStage', input.toStageId);
    if (toStage.pipelineId !== before.pipelineId) {
      throw new CrmValidationError('Cannot move deal to a stage in a different pipeline', [
        { field: 'toStageId', message: 'Stage belongs to a different pipeline' },
      ]);
    }
    if (toStage.id === before.stageId) {
      // No-op move — return the existing row without an event emission.
      return {
        deal: before,
        fromStageId: before.stageId,
        fromStageType: before.stage.stageType,
        toStageType: toStage.stageType,
      };
    }

    const isClosing = toStage.stageType === 'won' || toStage.stageType === 'lost';

    const updated = await tx.deal.update({
      where: { id: dealId },
      data: {
        stageId: toStage.id,
        probability: toStage.probability,
        ...(isClosing
          ? { closedAt: new Date(), closedReason: input.closedReason ?? null }
          : { closedAt: null, closedReason: null }),
      },
    });

    // Stage-change activity.
    await tx.crmActivity.create({
      data: {
        tenantId: ctx.tenantId,
        customerId: updated.customerId,
        dealId: updated.id,
        companyId: updated.companyId,
        type:
          toStage.stageType === 'won'
            ? 'deal.closed'
            : toStage.stageType === 'lost'
              ? 'deal.lost'
              : 'deal.stage.changed',
        description: `Stage changed: ${before.stage.name} → ${toStage.name}`,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'staff' : 'system',
        occurredAt: new Date(),
        linkedEntityType: 'Deal',
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
      action: 'crm.deal.stage_changed',
      entityType: 'Deal',
      entityId: updated.id,
      diff: {
        before: { stageId: before.stageId, stageType: before.stage.stageType },
        after: { stageId: toStage.id, stageType: toStage.stageType },
      },
    });

    return {
      deal: updated,
      fromStageId: before.stageId,
      fromStageType: before.stage.stageType,
      toStageType: toStage.stageType,
    };
  });

  if (fromStageId !== deal.stageId) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.deal.stage_changed',
      payload: {
        dealId: deal.id,
        fromStageId,
        fromStageType,
        toStageId: deal.stageId,
        toStageType,
        closed: deal.closedAt !== null,
      },
      dedupeKey: `crm.deal.stage_changed:${deal.id}:${deal.updatedAt.toISOString()}`,
    });

    if (toStageType === 'won' || toStageType === 'lost') {
      await publishCrmEvent({
        tenantId: ctx.tenantId,
        topic: 'crm.deal.closed',
        payload: { dealId: deal.id, outcome: toStageType },
        dedupeKey: `crm.deal.closed:${deal.id}`,
      });
    }
  }

  return deal;
}

/**
 * Soft-delete a deal — for a mistake, not the normal close.
 *
 * The everyday way a deal leaves the board is `moveStage` to a Won/Lost stage,
 * which keeps it in the pipeline's history. This is the escape hatch for a deal
 * that should never have existed: it stamps `deletedAt`, so it drops out of every
 * list (all reads already filter `deletedAt: null`) while the row and its
 * activity trail survive. Mirrors `customerService.softDelete`.
 */
export async function softDelete(ctx: ServiceContext, dealId: string): Promise<Deal> {
  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.deal.findUnique({ where: { id: dealId } });
    if (before?.deletedAt !== null) throw new CrmNotFoundError('Deal', dealId);
    const updated = await tx.deal.update({
      where: { id: dealId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.deal.deleted',
      entityType: 'Deal',
      entityId: updated.id,
      diff: { before: { title: before.title }, after: { deletedAt: updated.deletedAt } },
    });
    return updated;
  });

  // No `crm.deal.deleted` topic exists; the generic updated event carries the
  // change so consumers (projection, search reindex) drop the row.
  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.deal.updated',
    payload: { dealId: result.id, change: 'deleted' },
    dedupeKey: `crm.deal.deleted:${result.id}`,
  });

  return result;
}

// ─────────────────────────────────────────────────────────────────────────
// Join-table operations (locked decision #5) — implementations live in
// deal-attach-service.ts so this file stays under the 200-line target.
// Forecast lives in deal-forecast-service.ts for the same reason.
// ─────────────────────────────────────────────────────────────────────────

export {
  attachOrder,
  detachOrder,
  attachDocument,
  detachDocument,
  listAttachedOrders,
  listAttachedDocuments,
} from './deal-attach-service';
export {
  forecast,
  type ForecastArgs,
  type ForecastBucket,
  type ForecastResult,
} from './deal-forecast-service';
