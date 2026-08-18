// objectDefService — the CRM object registry (docs/144 §3).
//
// What a CRM record IS, per tenant: the four built-in objects plus whatever the
// business invented, and for each of them the extra properties they track.
//
// TWO KINDS, ONE TABLE, AND THE DIFFERENCE IS NOT COSMETIC:
//
//   builtin — contact / company / deal / ticket. sparx owns the spine (a
//     contact's email, a deal's value: indexed columns that segments, reports
//     and the order consumer depend on) and the tenant owns the ADDITIONS,
//     which live in a `custom_properties` bag on that object's own table. These
//     four rows are seeded by CRM module activation and can never be created or
//     deleted through this service — only extended.
//
//   custom — an object the business invented. The schema is the whole record
//     and the rows live in `crm_records`.
//
// A tenant can therefore add "warranty expires" to their contacts and invent a
// "service contract" object, and both are the same operation on the same table
// with the same editor and the same validator.

import {
  BUILTIN_OBJECT_KEYS,
  CreateObjectDefInput,
  UpdateObjectDefInput,
  checkPropertySchema,
  type BuiltinObjectKey,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CrmObjectDef, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError, CrmValidationError } from '../errors';
import { asPropertySchema, toJsonInput } from './custom-properties';

/**
 * The four built-ins as they are seeded. Plural labels are the words a business
 * owner would use, not our table names — this is what titles their nav and
 * their property editor.
 */
export const BUILTIN_OBJECT_SEEDS: Record<
  BuiltinObjectKey,
  { label: string; labelPlural: string; iconKey: string; description: string }
> = {
  contact: {
    label: 'Customer',
    labelPlural: 'Customers',
    iconKey: 'users',
    description: 'The people you do business with.',
  },
  company: {
    label: 'Company',
    labelPlural: 'Companies',
    iconKey: 'building-2',
    description: 'The businesses your customers work for or buy through.',
  },
  deal: {
    label: 'Deal',
    labelPlural: 'Deals',
    iconKey: 'target',
    description: 'The sales you are working on.',
  },
  ticket: {
    label: 'Request',
    labelPlural: 'Requests',
    iconKey: 'life-buoy',
    description: 'Questions and problems your customers need help with.',
  },
};

function isBuiltinKey(key: string): key is BuiltinObjectKey {
  return (BUILTIN_OBJECT_KEYS as readonly string[]).includes(key);
}

/* ── Reads ──────────────────────────────────────────────────────────────── */

export async function list(
  ctx: ServiceContext,
  args: { kind?: 'builtin' | 'custom'; includeArchived?: boolean } = {}
): Promise<CrmObjectDef[]> {
  // Self-heal before reading. Activation seeds the built-ins, but every tenant
  // who switched CRM on BEFORE this feature existed never got that event — and
  // for them the registry would otherwise stay empty forever, which reads as
  // "this business tracks nothing." Healing on read costs one count query and
  // makes the surface correct for old and new tenants alike.
  if (args.kind !== 'custom') await ensureBuiltins(ctx);

  return withTenant(ctx, (tx) =>
    tx.crmObjectDef.findMany({
      where: {
        ...(args.kind ? { kind: args.kind } : {}),
        ...(args.includeArchived ? {} : { archivedAt: null }),
      },
      // Built-ins first, then the tenant's own alphabetically — the order the
      // property editor's sidebar wants without sorting client-side.
      orderBy: [{ kind: 'asc' }, { label: 'asc' }],
    })
  );
}

export async function get(ctx: ServiceContext, key: string): Promise<CrmObjectDef> {
  const def = await withTenant(ctx, (tx) =>
    tx.crmObjectDef.findUnique({ where: { tenantId_key: { tenantId: ctx.tenantId, key } } })
  );
  if (!def) throw new CrmNotFoundError('CrmObjectDef', key);
  return def;
}

/**
 * The object's schema, or an empty one when it has never been extended.
 *
 * The hot path: every contact/deal/company write calls this. A missing row is
 * NOT an error here — a tenant who enabled CRM before this feature existed has
 * no rows yet, and their writes must keep working exactly as before.
 */
export async function schemaFor(
  ctx: ServiceContext,
  key: string,
  tx?: Prisma.TransactionClient
): Promise<{ fields: [] } | ReturnType<typeof asPropertySchema>> {
  const read = async (client: Prisma.TransactionClient) =>
    client.crmObjectDef.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
      select: { propertySchema: true },
    });
  const row = tx ? await read(tx) : await withTenant(ctx, read);
  return asPropertySchema(row?.propertySchema);
}

/* ── Seeding the built-ins ──────────────────────────────────────────────── */

/**
 * Make sure the four built-in rows exist. Idempotent, and called from CRM
 * module activation, from `bootstrap`, and from `list` — never from a
 * migration, which must not invent rows for tenants that have not enabled the
 * module.
 *
 * Only ever CREATES. A tenant who renamed "Customers" to "Patients" and added
 * six properties must not have that undone by a redeploy re-running activation.
 */
