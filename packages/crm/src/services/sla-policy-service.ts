// slaPolicyService — what a business promised, and when it is open to keep it
// (docs/144 §7.3).
//
// The policy is CONFIGURATION; `sla-clock.ts` is the arithmetic and knows
// nothing about the database. This file is the join between them: it reads and
// writes the rows, and hands the clock a plain shape.
//
// A policy is resolved onto a ticket ONCE, at creation, and the resulting
// instants are stored on the ticket. Editing a policy therefore changes what is
// promised from here on and leaves what was already promised alone — which is
// the only version a business can defend to a customer.

import { CreateSlaPolicyInput, UpdateSlaPolicyInput } from '@sparx/crm-schemas';
import { DEFAULT_SLA_POLICY_TEMPLATE } from '@sparx/crm-schemas/builtins';
import { withTenant } from '@sparx/db';
import type { Prisma, TicketSlaPolicy, TicketSlaTarget } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmConflictError, CrmNotFoundError } from '../errors';
import type { BusinessHourWindow, SlaPolicyShape } from './sla-clock';

export type SlaPolicyWithTargets = TicketSlaPolicy & { targets: TicketSlaTarget[] };

const policyInclude = {
  targets: { orderBy: { priority: 'asc' } },
} satisfies Prisma.TicketSlaPolicyInclude;

// ─────────────────────────────────────────────────────────────────────────
// Row ⇄ clock shape
// ─────────────────────────────────────────────────────────────────────────

/**
 * The stored weekly pattern, defensively.
 *
 * `business_hours` is JSONB, so the database will hold whatever was written to
 * it — including by a future migration or a hand-run fix. A malformed entry is
 * DROPPED rather than thrown on: a policy with one bad row should degrade to
 * the hours it can read, not make every ticket in the tenant fail to open.
 */
function parseWindows(value: unknown): BusinessHourWindow[] {
  if (!Array.isArray(value)) return [];
  const out: BusinessHourWindow[] = [];
  for (const entry of value) {
    if (typeof entry !== 'object' || entry === null) continue;
    const row = entry as Record<string, unknown>;
    const day = row.day;
    const startMinute = row.startMinute;
    const endMinute = row.endMinute;
    if (typeof day !== 'number' || typeof startMinute !== 'number' || typeof endMinute !== 'number')
      continue;
    if (day < 0 || day > 6 || endMinute <= startMinute) continue;
    out.push({ day, startMinute, endMinute });
  }
  return out;
}

/** `@db.Date` comes back as UTC midnight; the local date is its UTC calendar
 *  day, which is exactly what the clock compares against. */
function toDateKeys(holidays: Date[]): string[] {
  return holidays.map((d) => d.toISOString().slice(0, 10));
}

function toDateRows(holidays: string[]): Date[] {
  return holidays.map((s) => new Date(`${s}T00:00:00.000Z`));
}

/** Flatten a stored policy into the plain shape `sla-clock` works on. */
export function toClockShape(policy: SlaPolicyWithTargets): SlaPolicyShape {
  return {
    timezone: policy.timezone,
    windows: parseWindows(policy.businessHours),
    holidays: toDateKeys(policy.holidays),
    warnAtPercent: policy.warnAtPercent,
    targets: policy.targets.map((t) => ({
      priority: t.priority,
      firstResponseMinutes: t.firstResponseMinutes,
      resolutionMinutes: t.resolutionMinutes,
    })),
  };
}

// ─────────────────────────────────────────────────────────────────────────
// Reads
// ─────────────────────────────────────────────────────────────────────────

