// layoutService — the Builder site layout (docs/45). One row per tenant: the
// chrome shell (header · outlet · footer) every page renders inside. Same
// draft/publish lifecycle as pageService, but there is exactly one layout, so
// the surface is singular: get-or-seed / save / publish. The storefront renders
// the PUBLISHED tree as the chrome around every page (docs/45 §2.6).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged. Tenant-scoped via withTenant() (FORCE RLS).

import {
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
import { BuilderNotFoundError } from '../errors';

function toDto(row: BuilderLayout): BuilderLayoutDto {
  return {
    id: row.id,
    name: row.name,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

/** The tenant's single layout, seeding the starter shell on first use — the
 *  lazy-materialization idiom (cf. pageService.listOrSeed). Idempotent: only
 *  seeds when none exists. */
export function getOrSeed(ctx: ServiceContext): Promise<BuilderLayoutDto> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findFirst();
    if (existing) return toDto(existing);

    const created = await tx.builderLayout.create({
      data: {
        tenantId: ctx.tenantId,
        name: STARTER_LAYOUT.name,
        draftTree: asJson(STARTER_LAYOUT.tree),
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
    return toDto(created);
  });
}

/** Save the draft tree and/or rename. Draft-tree saves are the high-frequency
 *  autosave path — deliberately NOT audited (cf. pageService.update). */
export async function update(ctx: ServiceContext, rawInput: unknown): Promise<BuilderLayoutDto> {
  const input = UpdateLayoutInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findFirst({ select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', 'site');

    const data: Prisma.BuilderLayoutUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);

    const updated = await tx.builderLayout.update({ where: { id: existing.id }, data });
    return toDto(updated);
  });
}

/** Snapshot the draft tree into the published tree. Emits builder.layout.published
 *  for the storefront render path (docs/45 §2.6). */
export async function publish(ctx: ServiceContext): Promise<BuilderLayoutDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderLayout.findFirst();
    if (!existing) throw new BuilderNotFoundError('BuilderLayout', 'site');
    const updated = await tx.builderLayout.update({
      where: { id: existing.id },
      data: {
        publishedTree: existing.draftTree as Prisma.InputJsonValue,
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

/** The storefront read (docs/45 §2.6): the PUBLISHED chrome tree, or null when
 *  the tenant has never published a layout (the storefront then falls back to the
 *  legacy chrome). Tenant-scoped via withTenant (the public route resolves the
 *  tenant by slug first). */
export function getPublished(ctx: ServiceContext): Promise<PublishedLayoutDto | null> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderLayout.findFirst();
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      tree: row.publishedTree as unknown as BuilderNode,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
