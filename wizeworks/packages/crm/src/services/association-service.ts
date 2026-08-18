// associationService — the relationship graph (docs/144 §6).
//
// "These two records are related, and here is how." The case that forced it: a
// deal has one `customer_id`, and real deals are sold to several people — the
// one who signs, the one who will use it, the one in accounts who pays. Until a
// record can be related to more than one other record WITH A NAME on the
// relationship, "who else is involved here?" has no answer.
//
// THREE COMMITMENTS THIS FILE KEEPS, NONE VISIBLE FROM A SIGNATURE:
//
//  1. THE LEGACY COLUMNS STAY CORRECT. `deals.customer_id` and the FKs like it
//     are read by the order consumer, the segment projection, four reports and
//     the storefront. Marking an association primary WRITES THAT COLUMN, in the
//     same transaction, so the graph and the pointer can never disagree. This is
//     the difference between adding a feature and forking the data model.
//
//  2. LINKS ARE SYMMETRIC TO READ, DIRECTED TO STORE. One row, read from either
//     end: `listFor` finds a record's associations whether it is the `from` or
//     the `to`, and flips the label to its inverse when it is the `to`. Storing
//     both directions would double every write and let the two halves drift.
//
//  3. NOTHING POINTS AT NOTHING. Endpoints carry no FK (the table depends on the
//     object key), so existence is checked here on every write. An association
//     to a deleted record is possible only by deleting afterwards, and the panel
//     shows those struck through rather than hiding them.

import {
  BUILTIN_ASSOCIATION_LABELS,
  CreateAssociationInput,
  CreateAssociationLabelInput,
  UpdateAssociationInput,
  UpdateAssociationLabelInput,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CrmAssociation, CrmAssociationLabel, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError, CrmValidationError } from '../errors';
import {
  primaryMirrorFor,
  recordExists,
  resolveRecordRefs,
  type RecordRef,
} from './record-locator';

/** One association as a surface needs it: the other record, named, with the
 *  relationship worded from the point of view of the record you are looking at. */
export interface AssociationView {
  id: string;
  /** The relationship key, or null when the link is unlabelled. */
  labelKey: string | null;
  /** The relationship worded for THIS end. Falls back to the key, then to a
   *  plain word — a panel must never render an empty heading. */
  label: string;
  isPrimary: boolean;
  note: string | null;
  createdAt: Date;
  /** The record at the other end. Null only if it has been hard-deleted, which
   *  the services avoid but a direct DB edit could produce. */
  other: RecordRef | null;
  /** True when the record we asked about is the `to` side, so the label shown is
   *  the inverse. Surfaces do not need this; it makes the data honest. */
  reversed: boolean;
}

/* ── Labels ─────────────────────────────────────────────────────────────── */

export async function listLabels(
  ctx: ServiceContext,
  args: { fromType?: string; toType?: string } = {}
): Promise<CrmAssociationLabel[]> {
  // Self-heal, for the same reason the object registry does: a tenant who
  // enabled CRM before this shipped never saw the activation event, and an empty
  // label list makes every relationship they record unlabelled.
  await ensureBuiltinLabels(ctx);

  return withTenant(ctx, (tx) =>
    tx.crmAssociationLabel.findMany({
      where: {
        ...(args.fromType ? { fromType: args.fromType } : {}),
        ...(args.toType ? { toType: args.toType } : {}),
      },
      orderBy: [{ fromType: 'asc' }, { toType: 'asc' }, { sortOrder: 'asc' }],
    })
  );
}

/**
 * Seed the relationships sparx ships. Idempotent, create-only.
 *
 * Called from CRM activation AND from `listLabels`' callers via `listFor`, for
 * the same reason the object registry self-heals: every tenant who enabled CRM
 * before this shipped never saw the activation event, and without a repair on
 * read their label list is empty forever — which means every association they
 * make is unlabelled and the feature looks broken rather than new.
 */
