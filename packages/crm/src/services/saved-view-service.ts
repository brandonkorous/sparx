// savedViewService — one person's way of looking at a list (docs/144 §12).
//
// This could not have existed before the object registry. Every list had one
// fixed column set, so there was nothing to save; a tenant who has now declared
// six extra properties on a contact has a list that is wrong for everybody until
// each person can shape it once and keep it.
//
// TWO VISIBILITY RULES, and they are not the same rule:
//   · WHO CAN SEE IT — your own views, plus every shared view in the tenant.
//   · WHO CAN CHANGE IT — the author, and nobody else. A shared view that four
//     people can edit is one that changes under three of them.
//
// The site scope is a FILTER on the list, not a partition: a tenant-wide view
// (propertyId null) shows on every site, because "my open deals" means the same
// thing wherever you are standing.

import { CreateSavedViewInput, UpdateSavedViewInput } from '@sparx/crm-schemas';
import { withTenant } from '@sparx/db';
import type { CrmSavedView, Prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

export interface ListSavedViewsFilter {
  objectKey?: string;
  propertyId?: string | null;
}

/** Whether this context's user authored the view — what gates rename + delete. */
export function isAuthor(ctx: ServiceContext, view: CrmSavedView): boolean {
  return ctx.userId !== undefined && view.userId === ctx.userId;
}

/**
 * Every view this person may see, own ones first.
 *
 * Own-before-shared rather than alphabetical: the list is a picker, and the view
 * somebody made for themselves is overwhelmingly the one they are reaching for.
 */
export async function list(
  ctx: ServiceContext,
  filter: ListSavedViewsFilter = {}
): Promise<CrmSavedView[]> {
  const userId = ctx.userId ?? null;

  const where: Prisma.CrmSavedViewWhereInput = {
    ...(filter.objectKey ? { objectKey: filter.objectKey } : {}),
    ...(filter.propertyId !== undefined
      ? filter.propertyId === null
        ? { propertyId: null }
        : { OR: [{ propertyId: null }, { propertyId: filter.propertyId }] }
      : {}),
    // A caller with no user (an API key) sees the shared ones and nothing else.
    // Its "own" views would be everybody's, which is the opposite of the point.
    ...(userId ? { OR: [{ userId }, { isShared: true }] } : { isShared: true }),
  };

  const rows = await withTenant(ctx, (tx) =>
    tx.crmSavedView.findMany({ where, orderBy: [{ name: 'asc' }] })
  );

  return rows.sort((a, b) => {
    const mine = Number(b.userId === userId) - Number(a.userId === userId);
    return mine !== 0 ? mine : a.name.localeCompare(b.name);
  });
}

export async function get(ctx: ServiceContext, id: string): Promise<CrmSavedView> {
  const view = await withTenant(ctx, (tx) => tx.crmSavedView.findUnique({ where: { id } }));
  if (!view) throw new CrmNotFoundError('CrmSavedView', id);
  if (!view.isShared && !isAuthor(ctx, view)) {
    // Not-found rather than forbidden: a private view's EXISTENCE is part of what
    // is private, and "you may not see this" tells a caller it is there.
    throw new CrmNotFoundError('CrmSavedView', id);
  }
  return view;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmSavedView> {
  const input = CreateSavedViewInput.parse(rawInput);
  if (!ctx.userId) {
    throw new CrmValidationError('A saved view needs a person to belong to.');
  }
  const userId = ctx.userId;

  return withTenant(ctx, async (tx) => {
    if (input.isDefault) await clearDefault(tx, userId, input.objectKey);

    return tx.crmSavedView.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        userId,
        objectKey: input.objectKey,
        name: input.name,
        // The one cast that is genuinely load-bearing: a ConditionGroup is a Zod
        // object with a typed array on it, and Prisma's JSON input type rejects
        // that structurally on `conditions`. The value IS json.
        filters: input.filters as Prisma.InputJsonValue,
        columns: input.columns,
        sort: input.sort ?? undefined,
        isShared: input.isShared,
        isDefault: input.isDefault,
      },
    });
  });
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CrmSavedView> {
  const input = UpdateSavedViewInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.crmSavedView.findUnique({ where: { id } });
    if (!before) throw new CrmNotFoundError('CrmSavedView', id);
    if (!isAuthor(ctx, before)) {
      throw new CrmValidationError(
        'Only the person who made this view can change it. Save your own copy instead.'
      );
    }

    if (input.isDefault === true) await clearDefault(tx, before.userId, before.objectKey, id);

    return tx.crmSavedView.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.filters !== undefined ? { filters: input.filters as Prisma.InputJsonValue } : {}),
        ...(input.columns !== undefined ? { columns: input.columns } : {}),
        ...(input.sort !== undefined ? { sort: input.sort ?? undefined } : {}),
        ...(input.isShared !== undefined ? { isShared: input.isShared } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const before = await tx.crmSavedView.findUnique({ where: { id } });
    if (!before) throw new CrmNotFoundError('CrmSavedView', id);
    if (!isAuthor(ctx, before)) {
      throw new CrmValidationError('Only the person who made this view can delete it.');
    }
    await tx.crmSavedView.delete({ where: { id } });
  });
}

/**
 * Copy somebody else's shared view into your own.
 *
 * The alternative to this is people editing a shared view to make one small
 * change, which breaks it for everyone else — so the button that would do harm
 * is replaced by the one that does what they meant.
 */
export async function duplicate(
  ctx: ServiceContext,
  id: string,
  name?: string
): Promise<CrmSavedView> {
  const source = await get(ctx, id);
  if (!ctx.userId) {
    throw new CrmValidationError('A saved view needs a person to belong to.');
  }
  const userId = ctx.userId;
  const trimmed = name?.trim();
  const copyName = trimmed !== undefined && trimmed !== '' ? trimmed : `${source.name} (my copy)`;

  return withTenant(ctx, (tx) =>
    tx.crmSavedView.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: source.propertyId,
        userId,
        objectKey: source.objectKey,
        // `??` would be wrong here: a caller who sent an empty name meant
        // "use the default", and nullish-coalescing would keep the blank.
        name: copyName,
        filters: source.filters as Prisma.InputJsonValue,
        columns: source.columns,
        sort: source.sort ?? undefined,
        // A copy is yours until you choose to share it, and it is not your
        // landing view until you say so.
        isShared: false,
        isDefault: false,
      },
    })
  );
}

/** One default per (user, object) — the partial unique index refuses a second. */
async function clearDefault(
  tx: Prisma.TransactionClient,
  userId: string,
  objectKey: string,
  exceptId?: string
): Promise<void> {
  await tx.crmSavedView.updateMany({
    where: { userId, objectKey, isDefault: true, ...(exceptId ? { id: { not: exceptId } } : {}) },
    data: { isDefault: false },
  });
}
