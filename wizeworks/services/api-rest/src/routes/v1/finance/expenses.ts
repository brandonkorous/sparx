// Spend — the expense ledger (docs/148 §3).
//
//   GET    /v1/finance/expenses          → page of spend + the filter's total
//   POST   /v1/finance/expenses          → record spend
//   GET    /v1/finance/expenses/:id      → one, with allocations + receipts
//   PATCH  /v1/finance/expenses/:id      → correct it
//   POST   /v1/finance/expenses/:id/paid → mark paid / unpaid (the inline action)
//   DELETE /v1/finance/expenses/:id      → soft-delete
//   GET    /v1/finance/jobs              → jobs ranked by what each one made
//   GET    /v1/finance/jobs/:type/:id    → everything charged to one job
//
// `property` follows the platform list-scope convention: absent ⇒ the active site,
// `all` ⇒ every site this member may reach. Spend belongs to a BUSINESS, so the
// default is deliberately narrow.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ok } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import {
  createExpense,
  deleteExpense,
  expensesForTarget,
  getExpense,
  jobProfitability,
  listExpenses,
  setExpensePaid,
  updateExpense,
  type ExpenseWithDetail,
  type JobType,
} from '@wizeworks/finance';
import {
  allocationTargetSchema,
  createExpenseSchema,
  listExpensesSchema,
  paymentMethodSchema,
  updateExpenseSchema,
} from '@wizeworks/finance/schemas';
import {
  headerPropertyId,
  requireFinanceModule,
  toFinanceContext,
} from '../../../lib/finance-context.js';
import { queryBool, queryInt } from '@wizeworks/api-core/query';
import { resolveListScopeIds, resolvePropertyId } from '../../../lib/property.js';
import { publishDomainEvent } from '../../../lib/staff-events.js';

const PathId = z.object({ id: z.string().uuid() });

/**
 * Tell the finance worker that one day's profit went stale.
 *
 * `wizeworks/packages/finance-worker` has handled `finance.expense.recorded` since the
 * module shipped and **nothing published it**, so `rollup_finance_daily_profit`
 * — the table `profitForRange` reads — was only ever written by the manual
 * recompute button. Every expense recorded, corrected or deleted left the
 * Profit surface showing a figure that predated it.
 *
 * Best-effort by construction (the publisher swallows transport errors), which
 * is the right trade here: a broker hiccup must not fail the request that
 * recorded a cost, and the nightly `profit-rollup` cron re-derives the window
 * regardless. The event makes it immediate; the cron makes it certain.
 */
async function announceExpenseDay(
  tenantId: string,
  actorId: string | null,
  incurredAt: Date
): Promise<void> {
  await publishDomainEvent('finance.expense.recorded', tenantId, actorId, {
    incurredAt: incurredAt.toISOString(),
  });
}

// `limit` and `unpaidOnly` are RE-DECLARED for the query string. The service
// contract spells them as a real int and a real boolean, which is right for the
// service and wrong here: everything in `request.query` is a string, so a bare
// `z.int()` rejects "50" and answers 422. The `.default(50)` made that invisible
// — omitting the parameter passed, sending it never worked — and the workbench
// always sends it, so Spending was broken for every tenant from launch.
const ListQuery = listExpensesSchema.omit({ propertyId: true }).extend({
  property: z.string().optional(),
  limit: queryInt.min(1).max(200).default(50),
  unpaidOnly: queryBool.nullish(),
});

const PaidBody = z.object({
  paidAt: z.coerce.date().nullable(),
  paymentMethod: paymentMethodSchema.nullish(),
});

const JobParams = z.object({ type: allocationTargetSchema, id: z.string().uuid() });

const JobsQuery = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
  property: z.string().optional(),
  // Worst-first: the losing jobs are the ones a decision can still be made about.
  sort: z.enum(['margin_asc', 'margin_desc', 'revenue_desc', 'recent']).default('margin_asc'),
  types: z
    .string()
    .optional()
    .transform((value) =>
      value
        ? (value.split(',').filter((t) => t === 'order' || t === 'booking') as JobType[])
        : undefined
    ),
  limit: z.coerce.number().int().min(1).max(250).default(100),
});

/** The wire shape. Money stays in CENTS across the API — a float here is how a
 *  rounding error reaches a ledger. The client formats. */
