// Product type service — the read + write + resolution path for typed product
// types (docs/143), the commerce mirror of @wizeworks/cms's content-types-service.
//
// One file owns three concerns that always move together:
//   - CRUD + fork-on-edit (list/get/create/update/replaceSchema/delete). A tenant
//     fork (is_built_in=false) shadows the platform built-in of the same key.
//   - resolveProductType — the two-step lookup a product write uses to find the
//     schema its `attributes` bag must satisfy (tenant row wins over built-in).
//   - validateAndNormalizeAttributes — runs a product's attribute bag through the
//     Zod validator built from the resolved type's schema (@wizeworks/field-schema
//     bodyValidatorFor), 422 on mismatch, exactly like a content entry body.

import type { Prisma, ProductType, TxClient } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { bodyValidatorFor } from '@wizeworks/field-schema';
import {
  ProductTypeSchema,
  type ProductTypeSchema as ProductTypeSchemaT,
  type CreateProductTypeInput,
  type UpdateProductTypeInput,
} from '@wizeworks/commerce-schemas';

import { writeAuditLog } from '../audit';
import {
  CommerceConflictError,
  CommerceNotFoundError,
  CommerceValidationError,
  type ServiceContext,
} from '../errors';

// ── Wire shape ───────────────────────────────────────────────────────────────
// Canonical shape every transport (REST, workbench, blueprint) reads. camelCase
// to match the rest of the commerce module (ProductDetail et al.) — the one
// place this deviates from the CMS content-type wire shape, which is snake_case.
export interface WireProductType {
  id: string;
  key: string;
  name: string;
  pluralName: string | null;
  description: string | null;
  icon: string | null;
  propertyId: string | null;
  isBuiltIn: boolean;
  attributeSchema: { fields: unknown[] };
  createdAt: string;
  updatedAt: string;
}

// Bridge a serialized wire type into the audit log's `diff.before/after`
// (`Record<string, unknown> | null`): an `interface` is augmentable so it does not
// structurally satisfy that index type, but a fresh spread does.
const snapshot = (t: WireProductType): Record<string, unknown> => ({ ...t });

export function serializeProductType(row: ProductType): WireProductType {
  const schema = (row.attributeSchema ?? { fields: [] }) as { fields: unknown[] };
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    pluralName: row.pluralName,
    description: row.description,
    icon: row.icon,
    propertyId: row.propertyId,
    isBuiltIn: row.isBuiltIn,
    attributeSchema: schema && typeof schema === 'object' ? schema : { fields: [] },
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Read-path dedup: a tenant fork shadows the platform built-in of the same key.
// Callers order built-ins last (isBuiltIn ASC) so the fork wins.
function dedupeByKey<T extends { key: string }>(rows: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const row of rows) {
    if (seen.has(row.key)) continue;
    seen.add(row.key);
    out.push(row);
  }
  return out;
}

// ── RESOLUTION + VALIDATION (used by the product write path) ─────────────────

// The two-step lookup: a tenant-owned row wins over the sentinel platform
// built-in of the same key (RLS surfaces both on read). Throws NOT_FOUND if the
// key resolves to nothing — a product write referencing an unknown type is a 404.
export async function resolveProductType(tx: TxClient, key: string): Promise<ProductType> {
  const row = await tx.productType.findFirst({
    where: { key },
    orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
  });
  if (!row) throw new CommerceNotFoundError('ProductType', key);
  return row;
}

export function parseProductTypeSchema(row: ProductType): ProductTypeSchemaT {
  const parsed = ProductTypeSchema.safeParse(row.attributeSchema);
  if (!parsed.success) {
    // A malformed attribute_schema is server-side data corruption, never a
    // client's fault — surface as 500, not a misleading 422.
    throw new Error(
      `Product type ${row.key} has an invalid attribute_schema: ${parsed.error.message}`
    );
  }
  return parsed.data;
}

// Validate + normalize a product's attribute bag against a type schema. Unknown
// keys are stripped (forgiving on dropped fields); shape/required mismatches are
// a VALIDATION_ERROR (422). Returns the normalized bag ready to persist.
export function validateAndNormalizeAttributes(
  schema: ProductTypeSchemaT,
  attributes: unknown
): Record<string, unknown> {
  const validator = bodyValidatorFor(schema);
  const result = validator.safeParse(attributes ?? {});
  if (!result.success) {
    throw new CommerceValidationError(
      'Attributes do not match the product type schema.',
      result.error.issues.map((i) => ({ field: i.path.join('.'), message: i.message }))
    );
  }
  return result.data;
}