export async function ensureBuiltins(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    // `list` calls this on every read, so the settled case — all four already
    // there — has to cost one count rather than four upserts.
    const present = await tx.crmObjectDef.count({ where: { kind: 'builtin' } });
    if (present >= BUILTIN_OBJECT_KEYS.length) return;

    for (const key of BUILTIN_OBJECT_KEYS) {
      const seed = BUILTIN_OBJECT_SEEDS[key];
      await tx.crmObjectDef.upsert({
        where: { tenantId_key: { tenantId: ctx.tenantId, key } },
        update: {}, // deliberately empty — see the note above
        create: {
          tenantId: ctx.tenantId,
          key,
          kind: 'builtin',
          label: seed.label,
          labelPlural: seed.labelPlural,
          iconKey: seed.iconKey,
          description: seed.description,
          propertySchema: { fields: [] },
        },
      });
    }
  });
}

/* ── Writes ─────────────────────────────────────────────────────────────── */

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmObjectDef> {
  const input = CreateObjectDefInput.parse(rawInput);
  const schema = input.propertySchema ?? { fields: [] };

  assertSchemaSound(schema, input.primaryFieldKey);

  const created = await withTenant(ctx, async (tx) => {
    const clash = await tx.crmObjectDef.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key: input.key } },
    });
    if (clash) {
      throw new CrmConflictError(`You already have a record type called "${input.key}".`, 'key');
    }

    const row = await tx.crmObjectDef.create({
      data: {
        tenantId: ctx.tenantId,
        key: input.key,
        kind: 'custom',
        label: input.label,
        labelPlural: input.labelPlural,
        iconKey: input.iconKey ?? null,
        description: input.description ?? null,
        propertySchema: toJsonInput(schema as unknown as Record<string, unknown>),
        primaryFieldKey: input.primaryFieldKey ?? null,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.object_def.created',
      entityType: 'CrmObjectDef',
      entityId: row.id,
      diff: { after: { key: row.key, label: row.label } },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.object_def.created',
    payload: { objectKey: created.key, kind: created.kind },
    dedupeKey: `crm.object_def.created:${created.id}`,
  });

  return created;
}

export async function update(
  ctx: ServiceContext,
  key: string,
  rawInput: unknown
): Promise<CrmObjectDef> {
  const input = UpdateObjectDefInput.parse(rawInput);

  const updated = await withTenant(ctx, async (tx) => {
    const before = await tx.crmObjectDef.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    });
    if (!before) throw new CrmNotFoundError('CrmObjectDef', key);

    const schema = input.propertySchema ?? asPropertySchema(before.propertySchema);
    const primary =
      input.primaryFieldKey === undefined ? before.primaryFieldKey : input.primaryFieldKey;
    assertSchemaSound(schema, primary);

    // Removing a field does NOT rewrite the rows that hold it. The bag keeps the
    // orphaned key, the validator strips it on the next write, and until then
    // nothing renders it — so a field deleted by mistake is recoverable by
    // re-adding it, which a destructive backfill would make impossible.
    const row = await tx.crmObjectDef.update({
      where: { id: before.id },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.labelPlural !== undefined ? { labelPlural: input.labelPlural } : {}),
        ...(input.iconKey !== undefined ? { iconKey: input.iconKey } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.propertySchema !== undefined
          ? { propertySchema: toJsonInput(schema as unknown as Record<string, unknown>) }
          : {}),
        ...(input.primaryFieldKey !== undefined ? { primaryFieldKey: input.primaryFieldKey } : {}),
      },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.object_def.updated',
      entityType: 'CrmObjectDef',
      entityId: row.id,
      diff: {
        before: { propertySchema: before.propertySchema, label: before.label },
        after: { propertySchema: row.propertySchema, label: row.label },
      },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.object_def.updated',
    payload: { objectKey: updated.key, kind: updated.kind },
    dedupeKey: `crm.object_def.updated:${updated.id}:${updated.updatedAt.toISOString()}`,
  });

  return updated;
}

/**
 * Archive a custom object. Its records stay — archiving hides a thing, deleting
 * loses it, and a business that stops tracking service contracts still wants
 * last year's.
 *
 * A built-in cannot be archived: `contact` is not optional furniture, it is
 * where every order, deal and email in the platform points.
 */
export async function archive(ctx: ServiceContext, key: string): Promise<CrmObjectDef> {
  if (isBuiltinKey(key)) {
    throw new CrmValidationError(
      'The records sparx ships with cannot be removed. You can rename one, or take away the extra details you added to it.',
      [{ field: 'key', message: 'This is a built-in record type.' }]
    );
  }

  const archived = await withTenant(ctx, async (tx) => {
    const before = await tx.crmObjectDef.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    });
    if (!before) throw new CrmNotFoundError('CrmObjectDef', key);

    const row = await tx.crmObjectDef.update({
      where: { id: before.id },
      data: { archivedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.object_def.archived',
      entityType: 'CrmObjectDef',
      entityId: row.id,
      diff: { after: { key: row.key } },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.object_def.archived',
    payload: { objectKey: archived.key },
    dedupeKey: `crm.object_def.archived:${archived.id}`,
  });

  return archived;
}

/* ── Guards ─────────────────────────────────────────────────────────────── */

function assertSchemaSound(schema: { fields: unknown[] }, primaryFieldKey?: string | null): void {
  const problems = checkPropertySchema(schema as { fields: never[] }, { primaryFieldKey });
  if (problems.length > 0) {
    throw new CrmValidationError('These extra details need fixing before they can be saved.', [
      ...problems.map((message) => ({ field: 'propertySchema', message })),
    ]);
  }
}