export async function list(
  ctx: ServiceContext,
  args: { includeArchived?: boolean; propertyIds?: string[] } = {}
): Promise<{ items: SlaPolicyWithTargets[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.TicketSlaPolicyWhereInput = {
      ...(args.includeArchived ? {} : { archivedAt: null }),
      ...(args.propertyIds
        ? { OR: [{ propertyId: { in: args.propertyIds } }, { propertyId: null }] }
        : {}),
    };
    const [items, total] = await Promise.all([
      tx.ticketSlaPolicy.findMany({
        where,
        include: policyInclude,
        orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
      }),
      tx.ticketSlaPolicy.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, policyId: string): Promise<SlaPolicyWithTargets> {
  const policy = await withTenant(ctx, (tx) =>
    tx.ticketSlaPolicy.findUnique({ where: { id: policyId }, include: policyInclude })
  );
  if (!policy) throw new CrmNotFoundError('TicketSlaPolicy', policyId);
  return policy;
}

/**
 * Which promise applies to a new request.
 *
 * Resolution order, most specific first: the policy the caller named → the
 * site's own default → the tenant-wide default → none at all. "None" is a real
 * answer and not a failure: a business that has not set up a support promise
 * still gets to file requests, they simply are not measured.
 *
 * Takes a transaction client so a ticket write can resolve the policy inside
 * the same transaction that creates the row.
 */
export async function resolveForTicket(
  tx: Prisma.TransactionClient,
  args: { policyId?: string | null; propertyId: string | null }
): Promise<SlaPolicyWithTargets | null> {
  if (args.policyId) {
    const named = await tx.ticketSlaPolicy.findUnique({
      where: { id: args.policyId },
      include: policyInclude,
    });
    if (!named) throw new CrmNotFoundError('TicketSlaPolicy', args.policyId);
    return named;
  }

  if (args.propertyId) {
    const forSite = await tx.ticketSlaPolicy.findFirst({
      where: { propertyId: args.propertyId, isDefault: true, archivedAt: null },
      include: policyInclude,
    });
    if (forSite) return forSite;
  }

  return tx.ticketSlaPolicy.findFirst({
    where: { propertyId: null, isDefault: true, archivedAt: null },
    include: policyInclude,
  });
}

// ─────────────────────────────────────────────────────────────────────────
// Writes
// ─────────────────────────────────────────────────────────────────────────

/**
 * Only one policy per site may be the default.
 *
 * A partial unique index enforces it in the database, so this exists to make
 * promoting a new default WORK rather than fail: without demoting the incumbent
 * first, every "make this the default" would come back as a constraint
 * violation the person has no way to act on.
 */
async function demoteOtherDefaults(
  tx: Prisma.TransactionClient,
  args: { tenantId: string; propertyId: string | null; exceptId?: string }
): Promise<void> {
  await tx.ticketSlaPolicy.updateMany({
    where: {
      tenantId: args.tenantId,
      propertyId: args.propertyId,
      isDefault: true,
      ...(args.exceptId ? { id: { not: args.exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

/** Replace a policy's targets as a SET. A priority absent from the list has no
 *  promise attached to it, which is why this deletes rather than merges — a
 *  merge would make "we no longer promise anything on low priority"
 *  inexpressible. */
async function writeTargets(
  tx: Prisma.TransactionClient,
  args: {
    tenantId: string;
    policyId: string;
    targets: {
      priority: string;
      firstResponseMinutes?: number | null;
      resolutionMinutes?: number | null;
    }[];
  }
): Promise<void> {
  await tx.ticketSlaTarget.deleteMany({ where: { policyId: args.policyId } });
  if (args.targets.length === 0) return;
  await tx.ticketSlaTarget.createMany({
    data: args.targets.map((t) => ({
      tenantId: args.tenantId,
      policyId: args.policyId,
      priority: t.priority,
      firstResponseMinutes: t.firstResponseMinutes ?? null,
      resolutionMinutes: t.resolutionMinutes ?? null,
    })),
  });
}

export async function create(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<SlaPolicyWithTargets> {
  const input = CreateSlaPolicyInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const propertyId = input.propertyId ?? null;
    if (input.isDefault) await demoteOtherDefaults(tx, { tenantId: ctx.tenantId, propertyId });

    const created = await tx.ticketSlaPolicy.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault,
        timezone: input.timezone,
        businessHours: input.businessHours,
        holidays: toDateRows(input.holidays),
        warnAtPercent: input.warnAtPercent,
      },
    });
    await writeTargets(tx, {
      tenantId: ctx.tenantId,
      policyId: created.id,
      targets: input.targets,
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.sla_policy.created',
      entityType: 'TicketSlaPolicy',
      entityId: created.id,
      diff: { after: { name: created.name, isDefault: created.isDefault } },
    });

    const withTargets = await tx.ticketSlaPolicy.findUnique({
      where: { id: created.id },
      include: policyInclude,
    });
    if (!withTargets) throw new CrmNotFoundError('TicketSlaPolicy', created.id);
    return withTargets;
  });
}

export async function update(
  ctx: ServiceContext,
  policyId: string,
  rawInput: unknown
): Promise<SlaPolicyWithTargets> {
  const input = UpdateSlaPolicyInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.ticketSlaPolicy.findUnique({ where: { id: policyId } });
    if (!before) throw new CrmNotFoundError('TicketSlaPolicy', policyId);

    // Demote against the site the policy is MOVING to when the patch repoints
    // it, and against the one it already has otherwise.
    const propertyId = input.propertyId !== undefined ? input.propertyId : before.propertyId;
    if (input.isDefault === true) {
      await demoteOtherDefaults(tx, {
        tenantId: ctx.tenantId,
        propertyId: propertyId ?? null,
        exceptId: policyId,
      });
    }

    const updated = await tx.ticketSlaPolicy.update({
      where: { id: policyId },
      data: {
        ...(input.propertyId !== undefined ? { propertyId: input.propertyId } : {}),
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.isDefault !== undefined ? { isDefault: input.isDefault } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
        ...(input.businessHours !== undefined ? { businessHours: input.businessHours } : {}),
        ...(input.holidays !== undefined ? { holidays: toDateRows(input.holidays) } : {}),
        ...(input.warnAtPercent !== undefined ? { warnAtPercent: input.warnAtPercent } : {}),
      },
    });

    if (input.targets !== undefined) {
      await writeTargets(tx, { tenantId: ctx.tenantId, policyId, targets: input.targets });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.sla_policy.updated',
      entityType: 'TicketSlaPolicy',
      entityId: updated.id,
      diff: null,
    });

    const withTargets = await tx.ticketSlaPolicy.findUnique({
      where: { id: policyId },
      include: policyInclude,
    });
    if (!withTargets) throw new CrmNotFoundError('TicketSlaPolicy', policyId);
    return withTargets;
  });
}

/**
 * Archive rather than delete.
 *
 * Tickets keep pointing at the policy they were measured against — the FK is
 * SET NULL, so a hard delete would erase the answer to "what did we promise on
 * this one?" for every request already filed under it.
 *
 * Refused while it is the only default for its site, because the next request
 * would then silently arrive with no promise attached. Naming a replacement is
 * the caller's job, and saying so is more useful than quietly doing it.
 */
export async function archive(
  ctx: ServiceContext,
  policyId: string
): Promise<SlaPolicyWithTargets> {
  return withTenant(ctx, async (tx) => {
    const before = await tx.ticketSlaPolicy.findUnique({ where: { id: policyId } });
    if (!before) throw new CrmNotFoundError('TicketSlaPolicy', policyId);

    if (before.isDefault) {
      const siblings = await tx.ticketSlaPolicy.count({
        where: {
          propertyId: before.propertyId,
          archivedAt: null,
          id: { not: policyId },
        },
      });
      if (siblings === 0) {
        throw new CrmConflictError(
          'This is the only support promise for this site. Create another one before archiving it, or new requests will arrive with no response target.',
          'policyId'
        );
      }
    }

    await tx.ticketSlaPolicy.update({
      where: { id: policyId },
      data: { archivedAt: new Date(), isDefault: false },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.sla_policy.archived',
      entityType: 'TicketSlaPolicy',
      entityId: policyId,
      diff: { before: { name: before.name } },
    });

    const archived = await tx.ticketSlaPolicy.findUnique({
      where: { id: policyId },
      include: policyInclude,
    });
    if (!archived) throw new CrmNotFoundError('TicketSlaPolicy', policyId);
    return archived;
  });
}

/**
 * The starter promise, applied the first time a tenant uses the service
 * surface. Idempotent — a re-run on a tenant that already has one is a no-op,
 * because this also runs from the `module.activated` consumer.
 *
 * `timezone` is passed in rather than defaulted here: the caller knows the
 * site's zone, and a promise measured in a zone the business does not work in
 * is wrong by hours in both directions.
 */
export async function bootstrapDefaultPolicy(
  ctx: ServiceContext,
  args: { timezone?: string } = {}
): Promise<SlaPolicyWithTargets> {
  return withTenant(ctx, (tx) => ensureDefaultPolicy(tx, ctx.tenantId, args.timezone));
}

/**
 * The transaction-scoped half of the above, so the FIRST ticket a tenant ever
 * files can set the support surface up inside the same transaction that creates
 * it. Without that, the first request would arrive with no promise attached and
 * be the one ticket in the tenant's history nobody was measured on.
 */
export async function ensureDefaultPolicy(
  tx: Prisma.TransactionClient,
  tenantId: string,
  timezone?: string
): Promise<SlaPolicyWithTargets> {
  const existing = await tx.ticketSlaPolicy.findFirst({
    where: { propertyId: null, archivedAt: null },
    include: policyInclude,
  });
  if (existing) return existing;

  const template = DEFAULT_SLA_POLICY_TEMPLATE;
  const created = await tx.ticketSlaPolicy.create({
    data: {
      tenantId,
      propertyId: null,
      name: template.name,
      description: template.description,
      isDefault: true,
      timezone: timezone ?? template.timezone,
      businessHours: template.businessHours,
      holidays: [],
      warnAtPercent: template.warnAtPercent,
    },
  });
  await writeTargets(tx, { tenantId, policyId: created.id, targets: template.targets });

  await writeAuditLog({
    tx,
    tenantId,
    actorId: null,
    actorType: 'system',
    action: 'crm.sla_policy.bootstrapped',
    entityType: 'TicketSlaPolicy',
    entityId: created.id,
    diff: { after: { name: created.name } },
  });

  const withTargets = await tx.ticketSlaPolicy.findUnique({
    where: { id: created.id },
    include: policyInclude,
  });
  if (!withTargets) throw new CrmNotFoundError('TicketSlaPolicy', created.id);
  return withTargets;
}
