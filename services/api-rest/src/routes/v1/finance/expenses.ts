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
import { ok } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
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
} from '@sparx/finance';
import {
  allocationTargetSchema,
  createExpenseSchema,
  listExpensesSchema,
  paymentMethodSchema,
  updateExpenseSchema,
} from '@sparx/finance/schemas';
import {
  headerPropertyId,
  requireFinanceModule,
  toFinanceContext,
} from '../../../lib/finance-context.js';
import { resolveListScopeIds, resolvePropertyId } from '../../../lib/property.js';

const PathId = z.object({ id: z.string().uuid() });

const ListQuery = listExpensesSchema
  .omit({ propertyId: true })
  .extend({ property: z.string().optional() });

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
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const input = updateExpenseSchema.parse({ ...(request.body as object), id });
    return ok(expenseView(await updateExpense(tenantId, input)));
  });

  app.post('/v1/finance/expenses/:id/paid', async (request) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    const body = PaidBody.parse(request.body);
    await setExpensePaid(tenantId, id, body.paidAt, body.paymentMethod);
    return ok(expenseView(await getExpense(tenantId, id)));
  });

  app.delete('/v1/finance/expenses/:id', async (request, reply) => {
    await requireFinanceModule(request);
    requireRole(request, 'editor');
    const { tenantId } = toFinanceContext(request);
    const { id } = PathId.parse(request.params);
    await deleteExpense(tenantId, id);
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
