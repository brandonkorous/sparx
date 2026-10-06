// taskService — staff tasks (docs/11 §6).
//
// Tasks have three side effects that matter:
//   1. Creating a task drops a "task.created" CrmActivity so the customer/
//      deal timeline shows it.
//   2. Completing a task drops "task.completed" and emits
//      crm.task.completed (Phase 5 reminder worker subscribes).
//   3. Overdue tasks are read by the Phase 5 scheduler — getOverdue() is
//      what that worker calls.

import {
  accountNeedsSetUp,
  CompleteTaskInput,
  CreateTaskInput,
  UpdateTaskInput,
} from '@wizeworks/crm-schemas';
import { afterCommit, withTenant } from '@wizeworks/db';
import type { Prisma, Task, TxClient } from '@wizeworks/db';
import { localCalendarParts, localWallToUtc, nextLocalDay } from '@wizeworks/time';

import { writeAuditLog } from '../audit';
import { publishCrmEvent } from '../events';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError } from '../errors';
import { paymentTermsWords } from './b2b-statement';
import { tierInEffect } from './company-service';

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
  company: { select: { companyName: true } },
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

/** What only the service's own callers may set on a new task. */
export interface CreateTaskOptions {
  /** The order status this task exists to move the order out of. See
   *  `createWhileOrderIs`, the one way in. */
  closesWhenOrderLeaves?: string;
  /** The task exists to get the account set up. See
   *  `createWhileAccountNeedsSetUp`, the one way in. */
  closesWhenAccountSetUp?: boolean;
  /** The deal stage type this task exists for. See `createWhileDealIs`. */
  closesWhenDealLeaves?: string;
  /** The document stage this task exists to move the document out of. See
   *  `createWhileDocumentIsAt`. */
  closesWhenDocumentLeaves?: string;
}

/** The company and the document a task names, read under this tenant's row
 *  security: their foreign keys are checked by the database as its owner, so
 *  another business's id would otherwise link without complaint. */
async function requireLinks(
  tx: TxClient,
  links: { companyId?: string | null; billingDocumentId?: string | null }
): Promise<void> {
  if (links.companyId) {
    const company = await tx.company.findUnique({
      where: { id: links.companyId },
      select: { id: true },
    });
    if (!company) throw new CrmNotFoundError('Company', links.companyId);
  }
  if (links.billingDocumentId) {
    const document = await tx.billingDocument.findUnique({
      where: { id: links.billingDocumentId },
      select: { id: true },
    });
    if (!document) throw new CrmNotFoundError('BillingDocument', links.billingDocumentId);
  }
}

