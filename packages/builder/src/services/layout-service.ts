// layoutService — the Builder site layout catalog (docs/45). A tenant keeps MANY
// layouts: the chrome shell (header · outlet · footer) every page renders inside,
// with the SAME draft/publish lifecycle as pageService. Exactly one layout is
// ACTIVE — the live chrome the storefront serves. Publishing snapshots a layout's
// draft → published (a layout can be published-but-idle); setActive flips which
// PUBLISHED layout is live ("at most one active per tenant" is enforced in the DB
// by a partial unique index — see 20260622000000_builder_multi_layouts).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged. Tenant-scoped via withTenant() (FORCE RLS).

import {
  CreateLayoutInput,
  STARTER_LAYOUT,
  UpdateLayoutInput,
  type BuilderLayoutDto,
  type BuilderNode,
  type PublishedLayoutDto,
} from '@sparx/builder-schemas';
import type { BuilderLayout, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { ServiceContext } from '../errors';
import { BuilderConflictError, BuilderNotFoundError, BuilderValidationError } from '../errors';
import { expandTreeForPublish } from './component-service';

function toDto(row: BuilderLayout): BuilderLayoutDto {
  return {
    id: row.id,
    name: row.name,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    isActive: row.isActive,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

/** List the tenant's layouts. On first use (zero rows) seed the starter shell as
 *  the ACTIVE layout — the lazy-materialization idiom (cf. pageService.listOrSeed).
 *  Idempotent: only seeds when empty. */
export function listOrSeed(ctx: ServiceContext): Promise<BuilderLayoutDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderLayout.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) return rows.map(toDto);

    const created = await tx.builderLayout.create({
      data: {
        tenantId: ctx.tenantId,
        name: STARTER_LAYOUT.name,
        draftTree: asJson(STARTER_LAYOUT.tree),
        // The tenant's first layout is the live one.
        isActive: true,
        position: 0,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.layout.seeded',
      entityType: 'BuilderLayout',
      entityId: created.id,
      diff: { before: null, after: { name: created.name } },
    });
    return [toDto(created)];
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BuilderLayoutDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderLayout.findUnique({ where: { id } });
    if (!row) throw new BuilderNotFoundError('BuilderLayout', id);
    return toDto(row);
  });
}

/** Create a layout. Starts from the supplied tree or the starter shell. New
 *  layouts are NOT live until activated — UNLESS this is the tenant's first one
 *  (then it's active, so the storefront always has chrome). */
export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BuilderLayoutDto> {
  const input = CreateLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const count = await tx.builderLayout.count();
    const last = await tx.builderLayout.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;
    const created = await tx.builderLayout.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        draftTree: asJson(input.tree ?? STARTER_LAYOUT.tree),
        isActive: count === 0,
        position,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.layout.created',
      entityType: 'BuilderLayout',
      entityId: created.id,
      diff: { before: null, after: { name: created.name } },
    });
    return toDto(created);
  });
}

/** Save the draft tree and/or rename. Draft-tree saves are the high-frequency
 *  autosave path — deliberately NOT audited (cf. pageService.update). */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BuilderLayoutDto> {
  const input = UpdateLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', id);

    const data: Prisma.BuilderLayoutUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    const updated = await tx.builderLayout.update({ where: { id }, data });
    return toDto(updated);
  });
}

/** Delete a layout. Refuses to delete the LIVE one — make another active first
 *  (the storefront would otherwise lose its chrome). */
export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', id);
    if (existing.isActive) {
      throw new BuilderConflictError(
        'Cannot delete the live layout. Make another layout active first.',
        'isActive'
      );
    }
    await tx.builderLayout.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.layout.deleted',
      entityType: 'BuilderLayout',
      entityId: id,
      diff: { before: { name: existing.name }, after: null },
    });
  });
}

/** Snapshot the draft tree into the published tree. Does NOT change which layout
 *  is live — publishing a non-active layout leaves it published-but-idle until
 *  setActive flips it. Emits builder.layout.published. */
export async function publish(ctx: ServiceContext, id: string): Promise<BuilderLayoutDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', id);
    // Expand tenant components into concrete primitives (docs/53 §3) so the
    // storefront chrome renderer never sees a `custom:*` type.
    const published = await expandTreeForPublish(tx, existing.draftTree as unknown as BuilderNode);
    const updated = await tx.builderLayout.update({
      where: { id },
      data: {
        publishedTree: asJson(published),
        publishedAt: new Date(),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.layout.published',
      entityType: 'BuilderLayout',
      entityId: updated.id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.layout.published',
    payload: { layoutId: dto.id, name: dto.name },
  });
  return dto;
}

/** Make this layout the LIVE one (docs/45 §7). Requires a prior publish — the
 *  storefront serves the active layout's PUBLISHED tree, so activating an
 *  unpublished draft would render nothing. Clears the prior active then sets this
 *  one inside one tx, so the partial unique index never sees two active rows.
 *  Emits builder.layout.activated for the storefront render path. */
export async function setActive(ctx: ServiceContext, id: string): Promise<BuilderLayoutDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', id);
    if (existing.publishedTree == null) {
      throw new BuilderValidationError('Publish this layout before making it active.', [
        { field: 'id', message: 'Layout has no published version.' },
      ]);
    }
    if (existing.isActive) return toDto(existing); // already live — no-op

    await tx.builderLayout.updateMany({ where: { isActive: true }, data: { isActive: false } });
    const updated = await tx.builderLayout.update({ where: { id }, data: { isActive: true } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.layout.activated',
      entityType: 'BuilderLayout',
      entityId: updated.id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.layout.activated',
    payload: { layoutId: dto.id, name: dto.name },
  });
  return dto;
}

/** The storefront read (docs/45 §2.6): the ACTIVE layout's PUBLISHED chrome tree,
 *  or null when no active layout has been published (the storefront then falls
 *  back to the legacy chrome). Tenant-scoped via withTenant (the public route
 *  resolves the tenant by slug first). */
export function getPublished(ctx: ServiceContext): Promise<PublishedLayoutDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderLayout.findFirst({ where: { isActive: true } });
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      tree: row.publishedTree as unknown as BuilderNode,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
