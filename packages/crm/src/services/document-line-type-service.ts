// documentLineTypeService — the tenant line-type registry (docs/87 §5).
//
// A line type carries BEHAVIOR (how a line is priced + taxed), not just a
// label, so "Part", "Labor", "Sublet", "Freight" all flow through one document
// engine. Seeded with defaults on module activation; fully editable. `key` is
// the stable reference a billing line will FK to (Phase 2), so it is immutable
// once created — retire a type by deactivating it rather than deleting.

import { CreateDocumentLineTypeInput, UpdateDocumentLineTypeInput } from '@sparx/crm-schemas';
import { DEFAULT_DOCUMENT_LINE_TYPES } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { BillingDocumentLineType } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

export async function list(
  ctx: ServiceContext,
  args: { includeInactive?: boolean } = {}
): Promise<BillingDocumentLineType[]> {
  return withTenant(ctx, (tx) =>
    tx.billingDocumentLineType.findMany({
      where: args.includeInactive ? {} : { isActive: true },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    })
  );
}

export async function get(
  ctx: ServiceContext,
  lineTypeId: string
): Promise<BillingDocumentLineType> {
  const lineType = await withTenant(ctx, (tx) =>
    tx.billingDocumentLineType.findUnique({ where: { id: lineTypeId } })
  );
  if (!lineType) throw new CrmNotFoundError('BillingDocumentLineType', lineTypeId);
  return lineType;
}

export async function create(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<BillingDocumentLineType> {
  const input = CreateDocumentLineTypeInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const created = await tx.billingDocumentLineType.create({
      data: {
        tenantId: ctx.tenantId,
        key: input.key,
        name: input.name,
        label: input.label,
        pricingMode: input.pricingMode,
        defaultTaxable: input.defaultTaxable,
        defaultMarkupRuleId: input.defaultMarkupRuleId ?? null,
        computation: input.computation ?? null,
        glCode: input.glCode ?? null,
        category: input.category ?? null,
        isActive: input.isActive,
        sortOrder: input.sortOrder,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line_type.created',
      entityType: 'BillingDocumentLineType',
      entityId: created.id,
      diff: { after: { key: created.key, pricingMode: created.pricingMode } },
    });
    return created;
  });
}

export async function update(
  ctx: ServiceContext,
  lineTypeId: string,
  rawInput: unknown
): Promise<BillingDocumentLineType> {
  const input = UpdateDocumentLineTypeInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.billingDocumentLineType.findUnique({ where: { id: lineTypeId } });
    if (!before) throw new CrmNotFoundError('BillingDocumentLineType', lineTypeId);
    const updated = await tx.billingDocumentLineType.update({
      where: { id: lineTypeId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.pricingMode !== undefined ? { pricingMode: input.pricingMode } : {}),
        ...(input.defaultTaxable !== undefined ? { defaultTaxable: input.defaultTaxable } : {}),
        ...(input.defaultMarkupRuleId !== undefined
          ? { defaultMarkupRuleId: input.defaultMarkupRuleId }
          : {}),
        ...(input.computation !== undefined ? { computation: input.computation } : {}),
        ...(input.glCode !== undefined ? { glCode: input.glCode } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line_type.updated',
      entityType: 'BillingDocumentLineType',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

/** Hard-delete a line type. Safe only while no billing line references its
 *  `key` (enforced by the FK once Phase 2 lands); the dashboard prefers
 *  deactivating (`isActive=false`) for types already in use. */
export async function remove(ctx: ServiceContext, lineTypeId: string): Promise<{ id: string }> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.billingDocumentLineType.findUnique({ where: { id: lineTypeId } });
    if (!before) throw new CrmNotFoundError('BillingDocumentLineType', lineTypeId);
    await tx.billingDocumentLineType.delete({ where: { id: lineTypeId } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'invoicing.line_type.deleted',
      entityType: 'BillingDocumentLineType',
      entityId: lineTypeId,
      diff: { before: { key: before.key } },
    });
    return { id: lineTypeId };
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Bootstrap — seed the starter registry on module activation. Idempotent:
// a key that already exists is skipped, so a re-run never duplicates.
// ─────────────────────────────────────────────────────────────────────────

export async function bootstrapDefaultLineTypes(
  ctx: ServiceContext
): Promise<BillingDocumentLineType[]> {
  return withTenant(ctx, async (tx) => {
    const result: BillingDocumentLineType[] = [];
    for (const template of DEFAULT_DOCUMENT_LINE_TYPES) {
      const existing = await tx.billingDocumentLineType.findUnique({
        where: { tenantId_key: { tenantId: ctx.tenantId, key: template.key } },
      });
      if (existing) {
        result.push(existing);
        continue;
      }
      const created = await tx.billingDocumentLineType.create({
        data: {
          tenantId: ctx.tenantId,
          key: template.key,
          name: template.name,
          label: template.label,
          pricingMode: template.pricingMode,
          defaultTaxable: template.defaultTaxable,
          computation: template.computation ?? null,
          category: template.category ?? null,
          sortOrder: template.sortOrder,
        },
      });
      result.push(created);
    }
    return result;
  });
}
