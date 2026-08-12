// Purchase-order approval (docs/146 Phase 8.5) — a spending control on the way
// OUT.
//
// The mirror of the B2B rule (`purchase_approval_rules`, docs/10 §12), gating the
// opposite direction: that one holds a customer's order until staff agree to
// sell, this one holds staff's order until someone senior agrees to spend. They
// share an amount and nothing else, which is why they are separate tables and
// separate code.
//
// ── The state that had to exist ──────────────────────────────────────────────
//
// A held order is `pending_approval`, and that status is new for this phase. It
// could not be folded into either neighbour: leave it a draft and it vanishes
// from the buyer's "sent" list, so they raise it twice; call it submitted and
// stock can be received against it, which defeats the entire control. A gate
// with no state of its own is not a gate.
//
// ── Precedence is stated, not inherited ──────────────────────────────────────
//
// Unlike the B2B rule, these carry an APPROVER, so two matching rules can
// disagree about who signs. `resolveApprovalRule` (pure, in
// @sparx/commerce-schemas) picks the highest threshold the order clears, then
// sort order, then age. A £20k order routes to the £10k approver, not the £500
// one, and the answer is the same on every run.
//
// ── The trail is append-only ─────────────────────────────────────────────────
//
// An amended and resubmitted order gets a NEW approval row rather than reopening
// the old one, so the record reads as the sequence of decisions it was. That is
// the entire point of an approval record and the thing anyone auditing asks for.
// The amount is snapshot at request time: editing the order after sign-off must
// not retroactively change what was signed for, which is exactly the hole a
// spending control exists to close.

import {
  CreatePoApprovalRuleInput,
  DecidePoApprovalInput,
  UpdatePoApprovalRuleInput,
  resolveApprovalRule,
} from '@sparx/commerce-schemas';
import { withTenant } from '@sparx/db';
import type { TxClient } from '@sparx/db';

import { writeAuditLog } from '../audit';
import {
  InventoryConflictError,
  InventoryNotFoundError,
  InventoryValidationError,
} from '../errors';
import type { ServiceContext } from '../errors';

import { loadPurchaseOrderDetail } from './purchase-order-shared';
import type { PurchaseOrderDetail } from './purchase-order-shared';

const DAY_MS = 24 * 60 * 60 * 1000;

// ─── Rules ───────────────────────────────────────────────────────────────────

export interface PoApprovalRuleRow {
  id: string;
  name: string;
  supplierId: string | null;
  supplierName: string | null;
  warehouseId: string | null;
  warehouseName: string | null;
  minAmountCents: number;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  requiredRole: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listPoApprovalRules(
  ctx: ServiceContext,
  filter: { includeInactive?: boolean } = {}
): Promise<{ items: PoApprovalRuleRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.includeInactive ? {} : { isActive: true }),
    };
    const [rows, total] = await Promise.all([
      tx.purchaseOrderApprovalRule.findMany({
        where,
        // The order the resolver applies, so the list reads as the precedence it
        // actually has rather than alphabetically.
        orderBy: [{ minAmountCents: 'desc' }, { sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: RULE_INCLUDE,
      }),
      tx.purchaseOrderApprovalRule.count({ where }),
    ]);
    return { items: rows.map(serializeRule), total };
  });
}

export async function createPoApprovalRule(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<PoApprovalRuleRow> {
  const input = CreatePoApprovalRuleInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    await assertScopeExists(tx, input.supplierId ?? null, input.warehouseId ?? null);

    const row = await tx.purchaseOrderApprovalRule.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        supplierId: input.supplierId ?? null,
        warehouseId: input.warehouseId ?? null,
        minAmountCents: input.minAmountCents,
        requiredApproverUserId: input.requiredApproverUserId ?? null,
        requiredRole: input.requiredRole ?? null,
        sortOrder: input.sortOrder,
        isActive: input.isActive,
      },
      include: RULE_INCLUDE,
    });
    await audit(tx, ctx, 'approval_rule.created', row.id, { name: input.name });
    return serializeRule(row);
  });
}

export async function updatePoApprovalRule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<PoApprovalRuleRow> {
  const input = UpdatePoApprovalRuleInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseOrderApprovalRule.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('PurchaseOrderApprovalRule', id);
    await assertScopeExists(
      tx,
      input.supplierId !== undefined ? input.supplierId : null,
      input.warehouseId !== undefined ? input.warehouseId : null
    );

    const row = await tx.purchaseOrderApprovalRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.supplierId !== undefined ? { supplierId: input.supplierId } : {}),
        ...(input.warehouseId !== undefined ? { warehouseId: input.warehouseId } : {}),
        ...(input.minAmountCents !== undefined ? { minAmountCents: input.minAmountCents } : {}),
        ...(input.requiredApproverUserId !== undefined
          ? { requiredApproverUserId: input.requiredApproverUserId }
          : {}),
        ...(input.requiredRole !== undefined ? { requiredRole: input.requiredRole } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
      include: RULE_INCLUDE,
    });
    await audit(tx, ctx, 'approval_rule.updated', id, { name: row.name });
    return serializeRule(row);
  });
}