// Convenience the product service calls: resolve the type by key (within the
// caller's tx) and validate the bag against it in one step. Returns the
// normalized bag. NOT_FOUND if the key is unknown, 422 if the bag is invalid.
export async function resolveAndValidateAttributes(
  tx: TxClient,
  key: string,
  attributes: unknown
): Promise<Record<string, unknown>> {
  const type = await resolveProductType(tx, key);
  const schema = parseProductTypeSchema(type);
  return validateAndNormalizeAttributes(schema, attributes);
}

// Batch-resolve the attribute schemas for a set of type keys in ONE query, so a
// PDP or a product LIST can project attributes without N round-trips. Dedupes by
// key (tenant fork wins over built-in) and parses each schema. Unknown/malformed
// keys are simply absent from the map — a caller treats a missing schema as
// "render no attributes" rather than erroring (a public read must degrade, not
// 500, if a product points at a since-deleted type).
export async function resolveSchemasByKey(
  tenantId: string,
  keys: readonly string[]
): Promise<Map<string, ProductTypeSchemaT>> {
  const unique = [...new Set(keys.filter((k): k is string => !!k))];
  const out = new Map<string, ProductTypeSchemaT>();
  if (unique.length === 0) return out;

  const rows = await withTenant({ tenantId }, (tx) =>
    tx.productType.findMany({
      where: { key: { in: unique } },
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    })
  );
  for (const row of dedupeByKey(rows)) {
    const parsed = ProductTypeSchema.safeParse(row.attributeSchema);
    if (parsed.success) out.set(row.key, parsed.data);
  }
  return out;
}

// ── READS ────────────────────────────────────────────────────────────────────

export async function list(tenantId: string): Promise<WireProductType[]> {
  const rows = await withTenant({ tenantId }, (tx) =>
    tx.productType.findMany({ orderBy: [{ isBuiltIn: 'asc' }, { key: 'asc' }] })
  );
  return dedupeByKey(rows).map(serializeProductType);
}

export async function get(tenantId: string, key: string): Promise<WireProductType | null> {
  const row = await withTenant({ tenantId }, (tx) =>
    tx.productType.findFirst({
      where: { key },
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    })
  );
  return row ? serializeProductType(row) : null;
}

// ── CREATE / UPDATE ──────────────────────────────────────────────────────────

export async function create(
  ctx: ServiceContext,
  input: CreateProductTypeInput
): Promise<WireProductType> {
  const row = await withTenant(ctx, async (tx) => {
    // Collide against any row with the same key in the tenant scope OR a built-in
    // (RLS surfaces platform built-ins on read).
    const collision = await tx.productType.findFirst({ where: { key: input.key } });
    if (collision) {
      throw new CommerceConflictError(
        `A product type with key "${input.key}" already exists.`,
        'key'
      );
    }

    const created = await tx.productType.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        key: input.key,
        name: input.name,
        pluralName: input.pluralName ?? null,
        description: input.description ?? null,
        icon: input.icon ?? null,
        isBuiltIn: false,
        attributeSchema: input.attributeSchema,
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product_type.created',
      entityType: 'ProductType',
      entityId: created.id,
      diff: { before: null, after: snapshot(serializeProductType(created)) },
    });
    return created;
  });
  return serializeProductType(row);
}