export async function create(
  ctx: ServiceContext,
  rawInput: unknown,
  options: CreateTaskOptions = {}
): Promise<Task> {
  const input = CreateTaskInput.parse(rawInput);
  if (!ctx.userId) {
    // createdBy is NOT NULL — refuse rather than write a system-created task
    // for a path that's supposed to have a logged-in user.
    throw new Error('taskService.create requires ctx.userId');
  }
  const userId = ctx.userId;
  if (options.closesWhenOrderLeaves && !input.orderId) {
    throw new Error(
      'taskService.create: a task that closes when its order moves on needs the order'
    );
  }
  if (options.closesWhenAccountSetUp && !input.companyId) {
    throw new Error('taskService.create: a task that closes when an account is set up needs it');
  }
  if (options.closesWhenDealLeaves && !input.dealId) {
    throw new Error('taskService.create: a task that closes when its deal moves on needs the deal');
  }
  if (options.closesWhenDocumentLeaves && !input.billingDocumentId) {
    throw new Error(
      'taskService.create: a task that closes when its document moves on needs the document'
    );
  }

  const task = await withTenant(ctx, async (tx) => {
    // The order is read under this tenant's row security rather than trusted:
    // a foreign key is checked by the database as its owner, so an order id
    // from another business would otherwise link without complaint. The same
    // goes for the company and the document.
    const order = input.orderId
      ? await tx.order.findUnique({
          where: { id: input.orderId },
          select: { propertyId: true },
        })
      : null;
    if (input.orderId && !order) throw new CrmNotFoundError('Order', input.orderId);
    await requireLinks(tx, { companyId: input.companyId });
    const document = input.billingDocumentId
      ? await tx.billingDocument.findUnique({
          where: { id: input.billingDocumentId },
          select: { propertyId: true },
        })
      : null;
    if (input.billingDocumentId && !document) {
      throw new CrmNotFoundError('BillingDocument', input.billingDocumentId);
    }

    // Derive the task's site (docs/131 §5) from whatever it is about — the deal
    // first (more specific), then the order (where it actually happened), then
    // the document (the site that issued it), else the customer. Read here
    // rather than trusted from input so a task always sits in the same business
    // as its subject; a task about none of them stays null (a general to-do).
    // A company belongs to no one site, so it decides nothing here.
    let propertyId: string | null = null;
    if (input.dealId) {
      const deal = await tx.deal.findUnique({
        where: { id: input.dealId },
        select: { propertyId: true },
      });
      propertyId = deal?.propertyId ?? null;
    } else if (order?.propertyId) {
      propertyId = order.propertyId;
    } else if (document?.propertyId) {
      propertyId = document.propertyId;
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
        orderId: input.orderId ?? null,
        closesWhenOrderLeaves: options.closesWhenOrderLeaves ?? null,
        companyId: input.companyId ?? null,
        closesWhenAccountSetUp: options.closesWhenAccountSetUp ?? false,
        closesWhenDealLeaves: options.closesWhenDealLeaves ?? null,
        billingDocumentId: input.billingDocumentId ?? null,
        closesWhenDocumentLeaves: options.closesWhenDocumentLeaves ?? null,
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
    // Same reason as `create`: the foreign key alone would accept another
    // business's order.
    if (input.orderId) {
      const order = await tx.order.findUnique({
        where: { id: input.orderId },
        select: { id: true },
      });
      if (!order) throw new CrmNotFoundError('Order', input.orderId);
    }
    await requireLinks(tx, {
      companyId: input.companyId,
      billingDocumentId: input.billingDocumentId,
    });

    const data: Prisma.TaskUncheckedUpdateInput = {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
      ...(input.dueAt !== undefined ? { dueAt: input.dueAt ? new Date(input.dueAt) : null } : {}),
      ...(input.priority !== undefined ? { priority: input.priority } : {}),
      ...(input.assignedToUserId !== undefined ? { assignedToUserId: input.assignedToUserId } : {}),
      ...(input.customerId !== undefined ? { customerId: input.customerId } : {}),
      ...(input.dealId !== undefined ? { dealId: input.dealId } : {}),
      ...(input.orderId !== undefined ? { orderId: input.orderId } : {}),
      // What a task waits for belongs to the order it was opened on. Moved to
      // another order (or to none), it is a person's task to close.
      ...(input.orderId !== undefined && input.orderId !== before.orderId
        ? { closesWhenOrderLeaves: null }
        : {}),
      // Same for the account, the deal and the document: what the task waits
      // for belongs to the one it was opened on.
      ...(input.companyId !== undefined ? { companyId: input.companyId } : {}),
      ...(input.companyId !== undefined && input.companyId !== before.companyId
        ? { closesWhenAccountSetUp: false }
        : {}),
      ...(input.dealId !== undefined && input.dealId !== before.dealId
        ? { closesWhenDealLeaves: null }
        : {}),
      ...(input.billingDocumentId !== undefined
        ? { billingDocumentId: input.billingDocumentId }
        : {}),
      ...(input.billingDocumentId !== undefined &&
      input.billingDocumentId !== before.billingDocumentId
        ? { closesWhenDocumentLeaves: null }
        : {}),
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
    // Announced so whatever mirrors a task follows the edit: the search box
    // listed a renamed, reopened or canceled task under its old words and
    // status, because nothing but `create` and "done" ever said a task changed.
    await announceTaskChanged(ctx.tenantId, updated, 'edited');
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

/* ── Tasks that wait on an order ─────────────────────────────────────────── */
//
// A task can exist to move an order out of a status: "Order O-000014 is waiting
// for your sign-off" exists to move it out of `pending_approval`. The account's
// own approver approved O-000014 on the site, the order was placed, and the task
// stayed open, telling the business to do something already done. So the task
// records the order and the status it waits on, and whatever moves the order on
// closes it, in the same transaction, saying who did it.

/**
 * Open a task that closes itself when the order leaves `status`, or open
 * nothing when it already has.
 *
 * The automation that opens it runs after the event that announced the hold,
 * so the order can be decided in between: approved within seconds on the site,
 * say. A task opened then would never be closed, because the decision that
 * closes it has already happened. The order row is locked for the check, so a
 * decision landing at the same moment either waits for this task to exist (and
 * then closes it) or is seen here (and nothing is opened).
 *
 * Returns null when nothing was opened.
 */
export async function createWhileOrderIs(
  ctx: ServiceContext,
  rawInput: unknown,
  status: string
): Promise<Task | null> {
  const input = CreateTaskInput.parse(rawInput);
  if (!input.orderId) {
    throw new Error('taskService.createWhileOrderIs needs the order the task waits on');
  }
  const orderId = input.orderId;
  return withTenant(ctx, async (tx) => {
    // FOR SHARE: blocks a status change until this transaction ends, and waits
    // for one already in flight, reading the row as it committed.
    const rows = await tx.$queryRaw<{ status: string }[]>`
      SELECT status FROM orders WHERE id = ${orderId}::uuid FOR SHARE
    `;
    const current = rows[0];
    if (!current) throw new CrmNotFoundError('Order', orderId);
    if (current.status !== status) return null;
    return create({ ...ctx, tx }, input, { closesWhenOrderLeaves: status });
  });
}

export interface CloseForOrderInput {
  orderId: string;
  /** The status the order has just left. Only tasks waiting on it close. */
  left: string;
  /** `completed` when what the task asked for has been done (the order was
   *  signed off or turned down); `cancelled` when it no longer needs doing
   *  (the order went away some other way). */
  as: 'completed' | 'cancelled';
  /** What happened, in a sentence the person the task was for can read:
   *  "Teodora Vukic-Hale approved it on your site, and the order was placed." */
  because: string;
  /** The teammate who did it, when it was someone on the team. Null when it was
   *  a customer (an approver at the account) or the platform. */
  byUserId?: string | null;
  /** Who acted, for the customer's timeline. Defaults to the teammate when
   *  there is one, else the platform; an approver at the account is a
   *  `customer`. */
  actorType?: 'staff' | 'customer' | 'system';
}

/**
 * Close every open task waiting on this order to leave a status, inside the
 * caller's transaction. Each place that moves an order out of a status calls it
 * with what happened; how the task is closed is `closeTasks`, below.
 */
export async function closeWhenOrderMovesOn(
  tx: TxClient,
  ctx: { tenantId: string },
  input: CloseForOrderInput
): Promise<Task[]> {
  const waiting = await tx.task.findMany({
    where: {
      tenantId: ctx.tenantId,
      orderId: input.orderId,
      closesWhenOrderLeaves: input.left,
      status: 'open',
    },
  });
  return closeTasks(tx, ctx, waiting, input);
}

/**
 * Close the tasks among these whose order is no longer in the status they wait
 * on, for the daily check. The writers above say who did it and how; this runs
 * after the fact and knows only where the order is now, so it says that.
 *
 * Measured on Gillett: three "Order ... is waiting for your sign-off" tasks
 * stayed open after O-000012 and O-000014 were signed off and O-000013 was
 * turned down. They were opened before tasks could name their order, and the
 * daily check knew accounts, deals and documents but not orders.
 */
async function closeWhereOrderHasMovedOn(
  tx: TxClient,
  ctx: { tenantId: string },
  waiting: Task[]
): Promise<Task[]> {
  if (waiting.length === 0) return [];
  const orderIds = [...new Set(waiting.map((t) => t.orderId).filter((id) => id !== null))];
  const orders = await tx.order.findMany({
    where: { tenantId: ctx.tenantId, id: { in: orderIds } },
    select: { id: true, orderNumber: true, status: true },
  });
  const byId = new Map(orders.map((o) => [o.id, o]));
  const closed: Task[] = [];
  for (const task of waiting) {
    const order = task.orderId ? byId.get(task.orderId) : undefined;
    if (!order || order.status === task.closesWhenOrderLeaves) continue;
    closed.push(...(await closeTasks(tx, ctx, [task], orderMovedOn(order, task))));
  }
  return closed;
}

/** What happened to an order since its task opened, read from where it is now. */
function orderMovedOn(
  order: { orderNumber: string; status: string },
  task: Task
): { as: 'completed' | 'cancelled'; because: string } {
  const n = order.orderNumber;
  if (order.status === 'cancelled') {
    return {
      as: 'cancelled',
      because: `Order ${n} was canceled, so there is nothing left to do here.`,
    };
  }
  if (order.status === 'refunded') {
    return {
      as: 'cancelled',
      because: `Order ${n} was refunded in full, so there is nothing left to do here.`,
    };
  }
  if (task.closesWhenOrderLeaves === 'pending_approval') {
    return { as: 'completed', because: `Order ${n} was signed off and placed.` };
  }
  return {
    as: 'completed',
    because: `Order ${n} has moved on: it is ${order.status.replace(/_/g, ' ')} now.`,
  };
}

/** How a task that closed itself was closed, and why. */
interface ClosedBecause {
  as: 'completed' | 'cancelled';
  because: string;
  byUserId?: string | null;
  actorType?: 'staff' | 'customer' | 'system';
}

/**
 * Close tasks whose reason has gone, inside the caller's transaction. The ONE
 * place that knows how a task closes itself, whatever it was waiting on (an
 * order, an account, a deal, a document).
 *
 * The task keeps its own words and gains a line saying why it closed, so a list
 * of done tasks reads as what happened rather than as tasks ticked off by
 * nobody. The customer's timeline and the audit log get the same entry a task
 * closed by hand gets, and `crm.task.completed` is announced after the commit.
 */
async function closeTasks(
  tx: TxClient,
  ctx: { tenantId: string },
  waiting: Task[],
  how: ClosedBecause
): Promise<Task[]> {
  if (waiting.length === 0) return [];
  const now = new Date();
  const byUserId = how.byUserId ?? null;
  const closed: Task[] = [];
  for (const task of waiting) {
    const updated = await tx.task.update({
      where: { id: task.id },
      data: {
        status: how.as,
        // A task closed as `cancelled` was not done by anybody: no "done at".
        completedAt: how.as === 'completed' ? now : null,
        completedByUserId: how.as === 'completed' ? byUserId : null,
        description: task.description ? `${task.description}\n\n${how.because}` : how.because,
      },
    });
    closed.push(updated);

    if (updated.customerId || updated.dealId) {
      await tx.crmActivity.create({
        data: {
          tenantId: ctx.tenantId,
          customerId: updated.customerId,
          dealId: updated.dealId,
          type: how.as === 'completed' ? 'task.completed' : 'task.cancelled',
          description: `Task ${how.as === 'completed' ? 'done' : 'closed'}: ${updated.title}. ${how.because}`,
          actorId: byUserId,
          actorType: how.actorType ?? (byUserId ? 'staff' : 'system'),
          occurredAt: now,
          linkedEntityType: 'Task',
          linkedEntityId: updated.id,
        },
      });
    }

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: byUserId,
      actorType: byUserId ? 'user' : how.actorType === 'customer' ? 'customer' : 'system',
      action: how.as === 'completed' ? 'crm.task.completed' : 'crm.task.updated',
      entityType: 'Task',
      entityId: updated.id,
      diff: {
        before: { status: task.status },
        after: { status: updated.status, because: how.because },
      },
    });

    if (how.as === 'completed') {
      await afterCommit('publish crm.task.completed', () =>
        publishCrmEvent({
          tenantId: ctx.tenantId,
          topic: 'crm.task.completed',
          payload: { taskId: updated.id, completedByUserId: byUserId },
          dedupeKey: `crm.task.completed:${updated.id}`,
        })
      );
    } else {
      // Not done, but no longer open either. Without this the search box went on
      // listing "Order O-000013 ... is waiting for your sign-off" as open after
      // the order was turned down: a canceled task announced nothing at all.
      await announceTaskChanged(ctx.tenantId, updated, 'closed');
    }
  }
  return closed;
}

/**
 * Say a task changed, once it is committed, for whatever mirrors it (the search
 * index, webhooks, automations). "Done" has its own `crm.task.completed`; every
 * other change goes out as `crm.task.updated`, keyed to the moment of the change
 * so a retry of the same write is one event and the next edit is another.
 */
async function announceTaskChanged(
  tenantId: string,
  task: Task,
  reason: 'edited' | 'closed'
): Promise<void> {
  await afterCommit('publish crm.task.updated', () =>
    publishCrmEvent({
      tenantId,
      topic: 'crm.task.updated',
      payload: { taskId: task.id, reason, status: task.status },
      dedupeKey: `crm.task.updated:${task.id}:${task.updatedAt.getTime()}`,
    })
  );
}

/** The teammate's name for a sentence, falling back to their email as the
 *  trail does. Null when nobody on the team did it (the platform did). */
async function teammateName(tx: TxClient, userId: string | null): Promise<string | null> {
  if (!userId) return null;
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });
  const named = user?.name?.trim();
  return named !== undefined && named.length > 0 ? named : (user?.email ?? null);
}

/** "a", "a and b", "a, b, and c". */
function listWords(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? '';
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(', ')}, and ${parts[parts.length - 1]}`;
}

/** Who closed it, for the closing sentence: always a person or the business. */
interface ClosedBy {
  /** The teammate who made the change. Null when the platform noticed it (the
   *  daily check), or the change came from somebody not on the team. */
  byUserId?: string | null;
}

/* ── Tasks that wait on an account being set up ──────────────────────────── */
//
// "Set up prices and terms for Wasatch Front Utility Contractors, LLC" is opened
// by the system automation "New wholesale customer: set-up task" when an account
// is added without them. Wasatch was then put on the Fleet tier with Net 30 and a
// $25,000 limit, and the task stayed open telling the owner to do it. The task
// now records the account and closes itself, done, the moment the account is set
// up by the rule the automation opened it on (`ACCOUNT_SET_UP_TO_DO`).

/**
 * Open a task that closes itself once the account is set up, or open nothing
 * when it already is.
 *
 * The automation runs after the event that announced the new account, so the
 * business can set it up in between. The company row is locked for the check,
 * so a save landing at the same moment either waits for this task to exist (and
 * then closes it) or is seen here (and nothing is opened).
 *
 * Returns null when nothing was opened.
 */
export async function createWhileAccountNeedsSetUp(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<Task | null> {
  const input = CreateTaskInput.parse(rawInput);
  if (!input.companyId) {
    throw new Error('taskService.createWhileAccountNeedsSetUp needs the account it is about');
  }
  const companyId = input.companyId;
  return withTenant(ctx, async (tx) => {
    // FOR SHARE: holds off a save of the account until this transaction ends,
    // and waits for one already in flight, reading the row as it committed.
    const rows = await tx.$queryRaw<{ payment_terms: string | null; credit_limit: number }[]>`
      SELECT payment_terms, credit_limit::float8 AS credit_limit
      FROM companies
      WHERE id = ${companyId}::uuid AND deleted_at IS NULL
      FOR SHARE
    `;
    const account = rows[0];
    if (!account) throw new CrmNotFoundError('Company', companyId);
    if (
      !accountNeedsSetUp({ paymentTerms: account.payment_terms, creditLimit: account.credit_limit })
    ) {
      return null;
    }
    return create({ ...ctx, tx }, input, { closesWhenAccountSetUp: true });
  });
}

/**
 * Close the open set-up tasks on this account once it is set up, inside the
 * caller's transaction. Every write of an account's price tier, terms or credit
 * limit calls it after the write (a guard test holds every writer to that), and
 * so does the daily check for anything written before this existed.
 *
 * Done, with a sentence saying what was set and by whom: "Kim Lee set up
 * Wasatch Front Utility Contractors, LLC: the Fleet price tier, pay within 30
 * days, and a $25,000.00 credit limit." An account that was removed closes its
 * task as no longer needed. An account still short of what the rule asks keeps
 * it open.
 */
export async function closeWhenAccountSetUp(
  tx: TxClient,
  ctx: { tenantId: string },
  input: { companyId: string } & ClosedBy
): Promise<Task[]> {
  const waiting = await tx.task.findMany({
    where: {
      tenantId: ctx.tenantId,
      companyId: input.companyId,
      closesWhenAccountSetUp: true,
      status: 'open',
    },
  });
  if (waiting.length === 0) return [];

  const account = await tx.company.findUnique({
    where: { id: input.companyId },
    select: {
      companyName: true,
      paymentTerms: true,
      creditLimit: true,
      deletedAt: true,
      pricingTierFk: { select: { name: true, deletedAt: true } },
    },
  });
  const byUserId = input.byUserId ?? null;
  const who = await teammateName(tx, byUserId);

  if (account?.deletedAt !== null) {
    const name = account?.companyName ?? 'The account';
    return closeTasks(tx, ctx, waiting, {
      as: 'cancelled',
      because: who
        ? `${who} removed ${name}, so there is nothing left to set up.`
        : `${name} was removed, so there is nothing left to set up.`,
      byUserId,
    });
  }
  if (accountNeedsSetUp(account)) return [];

  const tier = tierInEffect(account.pricingTierFk);
  const terms = paymentTermsWords(account.paymentTerms);
  const limit = Number(account.creditLimit);
  const parts = [
    tier ? `the ${tier.name} price tier` : 'normal prices',
    ...(terms ? [terms.charAt(0).toLowerCase() + terms.slice(1)] : []),
    ...(account.paymentTerms !== 'prepay' && limit > 0
      ? [`a ${await money(tx, limit)} credit limit`]
      : []),
  ];
  return closeTasks(tx, ctx, waiting, {
    as: 'completed',
    because: who
      ? `${who} set up ${account.companyName}: ${listWords(parts)}.`
      : `${account.companyName} is set up: ${listWords(parts)}.`,
    byUserId,
  });
}

/** An amount in the business's own currency, as a person writes it. */
async function money(tx: TxClient, amount: number): Promise<string> {
  const business = await tx.tenantBusiness.findFirst({ select: { defaultCurrency: true } });
  const currency = business?.defaultCurrency ?? 'USD';
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
  } catch {
    // A currency code Intl does not know: still say the number.
    return `${amount.toFixed(2)} ${currency}`;
  }
}

/* ── Tasks that wait on a deal ───────────────────────────────────────────── */
//
// Two system automations open a task about a deal: "Follow up" when a deal is
// opened, and "Create invoice" when it is won. Each is true only while the deal
// stays where it was: a follow-up on a deal already won or lost, or an invoice
// for a deal moved back out of won, asks for nothing. The task records the stage
// TYPE it is about (`closes_when_deal_leaves`), and whatever moves the deal on
// closes it.

/**
 * Open a task that closes itself when the deal leaves a stage type, or open
 * nothing when it already has. The deal and its stage are locked for the check,
 * so a move (or a change to what the stage means) landing at the same moment
 * cannot slip in between.
 */
export async function createWhileDealIs(
  ctx: ServiceContext,
  rawInput: unknown,
  stageType: string
): Promise<Task | null> {
  const input = CreateTaskInput.parse(rawInput);
  if (!input.dealId) {
    throw new Error('taskService.createWhileDealIs needs the deal the task waits on');
  }
  const dealId = input.dealId;
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<{ stage_type: string }[]>`
      SELECT s.stage_type
      FROM deals d
      JOIN pipeline_stages s ON s.id = d.stage_id
      WHERE d.id = ${dealId}::uuid AND d.deleted_at IS NULL
      FOR SHARE
    `;
    const current = rows[0];
    if (!current) throw new CrmNotFoundError('Deal', dealId);
    if (current.stage_type !== stageType) return null;
    return create({ ...ctx, tx }, input, { closesWhenDealLeaves: stageType });
  });
}

/**
 * Close the open tasks on these deals that waited on a stage type the deal is
 * no longer in, inside the caller's transaction. Every move of a deal's stage,
 * every removal of a deal, and every change to what a stage means calls it.
 *
 * Closed as no longer needed, never as done: the platform cannot see that the
 * follow-up call was made, only that the deal moved on, and the sentence says
 * where: "Kim Lee moved the deal “Harbor fit-out” to Closed won, so this no
 * longer needs doing."
 */
export async function closeWhenDealMovesOn(
  tx: TxClient,
  ctx: { tenantId: string },
  input: {
    dealIds: string[];
    /** What happened, when it was not the deal moving: a stage changed to mean
     *  something else. Used for a deal that still exists. */
    because?: string;
  } & ClosedBy
): Promise<Task[]> {
  if (input.dealIds.length === 0) return [];
  const waiting = await tx.task.findMany({
    where: {
      tenantId: ctx.tenantId,
      dealId: { in: input.dealIds },
      closesWhenDealLeaves: { not: null },
      status: 'open',
    },
  });
  if (waiting.length === 0) return [];

  const deals = await tx.deal.findMany({
    where: { id: { in: [...new Set(waiting.map((t) => t.dealId ?? ''))] } },
    select: {
      id: true,
      title: true,
      deletedAt: true,
      stage: { select: { name: true, stageType: true } },
    },
  });
  const byId = new Map(deals.map((d) => [d.id, d]));
  const byUserId = input.byUserId ?? null;
  const who = await teammateName(tx, byUserId);

  const closed: Task[] = [];
  for (const task of waiting) {
    const deal = task.dealId ? byId.get(task.dealId) : undefined;
    const gone = deal?.deletedAt !== null;
    if (!gone && deal.stage.stageType === task.closesWhenDealLeaves) continue;
    const title = deal ? `the deal “${deal.title}”` : 'the deal';
    const because = gone
      ? who
        ? `${who} removed ${title}, so this no longer needs doing.`
        : `${capitalized(title)} was removed, so this no longer needs doing.`
      : (input.because ??
        (who
          ? `${who} moved ${title} to ${deal.stage.name}, so this no longer needs doing.`
          : `${capitalized(title)} is now in ${deal.stage.name}, so this no longer needs doing.`));
    closed.push(...(await closeTasks(tx, ctx, [task], { as: 'cancelled', because, byUserId })));
  }
  return closed;
}

function capitalized(words: string): string {
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/* ── Tasks that wait on a billing document ───────────────────────────────── */
//
// "EST-000123 was approved: take it to the next step" is opened when a document
// reaches an approved stage. It is done once the document is taken on (moved to
// another stage, or turned into an order) and no longer needed once it is voided
// or removed. The task records the document and the stage it waits on.

/**
 * Open a task that closes itself when the document leaves a stage, or open
 * nothing when it already has. The document row is locked for the check.
 */
export async function createWhileDocumentIsAt(
  ctx: ServiceContext,
  rawInput: unknown,
  stageId: string
): Promise<Task | null> {
  const input = CreateTaskInput.parse(rawInput);
  if (!input.billingDocumentId) {
    throw new Error('taskService.createWhileDocumentIsAt needs the document the task waits on');
  }
  const documentId = input.billingDocumentId;
  return withTenant(ctx, async (tx) => {
    const rows = await tx.$queryRaw<{ stage_id: string; settled: boolean }[]>`
      SELECT stage_id::text AS stage_id,
             (voided_at IS NOT NULL OR deleted_at IS NOT NULL OR converted_at IS NOT NULL)
               AS settled
      FROM billing_documents
      WHERE id = ${documentId}::uuid
      FOR SHARE
    `;
    const current = rows[0];
    if (!current) throw new CrmNotFoundError('BillingDocument', documentId);
    if (current.settled || current.stage_id !== stageId) return null;
    return create({ ...ctx, tx }, input, { closesWhenDocumentLeaves: stageId });
  });
}

/**
 * Close the open tasks on this document that waited on a stage it has left, or
 * on a document that was turned into an order, voided or removed, inside the
 * caller's transaction. Every write of a document's stage, and every void,
 * removal and conversion, calls it.
 */
export async function closeWhenDocumentMovesOn(
  tx: TxClient,
  ctx: { tenantId: string },
  input: { documentId: string } & ClosedBy
): Promise<Task[]> {
  const waiting = await tx.task.findMany({
    where: {
      tenantId: ctx.tenantId,
      billingDocumentId: input.documentId,
      closesWhenDocumentLeaves: { not: null },
      status: 'open',
    },
  });
  if (waiting.length === 0) return [];

  const doc = await tx.billingDocument.findUnique({
    where: { id: input.documentId },
    select: {
      number: true,
      stageId: true,
      voidedAt: true,
      deletedAt: true,
      convertedAt: true,
      stage: { select: { name: true, stageType: true } },
      convertedOrder: { select: { orderNumber: true } },
    },
  });
  const byUserId = input.byUserId ?? null;
  const who = await teammateName(tx, byUserId);
  const name = doc?.number ?? 'The document';
  const by = (did: string, was: string): string => (who ? `${who} ${did}` : `${name} was ${was}`);

  const closed: Task[] = [];
  for (const task of waiting) {
    let how: ClosedBecause;
    if (doc?.deletedAt !== null) {
      how = {
        as: 'cancelled',
        because: `${by(`removed ${name}`, 'removed')}, so this no longer needs doing.`,
      };
    } else if (doc.voidedAt !== null || doc.stage.stageType === 'void') {
      how = {
        as: 'cancelled',
        because: `${by(`voided ${name}`, 'voided')}, so this no longer needs doing.`,
      };
    } else if (doc.convertedAt !== null) {
      const order = doc.convertedOrder ? `order ${doc.convertedOrder.orderNumber}` : 'an order';
      how = {
        as: 'completed',
        because: `${by(`turned ${name} into ${order}`, `turned into ${order}`)}.`,
      };
    } else if (doc.stageId !== task.closesWhenDocumentLeaves) {
      how = {
        as: 'completed',
        because: `${by(`moved ${name} to ${doc.stage.name}`, `moved to ${doc.stage.name}`)}.`,
      };
    } else {
      continue;
    }
    closed.push(...(await closeTasks(tx, ctx, [task], { ...how, byUserId })));
  }
  return closed;
}

/* ── The daily check ─────────────────────────────────────────────────────── */

/**
 * Close every open task in this tenant whose reason has already gone, through
 * the same closers the writers call. Run by the daily seed reconcile (and so on
 * every release), it is how a task opened before its link existed, or moved on
 * by something that predates its writer's call, still closes. Returns how many
 * it closed.
 *
 * A task flagged to close itself whose subject was deleted outright (the link
 * was nulled with it) has nothing left to wait for and is closed as such.
 */
export async function closeTasksWhoseReasonIsGone(ctx: { tenantId: string }): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const waiting = await tx.task.findMany({
      where: {
        tenantId: ctx.tenantId,
        status: 'open',
        OR: [
          { closesWhenOrderLeaves: { not: null } },
          { closesWhenAccountSetUp: true },
          { closesWhenDealLeaves: { not: null } },
          { closesWhenDocumentLeaves: { not: null } },
        ],
      },
    });
    if (waiting.length === 0) return 0;

    let closed = 0;
    const onOrders: Task[] = [];
    const companies = new Set<string>();
    const deals = new Set<string>();
    const documents = new Set<string>();
    const orphans: Task[] = [];
    for (const task of waiting) {
      if (task.closesWhenOrderLeaves) {
        if (task.orderId) onOrders.push(task);
        else orphans.push(task);
      } else if (task.closesWhenAccountSetUp) {
        if (task.companyId) companies.add(task.companyId);
        else orphans.push(task);
      } else if (task.closesWhenDealLeaves) {
        if (task.dealId) deals.add(task.dealId);
        else orphans.push(task);
      } else if (task.billingDocumentId) {
        documents.add(task.billingDocumentId);
      } else {
        orphans.push(task);
      }
    }
    closed += (await closeWhereOrderHasMovedOn(tx, ctx, onOrders)).length;
    for (const companyId of companies) {
      closed += (await closeWhenAccountSetUp(tx, ctx, { companyId })).length;
    }
    closed += (await closeWhenDealMovesOn(tx, ctx, { dealIds: [...deals] })).length;
    for (const documentId of documents) {
      closed += (await closeWhenDocumentMovesOn(tx, ctx, { documentId })).length;
    }
    closed += (
      await closeTasks(tx, ctx, orphans, {
        as: 'cancelled',
        because: 'What this was about no longer exists, so this no longer needs doing.',
      })
    ).length;
    return closed;
  });
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