/** Delete a rule. Orders it already held keep their approval rows — the FK is
 *  SET NULL, because deleting the rule must not erase the history of what it
 *  did. */
export async function deletePoApprovalRule(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.purchaseOrderApprovalRule.findFirst({ where: { id } });
    if (!existing) throw new InventoryNotFoundError('PurchaseOrderApprovalRule', id);
    await tx.purchaseOrderApprovalRule.delete({ where: { id } });
    await audit(tx, ctx, 'approval_rule.deleted', id, { name: existing.name });
  });
}

// ─── The gate ────────────────────────────────────────────────────────────────

export interface PoApprovalRow {
  id: string;
  purchaseOrderId: string;
  purchaseOrderNumber: string | null;
  supplierName: string | null;
  ruleId: string | null;
  ruleName: string | null;
  status: string;
  amountCents: number;
  currency: string;
  requestedByUserId: string | null;
  requestedByName: string | null;
  requestedAt: string;
  requiredApproverUserId: string | null;
  requiredApproverName: string | null;
  decidedByUserId: string | null;
  decidedByName: string | null;
  decidedAt: string | null;
  note: string | null;
  /** How long it has been sitting. An approval queue's real failure mode is not
   *  a wrong decision, it is no decision — an order nobody signed for three
   *  weeks is stock nobody ordered. */
  waitingDays: number | null;
}

/**
 * Does this order need signing off, and by whom?
 *
 * Called by the submit path, inside its transaction. Returns null when nothing
 * matches, which is the common case and must stay cheap: one indexed read of the
 * active rules and then pure arithmetic.
 */
export async function resolveRequiredApproval(
  tx: TxClient,
  tenantId: string,
  order: { supplierId: string; warehouseId: string; totalCents: number }
): Promise<{
  ruleId: string;
  requiredApproverUserId: string | null;
  requiredRole: string | null;
} | null> {
  const rules = await tx.purchaseOrderApprovalRule.findMany({
    where: { tenantId, isActive: true },
    select: {
      id: true,
      supplierId: true,
      warehouseId: true,
      minAmountCents: true,
      sortOrder: true,
      createdAt: true,
      requiredApproverUserId: true,
      requiredRole: true,
    },
  });
  if (rules.length === 0) return null;

  const winner = resolveApprovalRule(
    order,
    rules.map((r) => ({
      id: r.id,
      supplierId: r.supplierId,
      warehouseId: r.warehouseId,
      minAmountCents: r.minAmountCents,
      sortOrder: r.sortOrder,
      createdAt: r.createdAt.toISOString(),
    }))
  );
  if (!winner) return null;

  const rule = rules.find((r) => r.id === winner.id);
  if (!rule) return null;
  return {
    ruleId: rule.id,
    requiredApproverUserId: rule.requiredApproverUserId,
    requiredRole: rule.requiredRole,
  };
}

/** Open a request. Called by the submit path once a rule has matched. */
export async function openApprovalRequest(
  tx: TxClient,
  ctx: ServiceContext,
  params: {
    purchaseOrderId: string;
    ruleId: string;
    requiredApproverUserId: string | null;
    amountCents: number;
    currency: string;
  }
): Promise<void> {
  await tx.purchaseOrderApproval.create({
    data: {
      tenantId: ctx.tenantId,
      purchaseOrderId: params.purchaseOrderId,
      ruleId: params.ruleId,
      status: 'pending',
      amountCents: params.amountCents,
      currency: params.currency,
      requestedByUserId: ctx.userId ?? null,
      requiredApproverUserId: params.requiredApproverUserId,
    },
  });
}

export interface ApprovalQueueFilter {
  status?: 'pending' | 'approved' | 'rejected' | 'cancelled';
  purchaseOrderId?: string;
  /** Only the ones this person is named on. */
  requiredApproverUserId?: string;
  take?: number;
  skip?: number;
}

