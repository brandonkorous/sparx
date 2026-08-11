// crmRecordService — rows of a tenant-invented object (docs/144 §3.2, §3.6).
//
// One service for EVERY custom object, because there is no build-time knowledge
// of what those objects are. A business that defines "Project" gets
// create/read/update/delete, search, ownership and site scoping from this file
// with no code written for them — which is the entire promise of a custom
// object, and the reason the generic workbench surfaces (§3.6) can exist at all.
//
// The values bag goes through the SAME `resolvePropertyBag` as a contact's
// custom properties: validate against the object's schema, recompute calculated
// fields server-side, merge onto what is already stored. A custom object is not
// a second, looser data path — it is the same one with the whole record in the
// bag instead of part of it.

import {
  CreateCrmRecordInput,
  ListCrmRecordsInput,
  UpdateCrmRecordInput,
} from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { CrmRecord, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import {
  asPropertySchema,
  changedProperties,
  resolvePropertyBag,
  toJsonInput,
  type PropertyBag,
} from './custom-properties';

/** Load an object definition, refusing anything that isn't a live custom object. */
async function requireCustomObject(
  tx: Prisma.TransactionClient,
  tenantId: string,
  objectKey: string
): Promise<{ propertySchema: unknown; primaryFieldKey: string | null }> {
  const def = await tx.crmObjectDef.findUnique({
    where: { tenantId_key: { tenantId, key: objectKey } },
    select: { kind: true, archivedAt: true, propertySchema: true, primaryFieldKey: true },
  });
  if (!def) throw new CrmNotFoundError('CrmObjectDef', objectKey);
  if (def.kind !== 'custom') {
    // A contact does not live in crm_records; writing one here would create a
    // second, invisible contact table.
    throw new CrmValidationError(`"${objectKey}" is a built-in record and is stored elsewhere.`, [
      { field: 'objectKey', message: 'This is a built-in record type.' },
    ]);
  }
  if (def.archivedAt) {
    throw new CrmValidationError(
      `"${objectKey}" has been put away. Bring it back before adding to it.`,
      [{ field: 'objectKey', message: 'This record type is archived.' }]
    );
  }
  return { propertySchema: def.propertySchema, primaryFieldKey: def.primaryFieldKey };
}

/**
 * The record's display name, denormalized onto `title` on every write.
 *
 * Without it a list, a search result and an association chip would each have to
 * parse the JSON bag to find out what the row is called — and could not sort or
 * index by it at all.
 */
function titleFrom(values: PropertyBag, primaryFieldKey: string | null): string | null {
  if (!primaryFieldKey) return null;
  const raw = values[primaryFieldKey];
  if (typeof raw === 'string' && raw.trim()) return raw.trim().slice(0, 255);
  if (typeof raw === 'number' && Number.isFinite(raw)) return String(raw);
  return null;
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function list(
  ctx: ServiceContext,
  rawArgs: unknown
): Promise<{ items: CrmRecord[]; total: number }> {
  const args = ListCrmRecordsInput.parse(rawArgs);

  return withTenant(ctx, async (tx) => {
    const where: Prisma.CrmRecordWhereInput = {
      objectKey: args.objectKey,
      deletedAt: null,
      ...(args.ownerId ? { ownerId: args.ownerId } : {}),
      // Restricted members see their sites' records PLUS tenant-wide ones —
      // the same "site's own + shared" shape every scoped read uses.
      ...(args.propertyIds
        ? { OR: [{ propertyId: { in: args.propertyIds } }, { propertyId: null }] }
        : {}),
      // Searching the denormalized title, not the bag: a GIN index answers
      // containment, not substring, so a LIKE over JSONB would scan every row.
      ...(args.q ? { title: { contains: args.q, mode: 'insensitive' } } : {}),
    };

    const [items, total] = await Promise.all([
      tx.crmRecord.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        take: Math.min(args.take ?? 50, 250),
        skip: args.skip ?? 0,
      }),
      tx.crmRecord.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, recordId: string): Promise<CrmRecord> {
  const record = await withTenant(ctx, (tx) =>
    tx.crmRecord.findUnique({ where: { id: recordId } })
  );
  if (!record || record.deletedAt) throw new CrmNotFoundError('CrmRecord', recordId);
  return record;
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmRecord> {
  const input = CreateCrmRecordInput.parse(rawInput);

  const created = await withTenant(ctx, async (tx) => {
    const def = await requireCustomObject(tx, ctx.tenantId, input.objectKey);
    const schema = asPropertySchema(def.propertySchema);

    const values =
      resolvePropertyBag({
        schema,
        existing: {},
        incoming: input.values,
        fieldPrefix: 'values',
      }) ?? {};

    const row = await tx.crmRecord.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        objectKey: input.objectKey,
        ownerId: input.ownerId ?? null,
        values: toJsonInput(values),
        title: titleFrom(values, def.primaryFieldKey),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.record.created',
      entityType: 'CrmRecord',
      entityId: row.id,
      diff: { after: { objectKey: row.objectKey, title: row.title } },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.record.created',
    payload: { recordId: created.id, objectKey: created.objectKey, title: created.title },
    dedupeKey: `crm.record.created:${created.id}`,
  });

  return created;
}

export async function update(
  ctx: ServiceContext,
  recordId: string,
  rawInput: unknown
): Promise<CrmRecord> {
  const input = UpdateCrmRecordInput.parse(rawInput);

  const { row, changed } = await withTenant(ctx, async (tx) => {
    const before = await tx.crmRecord.findUnique({ where: { id: recordId } });
    if (!before || before.deletedAt) throw new CrmNotFoundError('CrmRecord', recordId);

    const def = await requireCustomObject(tx, ctx.tenantId, before.objectKey);
    const schema = asPropertySchema(def.propertySchema);

    const values = resolvePropertyBag({
      schema,
      existing: before.values,
      incoming: input.values,
      fieldPrefix: 'values',
    });

    const updated = await tx.crmRecord.update({
      where: { id: recordId },
      data: {
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.ownerId !== undefined ? { ownerId: input.ownerId } : {}),
        ...(values !== undefined
          ? { values: toJsonInput(values), title: titleFrom(values, def.primaryFieldKey) }
          : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.record.updated',
      entityType: 'CrmRecord',
      entityId: updated.id,
      diff: { before: { values: before.values }, after: { values: updated.values } },
    });

    return { row: updated, changed: changedProperties(before.values, updated.values) };
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.record.updated',
    payload: { recordId: row.id, objectKey: row.objectKey, changed },
    dedupeKey: `crm.record.updated:${row.id}:${row.updatedAt.toISOString()}`,
  });

  // The automation trigger fires only when a DECLARED property actually moved —
  // renaming an owner is not a property change, and a save that changed nothing
  // must not wake every workflow watching this object.
  if (changed.length > 0) {
    await publishCrmEvent({
      tenantId: ctx.tenantId,
      topic: 'crm.property.changed',
      payload: { objectKey: row.objectKey, recordId: row.id, properties: changed },
      dedupeKey: `crm.property.changed:${row.id}:${row.updatedAt.toISOString()}`,
    });
  }

  return row;
}

/** Soft-delete. The row and its history stay; it drops out of every list. */
export async function remove(ctx: ServiceContext, recordId: string): Promise<void> {
  const record = await withTenant(ctx, async (tx) => {
    const before = await tx.crmRecord.findUnique({ where: { id: recordId } });
    if (!before || before.deletedAt) throw new CrmNotFoundError('CrmRecord', recordId);

    const row = await tx.crmRecord.update({
      where: { id: recordId },
      data: { deletedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.record.deleted',
      entityType: 'CrmRecord',
      entityId: row.id,
      diff: { before: { objectKey: row.objectKey, title: row.title } },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.record.deleted',
    payload: { recordId: record.id, objectKey: record.objectKey },
    dedupeKey: `crm.record.deleted:${record.id}`,
  });
}
