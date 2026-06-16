// archetypeService — brand-governed section archetypes (docs/61 §6 Phase 6b).
//
// An archetype is a curated section/layout STARTING POINT a user stamps onto a
// page. Stamping forks a COPY of `tree` (fresh ids) into the page — not a live
// reference — so an archetype is a single mutable row: NO versioning and NO
// where-used guard (nothing references it after the drop), unlike a tenant
// component. Platform defaults are seeded lazily from PLATFORM_ARCHETYPES on a
// tenant's first list; the brand-designer then curates the set (enable/disable,
// edit, delete) and adds their own.
//
// Tenant-scoped via withTenant() (FORCE RLS). One service, many transports.

import {
  CreateArchetypeInput,
  UpdateArchetypeInput,
  PLATFORM_ARCHETYPES,
  type ArchetypeDto,
  type ArchetypeSummaryDto,
  type ArchetypeSource,
  type BuilderNode,
  type ComponentSurface,
} from '@sparx/builder-schemas';
import type { BuilderArchetype, Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { BuilderNotFoundError, BuilderValidationError } from '../errors';

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

function surfacesOf(row: BuilderArchetype): ComponentSurface[] {
  const s = row.surfaces as unknown;
  return Array.isArray(s) && s.length > 0 ? (s as ComponentSurface[]) : ['page'];
}

function toSummary(row: BuilderArchetype): ArchetypeSummaryDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    family: row.family,
    icon: row.icon,
    description: row.description,
    surfaces: surfacesOf(row),
    source: row.source as ArchetypeSource,
    enabled: row.enabled,
    thumbnail: row.thumbnail,
    position: row.position,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDto(row: BuilderArchetype): ArchetypeDto {
  return { ...toSummary(row), tree: row.tree as unknown as BuilderNode };
}

const ORDER: Prisma.BuilderArchetypeOrderByWithRelationInput[] = [
  { family: 'asc' },
  { position: 'asc' },
  { name: 'asc' },
];

/** Seed the platform default archetypes the first time a tenant lists — the
 *  count-zero idiom (cf. pageService.listOrSeed). Idempotent via @@unique(tenant,
 *  key): a re-seed never duplicates, and it HEALS existing tenants with no
 *  migration backfill. Runs inside the caller's tx. */
async function seedIfEmpty(tx: Prisma.TransactionClient, ctx: ServiceContext): Promise<void> {
  // The platform library is the catalog now (docs/98 §5) — PLATFORM_ARCHETYPES is
  // empty, so platform seeding is a no-op. Bail before any query/audit write.
  if (PLATFORM_ARCHETYPES.length === 0) return;
  const platformCount = await tx.builderArchetype.count({ where: { source: 'platform' } });
  if (platformCount > 0) return;
  await tx.builderArchetype.createMany({
    data: PLATFORM_ARCHETYPES.map((a, i) => ({
      tenantId: ctx.tenantId,
      key: a.key,
      name: a.name,
      family: a.family,
      icon: a.icon,
      description: a.description,
      surfaces: asJson(a.surfaces),
      tree: asJson(a.tree),
      source: 'platform',
      enabled: true,
      position: i,
    })),
    skipDuplicates: true,
  });
  await writeAuditLog({
    tx,
    tenantId: ctx.tenantId,
    actorId: ctx.userId ?? null,
    actorType: 'system',
    action: 'builder.archetypes.seeded',
    entityType: 'builder_archetype',
    entityId: null,
    diff: { after: { count: PLATFORM_ARCHETYPES.length } },
  });
}

/** The whole catalog (summaries, no tree), seeding platform defaults on first call. */
export async function listOrSeed(ctx: ServiceContext): Promise<ArchetypeSummaryDto[]> {
  return withTenant(ctx, async (tx) => {
    await seedIfEmpty(tx, ctx);
    const rows = await tx.builderArchetype.findMany({ orderBy: ORDER });
    return rows.map(toSummary);
  });
}

/** The ENABLED archetypes WITH their trees — what the Add palette stamps. Seeds on
 *  first call (so opening the palette triggers the seed), then filters. */
export async function listForPalette(ctx: ServiceContext): Promise<ArchetypeDto[]> {
  return withTenant(ctx, async (tx) => {
    await seedIfEmpty(tx, ctx);
    const rows = await tx.builderArchetype.findMany({ where: { enabled: true }, orderBy: ORDER });
    return rows.map(toDto);
  });
}

export async function get(ctx: ServiceContext, key: string): Promise<ArchetypeDto> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.builderArchetype.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    });
    if (!row) throw new BuilderNotFoundError('archetype', key);
    return toDto(row);
  });
}

export async function create(ctx: ServiceContext, raw: unknown): Promise<ArchetypeDto> {
  const input = CreateArchetypeInput.parse(raw);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderArchetype.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key: input.key } },
    });
    if (existing) {
      throw new BuilderValidationError('An archetype with this key already exists.', [
        { field: 'key', message: 'Already in use.' },
      ]);
    }
    const maxPos = await tx.builderArchetype.aggregate({ _max: { position: true } });
    const row = await tx.builderArchetype.create({
      data: {
        tenantId: ctx.tenantId,
        key: input.key,
        name: input.name,
        family: input.family,
        icon: input.icon,
        description: input.description ?? null,
        surfaces: asJson(input.surfaces),
        tree: asJson(input.tree),
        source: 'tenant',
        enabled: true,
        thumbnail: input.thumbnail ?? null,
        position: (maxPos._max.position ?? -1) + 1,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.archetype.created',
      entityType: 'builder_archetype',
      entityId: row.id,
      diff: { after: { key: row.key, name: row.name } },
    });
    return toDto(row);
  });
}

/** Patch an archetype in place — identity + tree, no version row (the no-versioning
 *  decision: nothing references it, so a stamped copy is unaffected by later edits). */
export async function update(
  ctx: ServiceContext,
  key: string,
  raw: unknown
): Promise<ArchetypeDto> {
  const input = UpdateArchetypeInput.parse(raw);
  return withTenant(ctx, async (tx) => {
    const existing = await tx.builderArchetype.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    });
    if (!existing) throw new BuilderNotFoundError('archetype', key);
    const data: Prisma.BuilderArchetypeUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.family !== undefined) data.family = input.family;
    if (input.icon !== undefined) data.icon = input.icon;
    if (input.description !== undefined) data.description = input.description ?? null;
    if (input.surfaces !== undefined) data.surfaces = asJson(input.surfaces);
    if (input.tree !== undefined) data.tree = asJson(input.tree);
    if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail ?? null;
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.position !== undefined) data.position = input.position;
    const row = await tx.builderArchetype.update({ where: { id: existing.id }, data });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.archetype.updated',
      entityType: 'builder_archetype',
      entityId: row.id,
      diff: { after: { key } },
    });
    return toDto(row);
  });
}

/** Hard-delete an archetype. No where-used guard — stamping forks a copy, so
 *  nothing in any page references the archetype. */
export async function remove(ctx: ServiceContext, key: string): Promise<void> {
  await withTenant(ctx, async (tx) => {
    const existing = await tx.builderArchetype.findUnique({
      where: { tenantId_key: { tenantId: ctx.tenantId, key } },
    });
    if (!existing) throw new BuilderNotFoundError('archetype', key);
    await tx.builderArchetype.delete({ where: { id: existing.id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'user',
      action: 'builder.archetype.deleted',
      entityType: 'builder_archetype',
      entityId: existing.id,
      diff: { before: { key } },
    });
  });
}