function expenseView(row: ExpenseWithDetail) {
  const allocatedCents = row.allocations.reduce((sum, a) => sum + a.amountCents, 0);
  return {
    id: row.id,
    propertyId: row.propertyId,
    description: row.description,
    amountCents: row.amountCents,
    currency: row.currency,
    taxCents: row.taxCents,
    incurredAt: row.incurredAt,
    paidAt: row.paidAt,
    dueAt: row.dueAt,
    paymentMethod: row.paymentMethod,
    reference: row.reference,
    notes: row.notes,
    source: row.source,
    // Derived rows are corrected at their source, not here — the surface reads
    // this to decide whether the form is editable at all.
    editable: row.source === 'manual' || row.source === 'imported',
    exportedAt: row.exportedAt,
    externalRef: row.externalRef,
    category: row.category
      ? {
          id: row.category.id,
          name: row.category.name,
          kind: row.category.kind,
          color: row.category.color,
        }
      : null,
    vendor: row.vendor ? { id: row.vendor.id, name: row.vendor.name } : null,
    allocations: row.allocations.map((a) => ({
      id: a.id,
      targetType: a.targetType,
      targetId: a.targetId,
      targetLabel: a.targetLabel,
      amountCents: a.amountCents,
    })),
    allocatedCents,
    // What is left on the business rather than a job. Sent rather than derived
    // client-side so every surface agrees on what "overhead" means.
    unallocatedCents: row.amountCents - allocatedCents,
    attachments: row.attachments.map((a) => ({
      id: a.id,
      assetId: a.assetId,
      // `key` is the storage path; the client resolves it through the same media
      // URL helper every other attachment surface uses, so a receipt is served
      // exactly like any other asset rather than through a finance-only route.
      key: a.asset?.key ?? null,
      filename: a.asset?.originalFilename ?? null,
    })),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; route registration is sync.
const financeExpenseRoutes: FastifyPluginAsync = async (app) => {
  app.get('/v1/finance/expenses', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { property, ...filters } = ListQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      property,
      request.headers['x-sparx-property-id']
    );
    // `resolveListScopeIds` returns the reachable set; the service takes one site
    // or none, so a single-site scope narrows and a wider one reads them all.
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;
    const page = await listExpenses(tenantId, { ...filters, propertyId });
    return ok({
      items: page.items.map(expenseView),
      nextCursor: page.nextCursor,
      totalCents: page.totalCents,
    });
  });

  app.post('/v1/finance/expenses', async (request, reply) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const input = createExpenseSchema.parse(request.body);
    const propertyId =
      input.propertyId ?? (await resolvePropertyId(auth, headerPropertyId(request)));
    const row = await createExpense(tenantId, { ...input, propertyId });
    await announceExpenseDay(tenantId, auth.actorId, row.incurredAt);
    return reply.code(201).send(ok(expenseView(row)));
  });

  app.get('/v1/finance/expenses/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    return ok(expenseView(await getExpense(tenantId, id)));
  });

  app.patch('/v1/finance/expenses/:id', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const input = updateExpenseSchema.parse({ ...(request.body as object), id });

    // Read the day it was on BEFORE the edit. A correction is allowed to move
    // `incurredAt`, and moving it makes TWO days stale — the one it left and
    // the one it arrived on. Announcing only the new day leaves the old day's
    // profit carrying a cost that is no longer there.
    const before = await getExpense(tenantId, id);
    const row = await updateExpense(tenantId, input);

    await announceExpenseDay(tenantId, auth.actorId, row.incurredAt);
    if (before.incurredAt.getTime() !== row.incurredAt.getTime()) {
      await announceExpenseDay(tenantId, auth.actorId, before.incurredAt);
    }
    return ok(expenseView(row));
  });

  app.post('/v1/finance/expenses/:id/paid', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const body = PaidBody.parse(request.body);
    await setExpensePaid(tenantId, id, body.paidAt, body.paymentMethod);
    // No recompute, and that is the two-date rule rather than an omission:
    // profit buckets on `incurredAt`, so when the money actually LEFT changes
    // nothing about which period the cost belongs to (docs/148 §1, decision #6).
    return ok(expenseView(await getExpense(tenantId, id)));
  });

  app.delete('/v1/finance/expenses/:id', async (request, reply) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    // Its day has to be read before the row goes, or there is nothing left to
    // say which bucket just lost a cost.
    const before = await getExpense(tenantId, id);
    await deleteExpense(tenantId, id);
    await announceExpenseDay(tenantId, auth.actorId, before.incurredAt);
    return reply.code(204).send();
  });

  // The ranking. Registered BEFORE `/jobs/:type/:id` is irrelevant to Fastify's
  // radix router (a static segment always beats a parameter), but the two are
  // kept adjacent so nobody later adds a `/jobs/summary` and wonders why it 404s
  // as an unparseable allocation target.
  app.get('/v1/finance/jobs', async (request) => {
    await requireFinanceModule(request);
    const auth = requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const query = JobsQuery.parse(request.query);
    const propertyIds = await resolveListScopeIds(
      auth,
      query.property,
      request.headers['x-sparx-property-id']
    );
    const propertyId = propertyIds?.length === 1 ? propertyIds[0] : null;
    const jobs = await jobProfitability(tenantId, {
      from: query.from,
      to: query.to,
      propertyId,
      types: query.types,
      sort: query.sort,
      limit: query.limit,
    });
    return ok({ jobs });
  });

  // Everything charged to one job — the cost half of job profitability. Reached
  // from an order or booking pane, which is where the question is actually asked.
  app.get('/v1/finance/jobs/:type/:id', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'viewer');
    const { tenantId } = toFinanceContext(request);
    const { type, id } = JobParams.parse(request.params);
    const result = await expensesForTarget(tenantId, type, id);
    return ok({
      allocatedCents: result.allocatedCents,
      expenses: result.expenses.map(expenseView),
    });
  });
};

export default financeExpenseRoutes;
