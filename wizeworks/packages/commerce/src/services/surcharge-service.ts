// surchargeService — document-level surcharge rules (docs/48 §6).
//
// CRUD plus `listActiveSpecs`, which the checkout-service + refund flow call to
// compute fees via the pure `applySurcharges`. Platform default is OFF; a
// tenant opts in and owns the legal compliance (docs/48 §6.2).
//
// Locked write pattern: validate → withTenant() tx → writeAuditLog in-tx.

import {
  CreateSurchargeRuleInput,
  UpdateSurchargeRuleInput,
  type SurchargeAppliesTo,
  type SurchargeBasis,
  type SurchargePaymentMethod,
  type SurchargeRuleSpec,
  type SurchargeType,
} from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, SurchargeRule } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { CommerceNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

export interface SurchargeRuleRow {
  id: string;
  name: string;
  type: SurchargeType;
  value: number;
  basis: SurchargeBasis;
  paymentMethods: SurchargePaymentMethod[];
  appliesTo: SurchargeAppliesTo;
  label: string;
  capCents: number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listRules(
  ctx: ServiceContext,
  filter: { isActive?: boolean } = {}
): Promise<SurchargeRuleRow[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.surchargeRule.findMany({
      where: { ...(filter.isActive !== undefined ? { isActive: filter.isActive } : {}) },
      orderBy: [{ isActive: 'desc' }, { updatedAt: 'desc' }],
      take: 200,
    });
    return rows.map(serialize);
  });
}

export async function getRule(ctx: ServiceContext, id: string): Promise<SurchargeRuleRow> {
  const row = await withTenant(ctx, (tx) => tx.surchargeRule.findFirst({ where: { id } }));
  if (!row) throw new CommerceNotFoundError('SurchargeRule', id);
  return serialize(row);
}

export async function createRule(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SurchargeRuleRow> {
  const input = CreateSurchargeRuleInput.parse(rawInput);
  const row = await withTenant(ctx, async (tx) => {
    const created = await tx.surchargeRule.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        type: input.type,
        value: input.value,
        basis: input.basis,
        paymentMethods: input.paymentMethods,
        appliesTo: input.appliesTo,
        label: input.label,
        capCents: input.capCents ?? null,
        isActive: input.isActive,
      },
    });
    await audit(tx, ctx, 'created', created.id, { name: created.name, isActive: created.isActive });
    return created;
  });
  return serialize(row);
}

export async function updateRule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<SurchargeRuleRow> {
  const input = UpdateSurchargeRuleInput.parse(rawInput);
  const row = await withTenant(ctx, async (tx) => {
    const before = await tx.surchargeRule.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('SurchargeRule', id);
    const updated = await tx.surchargeRule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.value !== undefined ? { value: input.value } : {}),
        ...(input.basis !== undefined ? { basis: input.basis } : {}),
        ...(input.paymentMethods !== undefined ? { paymentMethods: input.paymentMethods } : {}),
        ...(input.appliesTo !== undefined ? { appliesTo: input.appliesTo } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.capCents !== undefined ? { capCents: input.capCents } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
    await audit(tx, ctx, 'updated', id, { name: updated.name, isActive: updated.isActive });
    return updated;
  });
  return serialize(row);
}

export async function deleteRule(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.surchargeRule.findFirst({ where: { id } });
    if (!before) throw new CommerceNotFoundError('SurchargeRule', id);
    await tx.surchargeRule.delete({ where: { id } });
    await audit(tx, ctx, 'deleted', id, { name: before.name });
  });
}

/**
 * Active surcharge rule specs for a given application point, ready for the pure
 * `applySurcharges`. Called by the checkout-service (point 'checkout') and the
 * future invoice flow (point 'invoice'); a rule with appliesTo 'both' matches
 * either. Reads through the caller's tenant context.
 */
export async function listActiveSpecs(
  ctx: ServiceContext,
  point: 'checkout' | 'invoice',
  tx?: Prisma.TransactionClient
): Promise<SurchargeRuleSpec[]> {
  const run = async (client: Prisma.TransactionClient): Promise<SurchargeRuleSpec[]> => {
    const rows = await client.surchargeRule.findMany({
      where: { isActive: true, appliesTo: { in: [point, 'both'] } },
      orderBy: { createdAt: 'asc' },
    });
    return rows.map(toSpec);
  };
  return tx ? run(tx) : withTenant(ctx, run);
}

// ─── internal ───────────────────────────────────────────────────────────

async function audit(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  verb: string,
  id: string,
  after: Record<string, unknown>
): Promise<void> {
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: ctx.userId ? 'user' : 'system',
    action: `commerce.surcharge_rule.${verb}`,
    entityType: 'SurchargeRule',
    entityId: id,
    diff: { after },
  });
}

function toSpec(r: SurchargeRule): SurchargeRuleSpec {
  return {
    id: r.id,
    name: r.name,
    type: r.type as SurchargeType,
    value: Number(r.value),
    basis: r.basis as SurchargeBasis,
    paymentMethods: r.paymentMethods as SurchargePaymentMethod[],
    label: r.label,
    capCents: r.capCents,
  };
}

function serialize(r: SurchargeRule): SurchargeRuleRow {
  return {
    id: r.id,
    name: r.name,
    type: r.type as SurchargeType,
    value: Number(r.value),
    basis: r.basis as SurchargeBasis,
    paymentMethods: r.paymentMethods as SurchargePaymentMethod[],
    appliesTo: r.appliesTo as SurchargeAppliesTo,
    label: r.label,
    capCents: r.capCents,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}
