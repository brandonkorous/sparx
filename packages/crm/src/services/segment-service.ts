// segmentService — segment CRUD + membership reads.
//
// Phase 1 ships the CRUD shape and the membership read; the Pub/Sub
// evaluator that populates segment_members and the previewCount /
// recomputeFull paths land in Phase 4 (locked decision #4: incremental
// materialization). Until then, the only writes to segment_members come
// from external callers / tests. Keeping the read API stable now means
// the dashboard "members" UI and email broadcast targeting can be built
// before the evaluator exists.

import { CreateSegmentInput, UpdateSegmentInput } from '@sparx/crm-schemas';
import { BUILT_IN_SEGMENT_TEMPLATES } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Customer, Prisma, Segment, SegmentMember } from '@sparx/db';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

export async function list(
  ctx: ServiceContext,
  args: { q?: string; includeArchived?: boolean; take?: number; skip?: number } = {}
): Promise<{ items: Segment[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.SegmentWhereInput = {
      ...(args.includeArchived ? {} : { archivedAt: null }),
      ...(args.q
        ? {
            OR: [
              { name: { contains: args.q, mode: 'insensitive' } },
              { description: { contains: args.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.segment.findMany({
        where,
        orderBy: [{ isBuiltIn: 'desc' }, { name: 'asc' }],
        take: Math.min(args.take ?? 50, 250),
        skip: args.skip ?? 0,
      }),
      tx.segment.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, segmentId: string): Promise<Segment> {
  const segment = await withTenant(ctx, (tx) =>
    tx.segment.findUnique({ where: { id: segmentId } })
  );
  if (!segment) throw new CrmNotFoundError('Segment', segmentId);
  return segment;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Segment> {
  const input = CreateSegmentInput.parse(rawInput);

  const segment = await withTenant(ctx, async (tx) => {
    const created = await tx.segment.create({
      data: {
        tenantId: ctx.tenantId,
        // The site this audience draws from (docs/131 §5); undefined leaves it
        // tenant-wide. The route defaults it to the site being worked in, so a
        // segment authored while looking at one business targets that business.
        propertyId: input.propertyId ?? null,
        name: input.name,
        slug: input.slug,
        description: input.description ?? null,
        rules: input.rules,
        color: input.color ?? null,
        isSystem: false,
        isBuiltIn: false,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.segment.created',
      entityType: 'Segment',
      entityId: created.id,
      diff: { after: { slug: created.slug, name: created.name } },
    });
    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.segment.created',
    payload: { segmentId: segment.id, slug: segment.slug },
    dedupeKey: `crm.segment.created:${segment.id}`,
  });

  return segment;
}

export async function update(
  ctx: ServiceContext,
  segmentId: string,
  rawInput: unknown
): Promise<Segment> {
  const input = UpdateSegmentInput.parse(rawInput);

  const result = await withTenant(ctx, async (tx) => {
    const before = await tx.segment.findUnique({ where: { id: segmentId } });
    if (!before) throw new CrmNotFoundError('Segment', segmentId);
    const updated = await tx.segment.update({
      where: { id: segmentId },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.slug !== undefined ? { slug: input.slug } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.rules !== undefined ? { rules: input.rules } : {}),
        ...(input.color !== undefined ? { color: input.color } : {}),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.segment.updated',
      entityType: 'Segment',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });

  // If rules changed, downstream evaluators (Phase 4) need to recompute
  // membership. The event carries that signal; the evaluator subscribes.
  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.segment.updated',
    payload: {
      segmentId: result.id,
      rulesChanged: input.rules !== undefined,
    },
    dedupeKey: `crm.segment.updated:${result.id}:${result.updatedAt.toISOString()}`,
  });

  return result;
}

export async function archive(ctx: ServiceContext, segmentId: string): Promise<Segment> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.segment.findUnique({ where: { id: segmentId } });
    if (!before) throw new CrmNotFoundError('Segment', segmentId);
    const updated = await tx.segment.update({
      where: { id: segmentId },
      data: { archivedAt: new Date() },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.segment.archived',
      entityType: 'Segment',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

/** Members materialized into segment_members by the Phase 4 evaluator.
 *  Pre-Phase-4 this returns whatever's been written manually (typically
 *  zero rows) — the read shape is stable so dashboard / email-broadcast
 *  targeting can join against it today. */
export async function members(
  ctx: ServiceContext,
  segmentId: string,
  args: { limit?: number; offset?: number } = {}
): Promise<(SegmentMember & { customer: Customer })[]> {
  return withTenant(ctx, (tx) =>
    tx.segmentMember.findMany({
      where: { segmentId },
      include: { customer: true },
      orderBy: { enteredAt: 'desc' },
      take: Math.min(args.limit ?? 100, 1000),
      skip: args.offset ?? 0,
    })
  );
}

/** Count of members. */
export async function memberCount(ctx: ServiceContext, segmentId: string): Promise<number> {
  return withTenant(ctx, (tx) => tx.segmentMember.count({ where: { segmentId } }));
}

// previewCount + recomputeFull are non-trivial enough to live in their own
// file (see ./segment-evaluation.ts for the math). Re-exported here so the
// segmentService namespace looks complete to callers.
export { previewCount, recomputeFull } from './segment-evaluation';

// ─────────────────────────────────────────────────────────────────────────
// Bootstrap — seed BUILT_IN_SEGMENT_TEMPLATES for a tenant.
// Called on `module.activated` for crm. Idempotent — checks per-slug, so
// a second call (or a later template addition) is a safe additive op.
// ─────────────────────────────────────────────────────────────────────────

export async function bootstrapBuiltInSegments(ctx: ServiceContext): Promise<Segment[]> {
  return withTenant(ctx, async (tx) => {
    const seeded: Segment[] = [];
    for (const t of BUILT_IN_SEGMENT_TEMPLATES) {
      // Built-in segments are TENANT-WIDE (property_id null) — "Newsletter
      // Subscribers" spans every business. findFirst, not findUnique: the unique
      // is now (tenant, property, slug) NULLS NOT DISTINCT, and Prisma cannot
      // reach a null-property row through a compound-unique key.
      const existing = await tx.segment.findFirst({
        where: { propertyId: null, slug: t.slug },
      });
      if (existing) {
        seeded.push(existing);
        continue;
      }
      const created = await tx.segment.create({
        data: {
          tenantId: ctx.tenantId,
          propertyId: null,
          name: t.name,
          slug: t.slug,
          description: t.description,
          color: t.color,
          rules: t.rules,
          isSystem: true,
          isBuiltIn: true,
        },
      });
      await writeAuditLog({
        tx,
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        actorType: 'system',
        action: 'crm.segment.bootstrapped',
        entityType: 'Segment',
        entityId: created.id,
        diff: { after: { slug: created.slug } },
      });
      seeded.push(created);
    }
    return seeded;
  });
}

// Ensure ONE built-in segment exists for a tenant (idempotent, slug-keyed).
// Unlike bootstrapBuiltInSegments (which seeds the full set on CRM activation),
// this guarantees a single template is present on demand — used by the
// storefront signup path so a tenant that activated CRM before a new built-in
// (e.g. Newsletter Subscribers) landed still gets its target segment materialized
// the first time someone subscribes. Returns the existing or newly-created row.
export async function ensureBuiltInSegment(ctx: ServiceContext, slug: string): Promise<Segment> {
  const template = BUILT_IN_SEGMENT_TEMPLATES.find((t) => t.slug === slug);
  if (!template) throw new Error(`Unknown built-in segment template: ${slug}`);
  return withTenant(ctx, async (tx) => {
    // Tenant-wide built-in — findFirst on the null-property row (see the note in
    // bootstrapBuiltInSegments).
    const existing = await tx.segment.findFirst({
      where: { propertyId: null, slug },
    });
    if (existing) return existing;
    const created = await tx.segment.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: null,
        name: template.name,
        slug: template.slug,
        description: template.description,
        color: template.color,
        rules: template.rules,
        isSystem: true,
        isBuiltIn: true,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: 'system',
      action: 'crm.segment.bootstrapped',
      entityType: 'Segment',
      entityId: created.id,
      diff: { after: { slug: created.slug } },
    });
    return created;
  });
}
