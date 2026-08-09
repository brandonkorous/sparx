// The built-in reports (docs/144 §8) — seeded per tenant on CRM activation.
//
// These are WORKED EXAMPLES, not fixtures. Each one answers a question a
// business actually asks, and each is expressible in the builder's own
// vocabulary — so opening one shows a person exactly which choices produce that
// answer, and duplicating it gives them a working report to change one thing on.
// An empty canvas plus a field picker teaches nobody anything.
//
// They are deliberately NOT the seven hand-written reports in
// `reporting-service.ts`. Those stay exactly as they are — they involve joins
// and window functions the compiler has no business growing (§8: the compiler
// reports over ONE object, on purpose). What ships here is the subset that is
// honestly expressible, which is what makes them truthful as examples: every
// one of them is something a tenant could have built themselves.

import { withTenant } from '@sparx/db';
import type { Prisma } from '@sparx/db';

import type { ServiceContext } from '../errors';

interface BuiltinReport {
  slug: string;
  name: string;
  description: string;
  objectKey: string;
  filters: unknown;
  groupBy: unknown;
  measures: unknown;
  visualization: string;
  dateRange: unknown;
}

const NO_FILTER = { logic: 'AND', conditions: [] };

export const BUILTIN_REPORTS: BuiltinReport[] = [
  {
    slug: 'deals-by-stage',
    name: 'Deals by stage',
    description:
      'How many open deals are sitting at each step of your process, and what they are worth. The classic “where is everything?” view.',
    objectKey: 'deal',
    filters: NO_FILTER,
    groupBy: { field: 'stageId' },
    measures: [
      { fn: 'count', label: 'Deals' },
      { fn: 'sum', field: 'value', label: 'Total value' },
    ],
    visualization: 'table',
    dateRange: { kind: 'all' },
  },
  {
    slug: 'deals-won-by-month',
    name: 'Deals won each month',
    description:
      'Closed-won value month by month over the last year — whether you are growing, and by how much.',
    objectKey: 'deal',
    filters: { logic: 'AND', conditions: [{ field: 'closedAt', operator: 'is_set' }] },
    groupBy: { field: 'closedAt', bucket: 'month' },
    measures: [{ fn: 'sum', field: 'value', label: 'Value won' }],
    visualization: 'line',
    dateRange: { kind: 'last_n_days', days: 365 },
  },
  {
    slug: 'new-customers-by-month',
    name: 'New customers each month',
    description: 'How many people joined your list each month over the last year.',
    objectKey: 'contact',
    filters: NO_FILTER,
    groupBy: { field: 'createdAt', bucket: 'month' },
    measures: [{ fn: 'count', label: 'New customers' }],
    visualization: 'bar',
    dateRange: { kind: 'last_n_days', days: 365 },
  },
  {
    slug: 'customers-by-stage',
    name: 'Customers by stage',
    description:
      'Everyone on your list grouped by where they have got to — leads, customers, the ones who went quiet.',
    objectKey: 'contact',
    filters: NO_FILTER,
    groupBy: { field: 'lifecycleStage' },
    measures: [{ fn: 'count', label: 'Customers' }],
    visualization: 'pie',
    dateRange: { kind: 'all' },
  },
  {
    slug: 'spend-by-company',
    name: 'Spend by company',
    description:
      'Lifetime spend added up by the company people work for — where your money actually comes from.',
    objectKey: 'contact',
    filters: { logic: 'AND', conditions: [{ field: 'company', operator: 'is_set' }] },
    groupBy: { field: 'company' },
    measures: [
      { fn: 'sum', field: 'totalSpent', label: 'Lifetime spend' },
      { fn: 'count', label: 'Customers' },
    ],
    visualization: 'table',
    dateRange: { kind: 'all' },
  },
  {
    slug: 'requests-by-urgency',
    name: 'Requests by urgency',
    description:
      'Open support requests grouped by how urgent they are — what your team should pick up first.',
    objectKey: 'ticket',
    filters: { logic: 'AND', conditions: [{ field: 'resolvedAt', operator: 'is_not_set' }] },
    groupBy: { field: 'priority' },
    measures: [{ fn: 'count', label: 'Open requests' }],
    visualization: 'bar',
    dateRange: { kind: 'all' },
  },
  {
    slug: 'requests-opened-by-week',
    name: 'Requests opened each week',
    description:
      'How much is coming in, week by week, over the last quarter — whether your support load is growing.',
    objectKey: 'ticket',
    filters: NO_FILTER,
    groupBy: { field: 'createdAt', bucket: 'week' },
    measures: [{ fn: 'count', label: 'Requests' }],
    visualization: 'line',
    dateRange: { kind: 'last_n_days', days: 90 },
  },
  {
    slug: 'open-tasks-by-owner',
    name: 'Open tasks by owner',
    description: 'Who is carrying what. Unfinished tasks grouped by the person they belong to.',
    objectKey: 'task',
    filters: { logic: 'AND', conditions: [{ field: 'completedAt', operator: 'is_not_set' }] },
    groupBy: { field: 'assignedToUserId' },
    measures: [{ fn: 'count', label: 'Open tasks' }],
    visualization: 'table',
    dateRange: { kind: 'all' },
  },
];

/**
 * Install the built-ins for a tenant. Idempotent, keyed on
 * (tenant, property, builtinSlug) by a partial unique index, so it is safe on
 * every activation pass and on a re-run of the daily reconcile.
 *
 * Existing rows are left ALONE rather than upserted: a tenant may have shared
 * one with their team or hung it on a dashboard, and re-writing the definition
 * under them would be sparx quietly editing their board.
 */
export async function seedBuiltinReports(ctx: ServiceContext): Promise<number> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.crmReport.findMany({
      where: { builtinSlug: { not: null }, propertyId: null },
      select: { builtinSlug: true },
    });
    const have = new Set(existing.map((r) => r.builtinSlug));
    const missing = BUILTIN_REPORTS.filter((r) => !have.has(r.slug));
    if (missing.length === 0) return 0;

    await tx.crmReport.createMany({
      data: missing.map((r) => ({
        tenantId: ctx.tenantId,
        propertyId: null,
        name: r.name,
        description: r.description,
        objectKey: r.objectKey,
        filters: r.filters as Prisma.InputJsonValue,
        groupBy: r.groupBy as Prisma.InputJsonValue,
        measures: r.measures as Prisma.InputJsonValue,
        visualization: r.visualization,
        dateRange: r.dateRange as Prisma.InputJsonValue,
        builtinSlug: r.slug,
        // Owned by nobody and visible to everyone: these are the business's
        // reports, not the first admin's.
        ownerId: null,
        shared: true,
      })),
      skipDuplicates: true,
    });
    return missing.length;
  });
}