export async function listPoApprovals(
  ctx: ServiceContext,
  filter: ApprovalQueueFilter = {}
): Promise<{ items: PoApprovalRow[]; total: number; pending: number }> {
  const take = Math.min(filter.take ?? 50, 250);
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.purchaseOrderId ? { purchaseOrderId: filter.purchaseOrderId } : {}),
      ...(filter.requiredApproverUserId
        ? { requiredApproverUserId: filter.requiredApproverUserId }
        : {}),
    };
    const [rows, total, pending] = await Promise.all([
      tx.purchaseOrderApproval.findMany({
        where,
        // Oldest pending first: the queue exists to be emptied, and the order
        // that has waited longest is the one holding somebody up.
        orderBy: [{ requestedAt: 'asc' }],
        take,
        skip: filter.skip ?? 0,
        include: APPROVAL_INCLUDE,
      }),
      tx.purchaseOrderApproval.count({ where }),
      tx.purchaseOrderApproval.count({ where: { tenantId: ctx.tenantId, status: 'pending' } }),
    ]);
    return { items: rows.map(serializeApproval), total, pending };
  });
}

/**
 * Approve or reject.
 *
 * Approving is what actually PLACES the order — `orderedAt` is stamped here, not
 * at submit, because until somebody signed there was no order. Rejecting returns
 * it to draft so the buyer can amend and try again, which mints a fresh approval
 * row rather than reopening this one.
 */
export async function decidePoApproval(
  ctx: ServiceContext,
  approvalId: string,
  rawInput: unknown
): Promise<PurchaseOrderDetail> {
  const input = DecidePoApprovalInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const approval = await tx.purchaseOrderApproval.findFirst({
      where: { id: approvalId },
      include: {
        purchaseOrder: {
          select: {
            id: true,
            number: true,
            status: true,
            expectedArrivalAt: true,
            supplier: { select: { leadTimeDays: true } },
          },
        },
      },
    });
    if (!approval) throw new InventoryNotFoundError('PurchaseOrderApproval', approvalId);
    if (approval.status !== 'pending') {
      throw new InventoryConflictError(
        `This request was already ${approval.status} and cannot be decided again`,
        'status'
      );
    }

    // A named approver is a named approver. Anyone else signing would make the
    // rule decorative, and the trail would record a signature the rule did not
    // ask for.
    if (
      approval.requiredApproverUserId !== null &&
      ctx.userId !== null &&
      ctx.userId !== undefined &&
      approval.requiredApproverUserId !== ctx.userId
    ) {
      throw new InventoryValidationError('This order has to be signed off by the named approver', [
        { field: 'approverId', message: 'You are not the approver named on this request' },
      ]);
    }

    const po = approval.purchaseOrder;
    if (po.status !== 'pending_approval') {
      throw new InventoryConflictError(
        `Purchase order ${po.number} is ${po.status}, so there is nothing to decide`,
        'status'
      );
    }

    const now = new Date();
    await tx.purchaseOrderApproval.update({
      where: { id: approvalId },
      data: {
        status: input.decision,
        decidedByUserId: ctx.userId ?? null,
        decidedAt: now,
        note: input.note ?? null,
      },
    });

    if (input.decision === 'approved') {
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: 'submitted',
          orderedAt: now,
          expectedArrivalAt:
            po.expectedArrivalAt ?? deriveArrival(now, po.supplier?.leadTimeDays ?? null),
        },
      });
    } else {
      // Back to draft, not cancelled. A rejection is "change this and ask
      // again", and cancelling would make the buyer retype the whole order.
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: { status: 'draft', orderedAt: null },
      });
    }

    await audit(tx, ctx, `approval.${input.decision}`, po.id, {
      approvalId,
      number: po.number,
      amountCents: approval.amountCents,
    });

    return loadPurchaseOrderDetail(tx, po.id);
  });
}

/** Withdraw a pending request — the buyer changed their mind before anyone
 *  signed. Returns the order to draft. */
export async function cancelPoApproval(
  ctx: ServiceContext,
  approvalId: string
): Promise<PurchaseOrderDetail> {
  return withTenant(ctx, async (tx) => {
    const approval = await tx.purchaseOrderApproval.findFirst({
      where: { id: approvalId },
      include: { purchaseOrder: { select: { id: true, number: true, status: true } } },
    });
    if (!approval) throw new InventoryNotFoundError('PurchaseOrderApproval', approvalId);
    if (approval.status !== 'pending') {
      throw new InventoryConflictError(`This request was already ${approval.status}`, 'status');
    }

    await tx.purchaseOrderApproval.update({
      where: { id: approvalId },
      data: { status: 'cancelled', decidedByUserId: ctx.userId ?? null, decidedAt: new Date() },
    });
    if (approval.purchaseOrder.status === 'pending_approval') {
      await tx.purchaseOrder.update({
        where: { id: approval.purchaseOrder.id },
        data: { status: 'draft', orderedAt: null },
      });
    }
    await audit(tx, ctx, 'approval.cancelled', approval.purchaseOrder.id, { approvalId });
    return loadPurchaseOrderDetail(tx, approval.purchaseOrder.id);
  });
}