export async function ensureBuiltinLabels(ctx: ServiceContext): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const present = await tx.crmAssociationLabel.count({ where: { isBuiltin: true } });
    if (present >= BUILTIN_ASSOCIATION_LABELS.length) return;

    for (const seed of BUILTIN_ASSOCIATION_LABELS) {
      await tx.crmAssociationLabel.upsert({
        where: {
          tenantId_fromType_toType_key: {
            tenantId: ctx.tenantId,
            fromType: seed.fromType,
            toType: seed.toType,
            key: seed.key,
          },
        },
        // Empty on purpose — a tenant who renamed "Signs it off" to "Approver"
        // keeps it through any re-activation, exactly like the object registry.
        update: {},
        create: {
          tenantId: ctx.tenantId,
          fromType: seed.fromType,
          toType: seed.toType,
          key: seed.key,
          label: seed.label,
          inverseLabel: seed.inverseLabel,
          sortOrder: seed.sortOrder,
          isBuiltin: true,
        },
      });
    }
  });
}

export async function createLabel(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CrmAssociationLabel> {
  const input = CreateAssociationLabelInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const clash = await tx.crmAssociationLabel.findUnique({
      where: {
        tenantId_fromType_toType_key: {
          tenantId: ctx.tenantId,
          fromType: input.fromType,
          toType: input.toType,
          key: input.key,
        },
      },
    });
    if (clash) {
      throw new CrmConflictError(`You already have a relationship called "${input.key}".`, 'key');
    }

    const row = await tx.crmAssociationLabel.create({
      data: {
        tenantId: ctx.tenantId,
        fromType: input.fromType,
        toType: input.toType,
        key: input.key,
        label: input.label,
        inverseLabel: input.inverseLabel,
        sortOrder: input.sortOrder ?? 100,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association_label.created',
      entityType: 'CrmAssociationLabel',
      entityId: row.id,
      diff: { after: { key: row.key, label: row.label } },
    });
    return row;
  });
}

export async function updateLabel(
  ctx: ServiceContext,
  labelId: string,
  rawInput: unknown
): Promise<CrmAssociationLabel> {
  const input = UpdateAssociationLabelInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.crmAssociationLabel.findUnique({ where: { id: labelId } });
    if (!before) throw new CrmNotFoundError('CrmAssociationLabel', labelId);

    const row = await tx.crmAssociationLabel.update({
      where: { id: labelId },
      data: {
        ...(input.label !== undefined ? { label: input.label } : {}),
        ...(input.inverseLabel !== undefined ? { inverseLabel: input.inverseLabel } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association_label.updated',
      entityType: 'CrmAssociationLabel',
      entityId: row.id,
      diff: { before: { label: before.label }, after: { label: row.label } },
    });
    return row;
  });
}

/**
 * Remove a relationship type. The LINKS survive, unlabelled.
 *
 * Deleting the links would be deleting the fact that two records are related
 * because someone stopped liking the word for it. An unlabelled association is
 * a valid, first-class state, so degrading to it is lossless in the way that
 * matters.
 */
export async function deleteLabel(ctx: ServiceContext, labelId: string): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.crmAssociationLabel.findUnique({ where: { id: labelId } });
    if (!before) throw new CrmNotFoundError('CrmAssociationLabel', labelId);

    const orphaned = await tx.crmAssociation.updateMany({
      where: { fromType: before.fromType, toType: before.toType, labelKey: before.key },
      data: { labelKey: null },
    });
    await tx.crmAssociationLabel.delete({ where: { id: labelId } });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association_label.deleted',
      entityType: 'CrmAssociationLabel',
      entityId: labelId,
      diff: { before: { key: before.key }, after: { unlabelledLinks: orphaned.count } },
    });
    return orphaned.count;
  });
}

/* ── Associations ───────────────────────────────────────────────────────── */

/**
 * Everything related to one record, from BOTH directions, named and worded for
 * the end you are standing on.
 *
 * The single query most surfaces need. Everything it does — the OR across both
 * columns, the label flip, the batched name resolution — exists because doing
 * any of it at the call site is how a panel ends up showing half a graph.
 */
export async function listFor(
  ctx: ServiceContext,
  args: { objectKey: string; recordId: string; toType?: string; labelKey?: string; take?: number }
): Promise<AssociationView[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.crmAssociation.findMany({
      where: {
        OR: [
          {
            fromType: args.objectKey,
            fromId: args.recordId,
            ...(args.toType ? { toType: args.toType } : {}),
          },
          {
            toType: args.objectKey,
            toId: args.recordId,
            ...(args.toType ? { fromType: args.toType } : {}),
          },
        ],
        ...(args.labelKey ? { labelKey: args.labelKey } : {}),
      },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      take: args.take ?? 200,
    });
    if (rows.length === 0) return [];

    const labels = await tx.crmAssociationLabel.findMany();
    return await decorate(tx, args.objectKey, args.recordId, rows, labels);
  });
}

