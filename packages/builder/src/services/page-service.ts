// pageService — the Builder page catalog and draft/publish lifecycle (docs/41).
//
// One row per page (BuilderPage); the editor edits the DRAFT tree, publishing
// snapshots it. Trees are validated against @sparx/builder-schemas on every
// write so every transport stores the same shape. Tenant-scoped via
// withTenant() — a callsite that forgets it sees nothing (FORCE RLS).
//
// One service, many transports: REST mounts these today; MCP + Server Actions
// reuse them unchanged.

import {
  CreatePageInput,
  ReorderPagesInput,
  STARTER_PAGES,
  UpdatePageInput,
  blankPageTree,
  type BuilderNode,
  type BuilderPageDto,
  type BuilderPageKind,
  type PublishedPageDto,
} from '@sparx/builder-schemas';
import type { BuilderPage, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishBuilderEvent } from '../events';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError } from '../errors';

function toDto(row: BuilderPage): BuilderPageDto {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    kind: row.kind as BuilderPageKind,
    recordType: row.recordType,
    // Stored validated on write; the editor depends on a well-formed tree.
    tree: row.draftTree as unknown as BuilderNode,
    published: row.publishedTree != null,
    publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

const asJson = (tree: BuilderNode): Prisma.InputJsonValue =>
  tree as unknown as Prisma.InputJsonValue;

/** List the tenant's pages. On first use (zero rows) seed the curated starter
 *  set — the lazy-materialization idiom (cf. getOrCreateConfig). Idempotent:
 *  only seeds when empty. */
export function listOrSeed(ctx: ServiceContext): Promise<BuilderPageDto[]> {
  return withTenant(ctx, async (tx) => {
    const rows = await tx.builderPage.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    if (rows.length > 0) return rows.map(toDto);

    await tx.builderPage.createMany({
      data: STARTER_PAGES.map((s, i) => ({
        tenantId: ctx.tenantId,
        name: s.name,
        kind: s.kind,
        recordType: s.recordType ?? null,
        draftTree: asJson(s.tree),
        position: i,
      })),
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.pages.seeded',
      entityType: 'BuilderPage',
      entityId: null,
      diff: { after: { count: STARTER_PAGES.length } },
    });
    const seeded = await tx.builderPage.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return seeded.map(toDto);
  });
}

export function get(ctx: ServiceContext, id: string): Promise<BuilderPageDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderPage.findUnique({ where: { id } });
    if (!row) throw new BuilderNotFoundError('BuilderPage', id);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<BuilderPageDto> {
  const input = CreatePageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const last = await tx.builderPage.findFirst({
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const position = last ? last.position + 1 : 0;
    const created = await tx.builderPage.create({
      data: {
        tenantId: ctx.tenantId,
        name: input.name,
        kind: input.kind,
        recordType: input.recordType ?? null,
        slug: input.slug ?? null,
        draftTree: asJson(input.tree ?? blankPageTree()),
        position,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.created',
      entityType: 'BuilderPage',
      entityId: created.id,
      diff: { before: null, after: { name: created.name, kind: created.kind } },
    });
    return toDto(created);
  });
}

/** Rename and/or save the draft tree and/or retarget. Draft-tree saves are the
 *  high-frequency autosave path — deliberately NOT audited. */
export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<BuilderPageDto> {
  const input = UpdatePageInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);

    const data: Prisma.BuilderPageUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.tree !== undefined) data.draftTree = asJson(input.tree);
    if (input.recordType !== undefined) data.recordType = input.recordType;
    if (input.slug !== undefined) data.slug = input.slug;

    const updated = await tx.builderPage.update({ where: { id }, data });
    return toDto(updated);
  });
}

export async function remove(ctx: ServiceContext, id: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);
    await tx.builderPage.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.page.deleted',
      entityType: 'BuilderPage',
      entityId: id,
      diff: { before: { name: existing.name }, after: null },
    });
  });
}

/** Reorder the catalog. `orderedIds` must be exactly the tenant's page ids. */
export async function reorder(ctx: ServiceContext, rawInput: unknown): Promise<BuilderPageDto[]> {
  const input = ReorderPagesInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const owned = await tx.builderPage.findMany({
      where: { id: { in: input.orderedIds } },
      select: { id: true },
    });
    if (owned.length !== input.orderedIds.length) {
      throw new BuilderNotFoundError('BuilderPage', 'one or more pages');
    }
    // Sequential inside the interactive transaction (no concurrent tx queries).
    for (let i = 0; i < input.orderedIds.length; i += 1) {
      await tx.builderPage.update({ where: { id: input.orderedIds[i] }, data: { position: i } });
    }
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.pages.reordered',
      entityType: 'BuilderPage',
      entityId: null,
      diff: { after: { order: input.orderedIds } },
    });
    const rows = await tx.builderPage.findMany({
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
    return rows.map(toDto);
  });
}

/** Snapshot the draft tree into the published tree. No storefront consumer yet
 *  (docs/41 §1); the publish event is emitted for the future render path. */
export async function publish(ctx: ServiceContext, id: string): Promise<BuilderPageDto> {
  const dto = await withTenant(ctx, async (tx) => {
    const existing = await tx.builderPage.findUnique({ where: { id } });
    if (!existing) throw new BuilderNotFoundError('BuilderPage', id);
    const updated = await tx.builderPage.update({
      where: { id },
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
      action: 'builder.page.published',
      entityType: 'BuilderPage',
      entityId: id,
      diff: { after: { name: updated.name } },
    });
    return toDto(updated);
  });
  await publishBuilderEvent({
    tenantId: ctx.tenantId,
    topic: 'builder.page.published',
    payload: { pageId: dto.id, name: dto.name },
  });
  return dto;
}

/** The storefront read (docs/44 §2.2): the PUBLISHED tree for a page by slug, or
 *  null when no page with that slug has been published. Returns the published
 *  snapshot — never the draft. Tenant-scoped via withTenant (the public route
 *  resolves the tenant by slug first). */
export function getPublishedBySlug(
  ctx: ServiceContext,
  slug: string
): Promise<PublishedPageDto | null> {
  return withTenant(ctx, async (tx) => {
    // slug is unique per tenant; RLS scopes to this tenant. Filter "published"
    // in JS — the JSON column's NULL check needs a Prisma runtime value, but
    // Prisma here is imported as a type only.
    const row = await tx.builderPage.findFirst({ where: { slug } });
    if (row?.publishedTree == null) return null;
    return {
      name: row.name,
      slug: row.slug ?? slug,
      kind: row.kind as BuilderPageKind,
      recordType: row.recordType,
      tree: row.publishedTree as unknown as BuilderNode,
      publishedAt: row.publishedAt ? row.publishedAt.toISOString() : null,
    };
  });
}