// ─── plumbing ────────────────────────────────────────────────────────────────

const RULE_INCLUDE = {
  supplier: { select: { name: true } },
  warehouse: { select: { name: true } },
  requiredApprover: { select: { name: true } },
} as const;

const APPROVAL_INCLUDE = {
  purchaseOrder: { select: { number: true, supplier: { select: { name: true } } } },
  rule: { select: { name: true } },
  requestedBy: { select: { name: true } },
  requiredApprover: { select: { name: true } },
  decidedBy: { select: { name: true } },
} as const;

async function assertScopeExists(
  tx: TxClient,
  supplierId: string | null,
  warehouseId: string | null
): Promise<void> {
  if (supplierId) {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, deletedAt: null },
      select: { id: true },
    });
    if (!supplier) throw new InventoryNotFoundError('Supplier', supplierId);
  }
  if (warehouseId) {
    const warehouse = await tx.warehouse.findFirst({
      where: { id: warehouseId, deletedAt: null },
      select: { id: true },
    });
    if (!warehouse) throw new InventoryNotFoundError('Warehouse', warehouseId);
  }
}

function deriveArrival(now: Date, leadTimeDays: number | null): Date | null {
  if (leadTimeDays === null) return null;
  return new Date(now.getTime() + leadTimeDays * DAY_MS);
}

interface RuleRecord {
  id: string;
  name: string;
  supplierId: string | null;
  warehouseId: string | null;
  minAmountCents: number;
  requiredApproverUserId: string | null;
  requiredRole: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  supplier?: { name: string | null } | null;
  warehouse?: { name: string | null } | null;
  requiredApprover?: { name: string | null } | null;
}

function serializeRule(row: RuleRecord): PoApprovalRuleRow {
  return {
    id: row.id,
    name: row.name,
    supplierId: row.supplierId,
    supplierName: row.supplier?.name ?? null,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse?.name ?? null,
    minAmountCents: row.minAmountCents,
    requiredApproverUserId: row.requiredApproverUserId,
    requiredApproverName: row.requiredApprover?.name ?? null,
    requiredRole: row.requiredRole,
    sortOrder: row.sortOrder,
    isActive: row.isActive,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

interface ApprovalRecord {
  id: string;
  purchaseOrderId: string;
  ruleId: string | null;
  status: string;
  amountCents: number;
  currency: string;
  requestedByUserId: string | null;
  requestedAt: Date;
  requiredApproverUserId: string | null;
  decidedByUserId: string | null;
  decidedAt: Date | null;
  note: string | null;
  purchaseOrder?: { number: string; supplier?: { name: string | null } | null } | null;
  rule?: { name: string | null } | null;
  requestedBy?: { name: string | null } | null;
  requiredApprover?: { name: string | null } | null;
  decidedBy?: { name: string | null } | null;
}

function serializeApproval(row: ApprovalRecord): PoApprovalRow {
  return {
    id: row.id,
    purchaseOrderId: row.purchaseOrderId,
    purchaseOrderNumber: row.purchaseOrder?.number ?? null,
    supplierName: row.purchaseOrder?.supplier?.name ?? null,
    ruleId: row.ruleId,
    ruleName: row.rule?.name ?? null,
    status: row.status,
    amountCents: row.amountCents,
    currency: row.currency,
    requestedByUserId: row.requestedByUserId,
    requestedByName: row.requestedBy?.name ?? null,
    requestedAt: row.requestedAt.toISOString(),
    requiredApproverUserId: row.requiredApproverUserId,
    requiredApproverName: row.requiredApprover?.name ?? null,
    decidedByUserId: row.decidedByUserId,
    decidedByName: row.decidedBy?.name ?? null,
    decidedAt: row.decidedAt?.toISOString() ?? null,
    note: row.note,
    // Only meaningful while it is still waiting. A decided request's age is not
    // "how long it has been waiting", and reporting one would be a small lie
    // that makes the queue's worst number look better than it is.
    waitingDays:
      row.status === 'pending'
        ? Math.floor((Date.now() - row.requestedAt.getTime()) / DAY_MS)
        : null,
  };
}

async function audit(
  tx: Parameters<typeof writeAuditLog>[0]['tx'],
  ctx: ServiceContext,
  action: string,
  entityId: string,
  diff: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `inventory.purchase_order.${action}`,
    entityType: 'PurchaseOrder',
    entityId,
    diff: { after: diff },
  });
}