/** Turn stored rows into what a panel renders. Extracted so `create` can return
 *  the same shape a list does — a surface that has to reshape a create response
 *  is a surface that will eventually reshape it differently. */
async function decorate(
  tx: Prisma.TransactionClient,
  objectKey: string,
  recordId: string,
  rows: CrmAssociation[],
  labels: CrmAssociationLabel[]
): Promise<AssociationView[]> {
  // Batch the name lookups by object kind — a deal with eight related contacts
  // must be two queries, not nine.
  const idsByType = new Map<string, string[]>();
  for (const row of rows) {
    const reversed = row.toType === objectKey && row.toId === recordId;
    const otherType = reversed ? row.fromType : row.toType;
    const otherId = reversed ? row.fromId : row.toId;
    const list = idsByType.get(otherType);
    if (list) list.push(otherId);
    else idsByType.set(otherType, [otherId]);
  }

  const refs = new Map<string, RecordRef>();
  for (const [type, ids] of idsByType) {
    const resolved = await resolveRecordRefs(tx, '', type, ids);
    for (const [id, ref] of resolved) refs.set(`${type}:${id}`, ref);
  }

  const labelIndex = new Map(
    labels.map((label) => [`${label.fromType}:${label.toType}:${label.key}`, label])
  );

  return rows.map((row) => {
    const reversed = row.toType === objectKey && row.toId === recordId;
    const otherType = reversed ? row.fromType : row.toType;
    const otherId = reversed ? row.fromId : row.toId;
    const definition = row.labelKey
      ? labelIndex.get(`${row.fromType}:${row.toType}:${row.labelKey}`)
      : undefined;

    return {
      id: row.id,
      labelKey: row.labelKey,
      // Worded for the end you are standing on. Falling back to the raw key
      // rather than to nothing keeps a link readable when a label was deleted
      // between the write and the read.
      label: definition
        ? reversed
          ? definition.inverseLabel
          : definition.label
        : (row.labelKey ?? 'Related'),
      isPrimary: row.isPrimary,
      note: row.note,
      createdAt: row.createdAt,
      other: refs.get(`${otherType}:${otherId}`) ?? null,
      reversed,
    };
  });
}

/**
 * Relate two records.
 *
 * Rejects a link to a record that does not exist, refuses a duplicate in words a
 * person can act on, and — when `isPrimary` — writes the legacy FK column in the
 * same transaction so the graph and the pointer cannot disagree.
 */
export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmAssociation> {
  const input = CreateAssociationInput.parse(rawInput);

  const created = await withTenant(ctx, async (tx) => {
    for (const end of [
      { type: input.fromType, id: input.fromId, field: 'fromId' },
      { type: input.toType, id: input.toId, field: 'toId' },
    ]) {
      if (!(await recordExists(tx, ctx.tenantId, end.type, end.id))) {
        throw new CrmValidationError('One of these records could not be found.', [
          { field: end.field, message: `No ${end.type} with that id.` },
        ]);
      }
    }

    if (input.labelKey) await assertLabelExists(tx, input.fromType, input.toType, input.labelKey);

    const clash = await tx.crmAssociation.findFirst({
      where: {
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        labelKey: input.labelKey ?? null,
      },
    });
    if (clash) {
      throw new CrmConflictError('These two are already linked that way.', 'labelKey');
    }

    const row = await tx.crmAssociation.create({
      data: {
        tenantId: ctx.tenantId,
        fromType: input.fromType,
        fromId: input.fromId,
        toType: input.toType,
        toId: input.toId,
        labelKey: input.labelKey ?? null,
        isPrimary: false,
        note: input.note ?? null,
        createdBy: ctx.userId ?? null,
      },
    });

    if (input.isPrimary === true) await promote(tx, ctx, row);

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association.created',
      entityType: 'CrmAssociation',
      entityId: row.id,
      diff: {
        after: {
          from: `${row.fromType}:${row.fromId}`,
          to: `${row.toType}:${row.toId}`,
          labelKey: row.labelKey,
        },
      },
    });

    return input.isPrimary === true
      ? await tx.crmAssociation.findUniqueOrThrow({ where: { id: row.id } })
      : row;
  });

  // AFTER the commit — an automation that reacts to a new relationship must
  // never see one that then rolls back.
  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.association.added',
    payload: {
      associationId: created.id,
      fromType: created.fromType,
      fromId: created.fromId,
      toType: created.toType,
      toId: created.toId,
      labelKey: created.labelKey,
    },
    dedupeKey: `crm.association.added:${created.id}`,
  });

  return created;
}

