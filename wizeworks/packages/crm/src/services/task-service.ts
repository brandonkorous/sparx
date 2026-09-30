// taskService — staff tasks (docs/11 §6).
//
// Tasks have three side effects that matter:
//   1. Creating a task drops a "task.created" CrmActivity so the customer/
//      deal timeline shows it.
//   2. Completing a task drops "task.completed" and emits
//      crm.task.completed (Phase 5 reminder worker subscribes).
//   3. Overdue tasks are read by the Phase 5 scheduler — getOverdue() is
//      what that worker calls.

import { CompleteTaskInput, CreateTaskInput, UpdateTaskInput } from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { Prisma, Task } from '@wizeworks/db';
import { localCalendarParts, localWallToUtc, nextLocalDay } from '@wizeworks/time';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';

/* ── When a task is DUE ─────────────────────────────────────────────────── */

/**
 * The moment a task set "N days from now" is actually late.
 *
 * A deadline on a to-do list is a DAY. "Get to it today" means by the end of
 * today, and "by tomorrow" means by the end of tomorrow - it does not mean the
 * same minute of the clock that some event happened to fire on.
 *
 * Both automation call sites did `Date.now() + days * 86_400_000`, which gives
 * neither. With `dueInDays: 0` - the value the config schema DEFAULTS to - the
 * deadline is the instant of creation, so the task appeared on her list wearing
 * a red "Overdue" badge before anybody could have read it. Measured on the
 * development database: two of Devi's three tasks were created and due within
 * SEVEN MILLISECONDS of each other. With `dueInDays: 1` it is no better, just
 * quieter: a quote approved at 2am makes a task that turns red at 2am, hours
 * before the shop opens.
 *
 * In the BUSINESS's zone, like every other deadline the platform states. The
 * SLA clock had already learned this and says why: "a promise bootstrapped in
 * UTC quietly counts those hours somewhere else - for a shop in Denver every
 * deadline lands six hours early, and the first anyone hears of it is a request
 * that went red overnight."
 */
export function dueAtForDays(dueInDays: number, timeZone: string, now = new Date()): Date {
  let day = localCalendarParts(now.getTime(), timeZone);
  for (let i = 0; i < Math.max(0, Math.trunc(dueInDays)); i += 1) day = nextLocalDay(day);
  // The end of a day is the start of the next one, a millisecond earlier. Going
  // through `localWallToUtc` rather than adding hours is what keeps the day a
  // DST change falls on 23 or 25 hours long instead of always 24.
  const after = nextLocalDay(day);
  return new Date(localWallToUtc(after.year, after.month1, after.day, 0, timeZone) - 1);
}

/** The business's own zone, or UTC while nobody has said. The same read
 *  `ticket-service` makes for an SLA deadline. */
export async function businessTimeZone(ctx: ServiceContext): Promise<string> {
  return withTenant(ctx, async (tx) => {
    const business = await tx.tenantBusiness.findFirst({ select: { timezone: true } });
    return business?.timezone ?? 'UTC';
  });
}

/** `dueAtForDays` with the zone looked up. What an automation calls. */
export async function dueAtIn(ctx: ServiceContext, dueInDays: number): Promise<Date> {
  return dueAtForDays(dueInDays, await businessTimeZone(ctx));
}

export interface ListTasksFilter {
  q?: string;
  assignedToUserId?: string;
  customerId?: string;
  dealId?: string;
  /** The sites this member may reach (docs/131 §3.3); undefined = unrestricted.
   *  Restricted members see their businesses' tasks plus tenant-wide ones. */
  propertyIds?: string[];
  status?: 'open' | 'completed' | 'cancelled';
  dueBefore?: Date;
  take?: number;
  skip?: number;
}

// The subject a task is "about", pulled alongside so a list can name it without
// a per-row fetch. Only the identity fields a caller renders — additive, so a
// consumer that ignores them is unaffected.
const taskSubjectInclude = {
  customer: { select: { firstName: true, lastName: true, companyName: true, email: true } },
  deal: { select: { title: true } },
} satisfies Prisma.TaskInclude;

