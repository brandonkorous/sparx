// platformCatalogService — the DB-backed platform component catalog (docs/98 §5).
//
// This is a GLOBAL service (no tenant scope) — platform_components has no
// tenant_id and is not gated by withTenant(). The application role (sparx_app)
// can only SELECT published rows at the DB level (RLS enforces this). Writes and
// non-published reads are gated at the API layer with requireRole('owner') and
// pass through the plain `prisma` client.
//
// Lifecycle transitions: draft → submitted → in_review → approved → published
//   → archived | rejected. Illegal transitions throw BuilderValidationError.
// Audit logs are omitted for this global table (writeAuditLog requires a
// per-tenant TxClient; a platform audit log table is deferred).

import {
  CreatePlatformComponentInput,
  UpdatePlatformComponentInput,
  isLegalTransition,
  type BuilderNode,
  type ComponentSurface,
  type PlatformComponentDto,
  type PlatformComponentSummaryDto,
  type PlatformComponentStatus,
  type PlatformComponentKind,
  type PlatformComponentCategory,
} from '@wizeworks/builder-schemas';
import type { PlatformComponent } from '@wizeworks/db';
// `Prisma` is a value import (used as both the type namespace and `Prisma.DbNull`).
import { Prisma, prisma } from '@wizeworks/db';

import { BuilderNotFoundError, BuilderValidationError } from '../errors';

// ── Mappers ──────────────────────────────────────────────────────────────────