export async function update(
  ctx: ServiceContext,
  associationId: string,
  rawInput: unknown
): Promise<CrmAssociation> {
  const input = UpdateAssociationInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.crmAssociation.findUnique({ where: { id: associationId } });
    if (!before) throw new CrmNotFoundError('CrmAssociation', associationId);

    if (input.labelKey) await assertLabelExists(tx, before.fromType, before.toType, input.labelKey);

    // Relabelling can collide with a link that already carries the new label.
    if (input.labelKey !== undefined && input.labelKey !== before.labelKey) {
      const clash = await tx.crmAssociation.findFirst({
        where: {
          fromType: before.fromType,
          fromId: before.fromId,
          toType: before.toType,
          toId: before.toId,
          labelKey: input.labelKey,
          id: { not: before.id },
        },
      });
      if (clash) throw new CrmConflictError('These two are already linked that way.', 'labelKey');
    }

    const row = await tx.crmAssociation.update({
      where: { id: associationId },
      data: {
        ...(input.labelKey !== undefined ? { labelKey: input.labelKey } : {}),
        ...(input.note !== undefined ? { note: input.note } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association.updated',
      entityType: 'CrmAssociation',
      entityId: row.id,
      diff: { before: { labelKey: before.labelKey }, after: { labelKey: row.labelKey } },
    });
    return row;
  });
}

/**
 * Make this the primary one — the association the legacy FK column mirrors.
 *
 * Demotes whatever held it, writes the column, and does both in one transaction.
 * The partial unique index in the migration is the backstop: if this ever wrote
 * two primaries the database refuses rather than letting `deals.customer_id`
 * become ambiguous.
 */
export async function makePrimary(
  ctx: ServiceContext,
  associationId: string
): Promise<CrmAssociation> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.crmAssociation.findUnique({ where: { id: associationId } });
    if (!row) throw new CrmNotFoundError('CrmAssociation', associationId);
    if (row.isPrimary) return row;
    await promote(tx, ctx, row);
    return tx.crmAssociation.findUniqueOrThrow({ where: { id: associationId } });
  });
}

/** Demote the current holder, promote this row, and mirror onto the FK column. */
async function promote(
  tx: Prisma.TransactionClient,
  ctx: ServiceContext,
  row: CrmAssociation
): Promise<void> {
  await tx.crmAssociation.updateMany({
    where: {
      fromType: row.fromType,
      fromId: row.fromId,
      toType: row.toType,
      isPrimary: true,
      id: { not: row.id },
    },
    data: { isPrimary: false },
  });
  await tx.crmAssociation.update({ where: { id: row.id }, data: { isPrimary: true } });
  await mirrorToColumn(tx, row.fromType, row.fromId, row.toType, row.toId);
}

/**
 * Keep the legacy FK column in step. Silent when the pair has no column —
 * the normal case, and not an error: most relationships never had one.
 */
async function mirrorToColumn(
  tx: Prisma.TransactionClient,
  fromType: string,
  fromId: string,
  toType: string,
  toId: string | null
): Promise<void> {
  const mirror = primaryMirrorFor(fromType, toType);
  if (!mirror) return;
  const data = { [mirror.column]: toId } as Record<string, string | null>;
  if (mirror.table === 'deal') {
    await tx.deal.update({ where: { id: fromId }, data });
  } else {
    await tx.customer.update({ where: { id: fromId }, data });
  }
}