export async function list(
  ctx: ServiceContext,
  filter: ListTasksFilter = {}
): Promise<{ items: Task[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where: Prisma.TaskWhereInput = {
      ...(filter.propertyIds
        ? { OR: [{ propertyId: { in: filter.propertyIds } }, { propertyId: null }] }
        : {}),
      ...(filter.q ? { title: { contains: filter.q, mode: 'insensitive' } } : {}),
      ...(filter.assignedToUserId ? { assignedToUserId: filter.assignedToUserId } : {}),
      ...(filter.customerId ? { customerId: filter.customerId } : {}),
      ...(filter.dealId ? { dealId: filter.dealId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
      ...(filter.dueBefore ? { dueAt: { lte: filter.dueBefore } } : {}),
    };
    const [items, total] = await Promise.all([
      tx.task.findMany({
        where,
        include: taskSubjectInclude,
        orderBy: [{ status: 'asc' }, { dueAt: 'asc' }],
        take: Math.min(filter.take ?? 50, 250),
        skip: filter.skip ?? 0,
      }),
      tx.task.count({ where }),
    ]);
    return { items, total };
  });
}

export async function get(ctx: ServiceContext, taskId: string): Promise<Task> {
  const task = await withTenant(ctx, (tx) =>
    tx.task.findUnique({ where: { id: taskId }, include: taskSubjectInclude })
  );
  if (!task) throw new CrmNotFoundError('Task', taskId);
  return task;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<Task> {
  const input = CreateTaskInput.parse(rawInput);
  if (!ctx.userId) {
    // createdBy is NOT NULL — refuse rather than write a system-created task
    // for a path that's supposed to have a logged-in user.
    throw new Error('taskService.create requires ctx.userId');
  }
  const userId = ctx.userId;

  const task = await withTenant(ctx, async (tx) => {
    // Derive the task's site (docs/131 §5) from whatever it is about — the deal
    // first (more specific), else the customer. Read here rather than trusted
    // from input so a task always sits in the same business as its subject; a
    // task about neither stays null (a general to-do).
    let propertyId: string | null = null;
    if (input.dealId) {
      const deal = await tx.deal.findUnique({
        where: { id: input.dealId },
        select: { propertyId: true },
      });
      propertyId = deal?.propertyId ?? null;
    } else if (input.customerId) {
      const customer = await tx.customer.findUnique({
        where: { id: input.customerId },
        select: { propertyId: true },
      });
      propertyId = customer?.propertyId ?? null;
    }

    const created = await tx.task.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId,
        title: input.title,
        description: input.description ?? null,
        dueAt: input.dueAt ? new Date(input.dueAt) : null,
        priority: input.priority,
        assignedToUserId: input.assignedToUserId,
        createdByUserId: userId,
        customerId: input.customerId ?? null,
        dealId: input.dealId ?? null,
      },
    });

    // Timeline entry. Anchored to whichever entity the task is scoped to.
    if (created.customerId || created.dealId) {
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: created.customerId,
          dealId: created.dealId,
          type: 'task.created',
          description: `Task created: ${created.title}`,
          actorId: userId,
          actorType: 'staff',
          occurredAt: created.createdAt,
          linkedEntityType: 'Task',
          linkedEntityId: created.id,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'crm.task.created',
      entityType: 'Task',
      entityId: created.id,
      diff: {
        after: {
          title: created.title,
          assignedToUserId: created.assignedToUserId,
          dueAt: created.dueAt?.toISOString() ?? null,
        },
      },
    });

    return created;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.task.created',
    payload: {
      taskId: task.id,
      assignedToUserId: task.assignedToUserId,
      dueAt: task.dueAt?.toISOString() ?? null,
    },
    dedupeKey: `crm.task.created:${task.id}`,
  });

  return task;
}

