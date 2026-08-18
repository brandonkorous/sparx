// Saved views — the PLATFORM list-persistence service (docs/24 shell, docs/104).
//
// Every dashboard list is URL-query-string driven: search / filters / sort /
// view all live in the query params, and the server component re-reads them and
// refetches. A "saved view" is therefore just a named snapshot of those params
// for one list `target` (route path or `module.surface` key), re-applied by
// navigating to `?<params>`. The shared ListToolbar reads/writes these, so any
// list gets "save this filtered view" with zero per-list wiring.
//
// Not module-gated — this is platform shell state (sibling of favorites/recents).
// Tenant-scoped via withTenant; RLS isolates per tenant. `ownerUserId` null = a
// view SHARED with the whole tenant; a non-null owner = private to that user. A
// list shows shared views + the caller's own private views.

import { z } from 'zod';
import { withTenant, type TenantContext, type TxClient, type SavedView } from '@wizeworks/db';
import { conflict, forbidden, notFound } from '@wizeworks/api-core/errors';

// config is opaque to the table; the ListToolbar re-applies `params` verbatim.
// Kept a permissive string map so a new list filter never needs a schema change.
export const SavedViewConfig = z.object({
  params: z.record(z.string(), z.string()).default({}),
});
export type SavedViewConfig = z.infer<typeof SavedViewConfig>;

export const CreateSavedViewInput = z.object({
  target: z.string().min(1).max(63),
  name: z.string().min(1).max(120),
  config: SavedViewConfig,
  isDefault: z.boolean().default(false),
  /** false (default) → private to the creating user; true → shared tenant-wide. */
  shared: z.boolean().default(false),
});
export type CreateSavedViewInput = z.infer<typeof CreateSavedViewInput>;

export const UpdateSavedViewInput = z.object({
  name: z.string().min(1).max(120).optional(),
  config: SavedViewConfig.optional(),
  isDefault: z.boolean().optional(),
});
export type UpdateSavedViewInput = z.infer<typeof UpdateSavedViewInput>;

export interface SavedViewDto {
  id: string;
  target: string;
  name: string;
  config: SavedViewConfig;
  isDefault: boolean;
  shared: boolean;
  createdAt: string;
  updatedAt: string;
}

function toDto(r: SavedView): SavedViewDto {
  return {
    id: r.id,
    target: r.target,
    name: r.name,
    config: SavedViewConfig.parse(r.config ?? {}),
    isDefault: r.isDefault,
    shared: r.ownerUserId === null,
    createdAt: r.createdAt.toISOString(),
    updatedAt: r.updatedAt.toISOString(),
  };
}

/** Visibility filter: tenant-shared views (null owner) + the caller's own. */
function visibleTo(userId: string | undefined) {
  return { OR: [{ ownerUserId: null }, ...(userId ? [{ ownerUserId: userId }] : [])] };
}

/** List the views for one target the caller can see, default first then by name. */
export async function list(ctx: TenantContext, target: string): Promise<SavedViewDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.savedView.findMany({
      where: { tenantId: ctx.tenantId, target, ...visibleTo(ctx.userId) },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    });
    return rows.map(toDto);
  });
}

export async function create(
  ctx: TenantContext,
  input: CreateSavedViewInput
): Promise<SavedViewDto> {
  const ownerUserId = input.shared ? null : (ctx.userId ?? null);
  return withTenant(ctx, async (tx) => {
    const clash = await tx.savedView.findFirst({
      where: { tenantId: ctx.tenantId, target: input.target, name: input.name, ownerUserId },
      select: { id: true },
    });
    if (clash)
      throw conflict(`A view named "${input.name}" already exists here.`, { field: 'name' });
    if (input.isDefault) await clearDefault(tx, ctx.tenantId, input.target, ownerUserId);
    const created = await tx.savedView.create({
      data: {
        tenantId: ctx.tenantId,
        ownerUserId,
        target: input.target,
        name: input.name,
        config: input.config,
        isDefault: input.isDefault,
      },
    });
    return toDto(created);
  });
}

export async function update(
  ctx: TenantContext,
  id: string,
  input: UpdateSavedViewInput
): Promise<SavedViewDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await loadOwned(tx, ctx, id);
    if (input.isDefault)
      await clearDefault(tx, ctx.tenantId, existing.target, existing.ownerUserId);
    const updated = await tx.savedView.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.config !== undefined ? { config: input.config } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
      },
    });
    return toDto(updated);
  });
}

/** Make this the one default for its (tenant, target, visibility scope). */
export async function setDefault(ctx: TenantContext, id: string): Promise<SavedViewDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await loadOwned(tx, ctx, id);
    await clearDefault(tx, ctx.tenantId, existing.target, existing.ownerUserId);
    const updated = await tx.savedView.update({ where: { id }, data: { isDefault: true } });
    return toDto(updated);
  });
}

export async function remove(ctx: TenantContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    await loadOwned(tx, ctx, id);
    await tx.savedView.delete({ where: { id } });
  });
}

// ─── helpers ─────────────────────────────────────────────────────────

/** Load a view the caller may mutate. Tenant is RLS-scoped; we additionally
 *  forbid editing another user's PRIVATE view (a shared view is team-editable). */
async function loadOwned(
  tx: TxClient,
  ctx: TenantContext,
  id: string
): Promise<Pick<SavedView, 'id' | 'target' | 'ownerUserId'>> {
  const row = await tx.savedView.findFirst({
    where: { id, tenantId: ctx.tenantId },
    select: { id: true, target: true, ownerUserId: true },
  });
  if (!row) throw notFound('SavedView', id);
  if (row.ownerUserId !== null && row.ownerUserId !== ctx.userId) {
    throw forbidden('This view belongs to another user.');
  }
  return row;
}

/** Clear the existing default within one visibility scope (shared OR one owner)
 *  so a target has at most one default per scope; the list resolves the caller's
 *  private default first, else the shared one. */
async function clearDefault(
  tx: TxClient,
  tenantId: string,
  target: string,
  ownerUserId: string | null
): Promise<void> {
  await tx.savedView.updateMany({
    where: { tenantId, target, ownerUserId, isDefault: true },
    data: { isDefault: false },
  });
}