/**
 * Unlink two records.
 *
 * Removing the PRIMARY also clears the FK column it mirrored — leaving
 * `deals.customer_id` pointing at a contact the deal is no longer related to is
 * exactly the drift this design exists to prevent. Another link of the same
 * shape is promoted in its place when there is one, because a deal that still
 * has a contact should still name one.
 */
export async function remove(ctx: ServiceContext, associationId: string): Promise<void> {
  const removed = await withTenant(ctx, async (tx) => {
    const row = await tx.crmAssociation.findUnique({ where: { id: associationId } });
    if (!row) throw new CrmNotFoundError('CrmAssociation', associationId);

    await tx.crmAssociation.delete({ where: { id: associationId } });

    if (row.isPrimary) {
      const successor = await tx.crmAssociation.findFirst({
        where: { fromType: row.fromType, fromId: row.fromId, toType: row.toType },
        orderBy: { createdAt: 'asc' },
      });
      if (successor) {
        await tx.crmAssociation.update({ where: { id: successor.id }, data: { isPrimary: true } });
        await mirrorToColumn(tx, row.fromType, row.fromId, row.toType, successor.toId);
      } else {
        await mirrorToColumn(tx, row.fromType, row.fromId, row.toType, null);
      }
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.association.removed',
      entityType: 'CrmAssociation',
      entityId: associationId,
      diff: { before: { from: `${row.fromType}:${row.fromId}`, to: `${row.toType}:${row.toId}` } },
    });
    return row;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.association.removed',
    payload: {
      associationId,
      fromType: removed.fromType,
      fromId: removed.fromId,
      toType: removed.toType,
      toId: removed.toId,
    },
    dedupeKey: `crm.association.removed:${associationId}`,
  });
}

/**
 * Drop every link touching a record, both directions.
 *
 * Called when a record is deleted. Endpoints carry no FK, so nothing else would
 * clean them up, and an association pointing at a hard-deleted row is a chip
 * nobody can click.
 */
export async function removeAllFor(
  tx: Prisma.TransactionClient,
  objectKey: string,
  recordId: string
): Promise<number> {
  const result = await tx.crmAssociation.deleteMany({
    where: {
      OR: [
        { fromType: objectKey, fromId: recordId },
        { toType: objectKey, toId: recordId },
      ],
    },
  });
  return result.count;
}

/**
 * Record the relationship a legacy FK column already implies.
 *
 * The bridge in the other direction: code that still writes `deals.customer_id`
 * directly (the order consumer, the import worker, an existing form) gets its
 * primary association created for free, so the graph never falls behind the
 * column it mirrors. Idempotent, and silent about a pair that already exists.
 */
export async function syncPrimaryFromColumn(
  tx: Prisma.TransactionClient,
  tenantId: string,
  fromType: string,
  fromId: string,
  toType: string,
  toId: string | null
): Promise<void> {
  const existing = await tx.crmAssociation.findFirst({
    where: { fromType, fromId, toType, isPrimary: true },
  });

  if (toId === null) {
    if (existing)
      await tx.crmAssociation.update({ where: { id: existing.id }, data: { isPrimary: false } });
    return;
  }
  if (existing?.toId === toId) return;
  if (existing) {
    await tx.crmAssociation.update({ where: { id: existing.id }, data: { isPrimary: false } });
  }

  // The link may already exist unlabelled or under a label — promote it rather
  // than creating a second row for the same pair.
  const already = await tx.crmAssociation.findFirst({
    where: { fromType, fromId, toType, toId },
    orderBy: { createdAt: 'asc' },
  });
  if (already) {
    await tx.crmAssociation.update({ where: { id: already.id }, data: { isPrimary: true } });
    return;
  }
  await tx.crmAssociation.create({
    data: { tenantId, fromType, fromId, toType, toId, isPrimary: true },
  });
}

/* ── Guards ─────────────────────────────────────────────────────────────── */

async function assertLabelExists(
  tx: Prisma.TransactionClient,
  fromType: string,
  toType: string,
  key: string
): Promise<void> {
  const found = await tx.crmAssociationLabel.findFirst({ where: { fromType, toType, key } });
  if (!found) {
    throw new CrmValidationError('That relationship is not one you have set up.', [
      { field: 'labelKey', message: `No "${key}" relationship between these two kinds of record.` },
    ]);
  }
}
