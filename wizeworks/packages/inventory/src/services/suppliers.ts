// Supplier CRUD — the inbound vendor record (docs/100 P3a). A supplier carries
// contact + default purchasing terms + lead time; per-variant purchasing detail
// (the supplier's SKU, cost, MOQ) lives on SupplierVariant (see
// ./supplier-variants.ts). Archival is blocked while an open PO (draft/submitted/
// partial) references the supplier — close or cancel it first (P3b). Mirrors the
// warehouse CRUD shape.

import { CreateSupplierInput, UpdateSupplierInput } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { Supplier } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryConflictError, InventoryNotFoundError } from '../errors';
import type { ServiceContext } from '../errors';

export interface SupplierRow {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function listSuppliers(
  ctx: ServiceContext,
  filter: { includeInactive?: boolean; search?: string; take?: number; skip?: number } = {}
): Promise<{ items: SupplierRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      deletedAt: null,
      ...(filter.includeInactive ? {} : { isActive: true }),
      ...(filter.search
        ? {
            OR: [
              { name: { contains: filter.search, mode: 'insensitive' as const } },
              { code: { contains: filter.search, mode: 'insensitive' as const } },
            ],
          }
        : {}),
    };
    const [rows, total] = await Promise.all([
      tx.supplier.findMany({
        where,
        orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.supplier.count({ where }),
    ]);
    return { items: rows.map(serializeSupplier), total };
  });
}

export async function getSupplier(ctx: ServiceContext, supplierId: string): Promise<SupplierRow> {
  const row = await withTenant(ctx, (tx) =>
    tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } })
  );
  if (!row) throw new InventoryNotFoundError('Supplier', supplierId);
  return serializeSupplier(row);
}

export async function createSupplier(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<{ id: string }> {
  const input = CreateSupplierInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const existing = await tx.supplier.findFirst({
      where: { code: input.code, deletedAt: null },
      select: { id: true },
    });
    if (existing) {
      throw new InventoryConflictError(`Supplier code "${input.code}" is already in use`, 'code');
    }

    const supplier = await tx.supplier.create({ data: supplierData(ctx.tenantId, input) });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.supplier.created',
      entityType: 'Supplier',
      entityId: supplier.id,
      diff: { after: serializeSupplier(supplier) as unknown as Record<string, unknown> },
    });

    return { id: supplier.id };
  });
}

export async function updateSupplier(
  ctx: ServiceContext,
  supplierId: string,
  rawInput: unknown
): Promise<SupplierRow> {
  const input = UpdateSupplierInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
    if (!before) throw new InventoryNotFoundError('Supplier', supplierId);

    if (input.code !== undefined && input.code !== before.code) {
      const collision = await tx.supplier.findFirst({
        where: { code: input.code, deletedAt: null, NOT: { id: supplierId } },
        select: { id: true },
      });
      if (collision) {
        throw new InventoryConflictError(`Supplier code "${input.code}" is already in use`, 'code');
      }
    }

    const updated = await tx.supplier.update({
      where: { id: supplierId },
      data: patchData(input),
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.supplier.updated',
      entityType: 'Supplier',
      entityId: updated.id,
      diff: {
        before: serializeSupplier(before) as unknown as Record<string, unknown>,
        after: serializeSupplier(updated) as unknown as Record<string, unknown>,
      },
    });

    return serializeSupplier(updated);
  });
}

export async function archiveSupplier(ctx: ServiceContext, supplierId: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.supplier.findFirst({ where: { id: supplierId, deletedAt: null } });
    if (!before) throw new InventoryNotFoundError('Supplier', supplierId);

    const openPo = await tx.purchaseOrder.findFirst({
      where: { supplierId, status: { in: ['draft', 'submitted', 'partial'] } },
      select: { number: true },
    });
    if (openPo) {
      throw new InventoryConflictError(
        `Cannot archive a supplier with an open purchase order (${openPo.number}) — close or cancel it first`,
        'supplier'
      );
    }

    await tx.supplier.update({
      where: { id: supplierId },
      data: { deletedAt: new Date(), isActive: false },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.supplier.archived',
      entityType: 'Supplier',
      entityId: supplierId,
      diff: { before: serializeSupplier(before) as unknown as Record<string, unknown> },
    });
  });
}

/** Build the create payload from validated input (shared column mapping). */
function supplierData(tenantId: string, input: CreateSupplierInput) {
  return {
    tenantId,
    name: input.name,
    code: input.code,
    contactName: input.contactName ?? null,
    email: input.email ?? null,
    phone: input.phone ?? null,
    website: input.website ?? null,
    line1: input.line1 ?? null,
    line2: input.line2 ?? null,
    city: input.city ?? null,
    region: input.region ?? null,
    postalCode: input.postalCode ?? null,
    country: input.country ?? null,
    paymentTerms: input.paymentTerms ?? null,
    leadTimeDays: input.leadTimeDays ?? null,
    currency: input.currency,
    notes: input.notes ?? null,
    isActive: input.isActive,
  };
}

/** Build the sparse update payload — only provided keys are written. */
function patchData(input: UpdateSupplierInput) {
  const set = <K extends keyof UpdateSupplierInput>(key: K) =>
    input[key] !== undefined ? { [key]: input[key] } : {};
  return {
    ...set('name'),
    ...set('code'),
    ...set('contactName'),
    ...set('email'),
    ...set('phone'),
    ...set('website'),
    ...set('line1'),
    ...set('line2'),
    ...set('city'),
    ...set('region'),
    ...set('postalCode'),
    ...set('country'),
    ...set('paymentTerms'),
    ...set('leadTimeDays'),
    ...set('currency'),
    ...set('notes'),
    ...set('isActive'),
  };
}

export function serializeSupplier(s: Supplier): SupplierRow {
  return {
    id: s.id,
    name: s.name,
    code: s.code,
    contactName: s.contactName,
    email: s.email,
    phone: s.phone,
    website: s.website,
    line1: s.line1,
    line2: s.line2,
    city: s.city,
    region: s.region,
    postalCode: s.postalCode,
    country: s.country,
    paymentTerms: s.paymentTerms,
    leadTimeDays: s.leadTimeDays,
    currency: s.currency,
    notes: s.notes,
    isActive: s.isActive,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}