export async function update(
  ctx: ServiceContext,
  key: string,
  input: UpdateProductTypeInput
): Promise<WireProductType> {
  const row = await withTenant(ctx, async (tx) => {
    // Only a tenant-owned (non-built-in) type is editable in place; a built-in is
    // forked through replaceSchema, never mutated here.
    const existing = await tx.productType.findFirst({ where: { key, isBuiltIn: false } });
    if (!existing) throw new CommerceNotFoundError('Custom product type', key);

    const updated = await tx.productType.update({
      where: { id: existing.id },
      data: {
        name: input.name ?? existing.name,
        pluralName: input.pluralName === undefined ? existing.pluralName : input.pluralName,
        description: input.description === undefined ? existing.description : input.description,
        icon: input.icon === undefined ? existing.icon : input.icon,
        propertyId: input.propertyId === undefined ? existing.propertyId : input.propertyId,
        // `existing.attributeSchema` is Prisma `JsonValue` (nullable in the type); the column
        // is NOT NULL in practice, so carry it forward as an InputJsonValue rather than let the
        // `null` arm of the type reject the write.
        attributeSchema:
          input.attributeSchema ?? (existing.attributeSchema as Prisma.InputJsonValue),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product_type.updated',
      entityType: 'ProductType',
      entityId: updated.id,
      diff: {
        before: snapshot(serializeProductType(existing)),
        after: snapshot(serializeProductType(updated)),
      },
    });
    return updated;
  });
  return serializeProductType(row);
}

// ── SCHEMA AUTHORING (fork-on-edit) ──────────────────────────────────────────
// The field-builder's Save. Editing a tenant-owned type updates its schema in
// place; editing a platform built-in FORKS it into a tenant-owned copy of the
// same key that shadows the built-in everywhere (reads dedupe by key, tenant
// copy wins). `forked` tells the caller which happened.

export interface ReplaceSchemaResult {
  productType: WireProductType;
  forked: boolean;
}

export async function replaceSchema(
  ctx: ServiceContext,
  key: string,
  attributeSchema: ProductTypeSchemaT
): Promise<ReplaceSchemaResult> {
  const { row, forked } = await withTenant(ctx, async (tx) => {
    // Resolve by key, tenant row preferred (isBuiltIn ASC → a fork wins over the
    // platform built-in of the same key).
    const existing = await tx.productType.findFirst({
      where: { key },
      orderBy: [{ isBuiltIn: 'asc' }, { updatedAt: 'desc' }],
    });
    if (!existing) throw new CommerceNotFoundError('Product type', key);

    // Tenant already owns it (custom type or a prior fork) → update in place.
    if (!existing.isBuiltIn) {
      const updated = await tx.productType.update({
        where: { id: existing.id },
        data: { attributeSchema },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: ctx.userId ? 'user' : 'system',
        action: 'commerce.product_type.schema_replaced',
        entityType: 'ProductType',
        entityId: updated.id,
        diff: {
          before: snapshot(serializeProductType(existing)),
          after: snapshot(serializeProductType(updated)),
        },
      });
      return { row: updated, forked: false };
    }

    // Platform built-in → FORK into a tenant-owned copy. @@unique([tenantId, key])
    // lets (platform,key) + (tenant,key) coexist; the fork lands in the caller's scope.
    const forkedRow = await tx.productType.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: existing.propertyId,
        key: existing.key,
        name: existing.name,
        pluralName: existing.pluralName,
        description: existing.description,
        icon: existing.icon,
        isBuiltIn: false,
        attributeSchema,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product_type.forked',
      entityType: 'ProductType',
      entityId: forkedRow.id,
      diff: {
        before: snapshot(serializeProductType(existing)),
        after: snapshot(serializeProductType(forkedRow)),
      },
    });
    return { row: forkedRow, forked: true };
  });
  return { productType: serializeProductType(row), forked };
}

// ── DELETE ──────────────────────────────────────────────────────────────────
// Only a tenant-owned (custom or forked) type is deletable, and only when no live
// product still points at it — deleting out from under products would orphan
// their attribute bags.

export async function remove(ctx: ServiceContext, key: string): Promise<WireProductType> {
  const row = await withTenant(ctx, async (tx) => {
    const existing = await tx.productType.findFirst({ where: { key, isBuiltIn: false } });
    if (!existing) throw new CommerceNotFoundError('Custom product type', key);

    const inUse = await tx.product.count({ where: { productTypeKey: key, deletedAt: null } });
    if (inUse > 0) {
      throw new CommerceConflictError(
        `Cannot delete "${key}" — ${inUse} product${inUse === 1 ? '' : 's'} still use it. Change those products' type first.`
      );
    }

    await tx.productType.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'commerce.product_type.deleted',
      entityType: 'ProductType',
      entityId: existing.id,
      diff: { before: snapshot(serializeProductType(existing)), after: null },
    });
    return existing;
  });
  return serializeProductType(row);
}