export async function update(
  ctx: ServiceContext,
  taskId: string,
  rawInput: unknown
): Promise<Task> {
  const input = UpdateTaskInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    const before = await tx.task.findUnique({ where: { id: taskId } });
    if (!before) throw new CrmNotFoundError('Task', taskId);

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignedToUserId !== undefined ? { assignedToUserId: input.assignedToUserId } : {}),
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.dealId !== undefined ? { dealId: input.dealId } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
    };

    const updated = await tx.task.update({ where: { id: taskId }, data });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.task.updated',
      entityType: 'Task',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });
}

export async function complete(ctx: ServiceContext, rawInput: unknown): Promise<Task> {
  const { taskId } = CompleteTaskInput.parse(rawInput);
  if (!ctx.userId) {
    throw new Error('taskService.complete requires ctx.userId');
  }
  const userId = ctx.userId;

  const task = await withTenant(ctx, async (tx) => {
    const before = await tx.task.findUnique({ where: { id: taskId } });
    if (!before) throw new CrmNotFoundError('Task', taskId);
    if (before.status === 'completed') return before; // idempotent

    const updated = await tx.task.update({
      where: { id: taskId },
      data: {
        status: 'completed',
        completedAt: new Date(),
        completedByUserId: userId,
      },
    });

    if (updated.customerId || updated.dealId) {
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: updated.customerId,
          dealId: updated.dealId,
          type: 'task.completed',
          description: `Task completed: ${updated.title}`,
          actorId: userId,
          actorType: 'staff',
          occurredAt: updated.completedAt ?? new Date(),
          linkedEntityType: 'Task',
          linkedEntityId: updated.id,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: userId,
      actorType: 'user',
      action: 'crm.task.completed',
      entityType: 'Task',
      entityId: updated.id,
      diff: null,
    });
    return updated;
  });

  await publishCrmEvent({
    tenantId: ctx.tenantId,
    topic: 'crm.task.completed',
    payload: { taskId: task.id, completedByUserId: userId },
    dedupeKey: `crm.task.completed:${task.id}`,
  });

  return task;
}

/** Tasks past their due date for the supplied user (or every user if
 *  omitted). The Phase 5 overdue-reminder worker calls this. */
export async function getOverdue(
  ctx: ServiceContext,
  args: { q?: string; userId?: string } = {}
): Promise<Task[]> {
  return withTenant(ctx, (tx) =>
    tx.task.findMany({
      where: {
        status: 'open',
        dueAt: { lt: new Date() },
        ...(args.userId ? { assignedToUserId: args.userId } : {}),
        ...(args.q ? { title: { contains: args.q, mode: 'insensitive' } } : {}),
      },
      orderBy: { dueAt: 'asc' },
    })
  );
}

/** Tasks due today for the supplied user — drives the "Today's Tasks"
 *  dashboard widget. */
export async function getTodayForUser(
  ctx: ServiceContext,
  args: { userId: string }
): Promise<Task[]> {
  // In the BUSINESS's zone. `new Date().setHours(0,0,0,0)` is midnight where the
  // SERVER happens to stand, which in production is UTC: for a shop in Denver
  // "today" then began at 6pm yesterday and ends at 6pm today, so an evening
  // task drops out of Today while she is still working.
  const zone = await businessTimeZone(ctx);
  const today = localCalendarParts(Date.now(), zone);
  const startOfDay = new Date(localWallToUtc(today.year, today.month1, today.day, 0, zone));
  const endOfDay = dueAtForDays(0, zone);
  return withTenant(ctx, (tx) =>
    tx.task.findMany({
      where: {
        assignedToUserId: args.userId,
        status: 'open',
        OR: [
          { dueAt: { gte: startOfDay, lte: endOfDay } },
          { dueAt: { lt: startOfDay } }, // overdue still surfaces in "Today"
        ],
      },
      orderBy: [{ dueAt: 'asc' }, { priority: 'desc' }],
    })
  );
}