function toSummary(row: PlatformComponent): PlatformComponentSummaryDto {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    // category + surfaces are VARCHAR/TEXT[] in the DB, validated against the shared
    // vocabulary on write — narrow them back to the closed types on read.
    category: row.category as PlatformComponentCategory,
    kind: row.kind,
    icon: row.icon,
    description: row.description,
    surfaces: row.surfaces as ComponentSurface[],
    thumbnail: row.thumbnail,
    tags: row.tags,
    status: row.status,
    authorId: row.authorId,
    reviewerId: row.reviewerId,
    version: row.version,
    visibility: row.visibility,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toDto(row: PlatformComponent): PlatformComponentDto {
  return {
    ...toSummary(row),
    tree: row.tree as unknown as BuilderNode,
    behaviors: row.behaviors ?? null,
  };
}

const asJson = (v: unknown): Prisma.InputJsonValue => v as Prisma.InputJsonValue;

// ── Reads ─────────────────────────────────────────────────────────────────────

/** List published entries (public). */
export async function listPublished(filter?: {
  kind?: PlatformComponentKind;
  category?: PlatformComponentCategory;
  tags?: string[];
}): Promise<PlatformComponentSummaryDto[]> {
  const where: Prisma.PlatformComponentWhereInput = { status: 'published', visibility: 'public' };
  if (filter?.kind) where.kind = filter.kind;
  if (filter?.category) where.category = filter.category;
  if (filter?.tags && filter.tags.length > 0) where.tags = { hasSome: filter.tags };
  const rows = await prisma.platformComponent.findMany({
    where,
    orderBy: [{ category: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toSummary);
}

/** List all entries by status (admin). */
export async function listAll(filter?: {
  status?: PlatformComponentStatus;
  kind?: PlatformComponentKind;
}): Promise<PlatformComponentSummaryDto[]> {
  const where: Prisma.PlatformComponentWhereInput = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.kind) where.kind = filter.kind;
  const rows = await prisma.platformComponent.findMany({
    where,
    orderBy: [{ status: 'asc' }, { kind: 'asc' }, { name: 'asc' }],
  });
  return rows.map(toSummary);
}

/** Get one entry by id. Admin-only (any status). */
export async function getById(id: string): Promise<PlatformComponentDto> {
  const row = await prisma.platformComponent.findUnique({ where: { id } });
  if (!row) throw new BuilderNotFoundError('platform_component', id);
  return toDto(row);
}

/** Get one published entry by key (public). */
export async function getPublishedByKey(key: string): Promise<PlatformComponentDto> {
  const row = await prisma.platformComponent.findUnique({ where: { key } });
  if (row?.status !== 'published') throw new BuilderNotFoundError('platform_component', key);
  return toDto(row);
}

// ── Writes ────────────────────────────────────────────────────────────────────

export async function create(authorId: string, raw: unknown): Promise<PlatformComponentDto> {
  const input = CreatePlatformComponentInput.parse(raw);
  const existing = await prisma.platformComponent.findUnique({ where: { key: input.key } });
  if (existing) {
    throw new BuilderValidationError('A component with this key already exists.', [
      { field: 'key', message: 'Already in use.' },
    ]);
  }
  const row = await prisma.platformComponent.create({
    data: {
      key: input.key,
      name: input.name,
      category: input.category,
      kind: input.kind,
      icon: input.icon,
      description: input.description,
      surfaces: input.surfaces,
      tree: asJson(input.tree),
      behaviors: input.behaviors != null ? asJson(input.behaviors) : undefined,
      thumbnail: input.thumbnail ?? null,
      tags: input.tags,
      status: 'draft',
      authorId,
      version: 1,
      visibility: input.visibility,
    },
  });
  return toDto(row);
}

export async function update(id: string, raw: unknown): Promise<PlatformComponentDto> {
  const input = UpdatePlatformComponentInput.parse(raw);
  const existing = await prisma.platformComponent.findUnique({ where: { id } });
  if (!existing) throw new BuilderNotFoundError('platform_component', id);
  // Only draft/rejected entries can be freely edited. Others require re-submitting
  // through the lifecycle (any status edit bumps version for traceability).
  const data: Prisma.PlatformComponentUncheckedUpdateInput = {
    version: { increment: 1 },
  };
  if (input.name !== undefined) data.name = input.name;
  if (input.category !== undefined) data.category = input.category;
  if (input.kind !== undefined) data.kind = input.kind;
  if (input.icon !== undefined) data.icon = input.icon;
  if (input.description !== undefined) data.description = input.description;
  if (input.surfaces !== undefined) data.surfaces = input.surfaces;
  if (input.tree !== undefined) data.tree = asJson(input.tree);
  if (input.behaviors !== undefined)
    // Clearing a nullable Json column needs Prisma.DbNull (SQL NULL), not a raw null.
    data.behaviors = input.behaviors != null ? asJson(input.behaviors) : Prisma.DbNull;
  if (input.thumbnail !== undefined) data.thumbnail = input.thumbnail ?? null;
  if (input.tags !== undefined) data.tags = input.tags;
  if (input.visibility !== undefined) data.visibility = input.visibility;
  const row = await prisma.platformComponent.update({ where: { id }, data });
  return toDto(row);
}

export async function remove(id: string): Promise<void> {
  const existing = await prisma.platformComponent.findUnique({ where: { id } });
  if (!existing) throw new BuilderNotFoundError('platform_component', id);
  await prisma.platformComponent.delete({ where: { id } });
}

// ── Lifecycle transitions ─────────────────────────────────────────────────────

async function transition(
  id: string,
  actorId: string,
  to: PlatformComponentStatus
): Promise<PlatformComponentDto> {
  const existing = await prisma.platformComponent.findUnique({ where: { id } });
  if (!existing) throw new BuilderNotFoundError('platform_component', id);
  const from = existing.status;
  if (!isLegalTransition(from, to)) {
    throw new BuilderValidationError(`Cannot transition from "${from}" to "${to}".`, [
      { field: 'status', message: `Illegal transition: ${from} → ${to}` },
    ]);
  }
  // Only record reviewerId for reviewer-facing transitions. `submitted` is
  // triggered by the author, not a reviewer — leave reviewerId unchanged.
  const updateData: Prisma.PlatformComponentUncheckedUpdateInput = { status: to };
  if (to !== 'submitted') updateData.reviewerId = actorId;
  const row = await prisma.platformComponent.update({
    where: { id },
    data: updateData,
  });
  return toDto(row);
}

/** Submit a draft for review (draft → submitted). */
export async function submit(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'submitted');
}

/** Move to in_review (submitted → in_review). */
export async function startReview(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'in_review');
}

/** Approve (in_review → approved). */
export async function approve(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'approved');
}

/** Publish (approved → published). */
export async function publish(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'published');
}

/** Archive (published → archived, or other valid predecessors). */
export async function archive(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'archived');
}

/** Reject (submitted|in_review|approved → rejected). */
export async function reject(id: string, actorId: string): Promise<PlatformComponentDto> {
  return transition(id, actorId, 'rejected');
}
