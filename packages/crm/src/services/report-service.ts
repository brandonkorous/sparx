// reportService — saved report definitions (docs/144 §8).
//
// CRUD over a definition, plus the two operations that make a builder learnable:
// `run` (see it now) and `duplicate` (start from one that already works).
//
// THE BUILT-INS ARE SEEDED, NOT SPECIAL. The seven reports sparx wrote exist as
// real rows in every tenant, carrying a `builtinSlug`. That means a business
// owner can open "Deals by stage", see exactly how it was built, duplicate it and
// change one thing — which is how a non-technical person actually learns a
// builder, as opposed to being shown an empty canvas and a field picker. They
// are read-only IN PLACE (editing the shipped one would make "what sparx sends"
// mean something different per tenant); the duplicate is theirs entirely.

import {
  CreateReportInput,
  RunReportQuery,
  UpdateReportInput,
  type DateRange,
  type GroupBy,
  type Measure,
} from '@sparx/crm-schemas';
import type { ConditionGroup } from '@sparx/automation-schemas';
import { withTenant } from '@sparx/db';
import type { CrmReport, Prisma } from '@sparx/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { runReport, type ReportDefinition, type ReportResult } from './report-compiler';

/** Prisma stores these as `Json`; the shapes are guaranteed by zod on write, so
 *  reads assert rather than re-parse — a re-parse here would turn a schema
 *  change into a read error on rows that are already fine. */
function toDefinition(row: CrmReport): ReportDefinition {
  return {
    objectKey: row.objectKey,
    filters: row.filters as unknown as ConditionGroup,
    groupBy: (row.groupBy ?? null) as unknown as GroupBy | null,
    measures: row.measures as unknown as Measure[],
    dateRange: row.dateRange as unknown as DateRange,
    propertyId: row.propertyId,
  };
}

export async function list(
  ctx: ServiceContext,
  args: { propertyIds?: string[] | null; objectKey?: string } = {}
): Promise<CrmReport[]> {
  return withTenant(ctx, (tx) =>
    tx.crmReport.findMany({
      where: {
        archivedAt: null,
        ...(args.objectKey ? { objectKey: args.objectKey } : {}),
        // Site read-scoping (docs/131 §3.3): a member granted one business sees
        // that business's reports plus the tenant-wide ones.
        ...(args.propertyIds
          ? { OR: [{ propertyId: null }, { propertyId: { in: args.propertyIds } }] }
          : {}),
      },
      orderBy: [{ builtinSlug: 'asc' }, { name: 'asc' }],
    })
  );
}

export async function get(ctx: ServiceContext, id: string): Promise<CrmReport> {
  const row = await withTenant(ctx, (tx) => tx.crmReport.findFirst({ where: { id } }));
  if (!row || row.archivedAt) throw new CrmNotFoundError('Report', id);
  return row;
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmReport> {
  const input = CreateReportInput.parse(rawInput);

  const created = await withTenant(ctx, async (tx) => {
    const row = await tx.crmReport.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        name: input.name,
        description: input.description ?? null,
        objectKey: input.objectKey,
        filters: input.filters as Prisma.InputJsonValue,
        groupBy: (input.groupBy ?? null) as Prisma.InputJsonValue,
        measures: input.measures,
        visualization: input.visualization,
        dateRange: input.dateRange,
        ownerId: ctx.userId ?? null,
        shared: input.shared,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.report.created',
      entityType: 'CrmReport',
      entityId: row.id,
      diff: { after: { name: row.name, objectKey: row.objectKey } },
    });
    return row;
  });

  return created;
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CrmReport> {
  const input = UpdateReportInput.parse(rawInput);
  const before = await get(ctx, id);

  // A built-in is the worked example. Letting it be edited in place would mean
  // "Deals by stage" was a different report per tenant, and the example nobody
  // could get back.
  if (before.builtinSlug) {
    throw new CrmValidationError(
      'This is one of the reports sparx ships. Make a copy of it to change anything.',
      [{ field: 'id', message: 'built-in reports are read-only; duplicate instead' }]
    );
  }

  return withTenant(ctx, async (tx) => {
    const row = await tx.crmReport.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.objectKey === undefined ? {} : { objectKey: input.objectKey }),
        ...(input.filters === undefined ? {} : { filters: input.filters as Prisma.InputJsonValue }),
        ...(input.groupBy === undefined
          ? {}
          : { groupBy: (input.groupBy ?? null) as Prisma.InputJsonValue }),
        ...(input.measures === undefined ? {} : { measures: input.measures }),
        ...(input.visualization === undefined ? {} : { visualization: input.visualization }),
        ...(input.dateRange === undefined ? {} : { dateRange: input.dateRange }),
        ...(input.propertyId === undefined ? {} : { propertyId: input.propertyId ?? null }),
        ...(input.shared === undefined ? {} : { shared: input.shared }),
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.report.updated',
      entityType: 'CrmReport',
      entityId: row.id,
      diff: { before: { name: before.name }, after: { name: row.name } },
    });
    return row;
  });
}

/** Copy a report — the normal way to start one, and the ONLY way to change a
 *  built-in. The copy is private to whoever made it until they share it. */
export async function duplicate(
  ctx: ServiceContext,
  id: string,
  name?: string
): Promise<CrmReport> {
  const source = await get(ctx, id);
  return withTenant(ctx, (tx) =>
    tx.crmReport.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: source.propertyId,
        name: name?.trim() ? name.trim() : `${source.name} (copy)`,
        description: source.description,
        objectKey: source.objectKey,
        filters: source.filters as Prisma.InputJsonValue,
        groupBy: (source.groupBy ?? null) as Prisma.InputJsonValue,
        measures: source.measures as Prisma.InputJsonValue,
        visualization: source.visualization,
        dateRange: source.dateRange as Prisma.InputJsonValue,
        // Deliberately NOT carried: the copy is the tenant's own report, not
        // another instance of the shipped one.
        builtinSlug: null,
        ownerId: ctx.userId ?? null,
        shared: false,
      },
    })
  );
}

export async function archive(ctx: ServiceContext, id: string): Promise<CrmReport> {
  const before = await get(ctx, id);
  if (before.builtinSlug) {
    throw new CrmValidationError(
      'This is one of the reports sparx ships, so it cannot be deleted. Remove it from your dashboards instead.',
      [{ field: 'id', message: 'built-in reports cannot be archived' }]
    );
  }
  return withTenant(ctx, (tx) =>
    tx.crmReport.update({ where: { id }, data: { archivedAt: new Date() } })
  );
}

/** Run a saved report. `dateRange` overrides the saved period without editing
 *  it — what a dashboard's own period switcher sends. */
export async function run(
  ctx: ServiceContext,
  id: string,
  rawQuery: unknown = {}
): Promise<ReportResult & { report: CrmReport }> {
  const query = RunReportQuery.parse(rawQuery);
  const report = await get(ctx, id);
  const definition = toDefinition(report);
  const result = await runReport(
    ctx,
    query.dateRange ? { ...definition, dateRange: query.dateRange } : definition,
    query.limit
  );
  return { ...result, report };
}

/** Run a definition that has not been saved — the builder's live preview. The
 *  same compiler and the same RLS session; nothing is stored. */
export async function preview(ctx: ServiceContext, rawInput: unknown): Promise<ReportResult> {
  const input = CreateReportInput.parse(rawInput);
  return runReport(
    ctx,
    {
      objectKey: input.objectKey,
      filters: input.filters,
      groupBy: input.groupBy ?? null,
      measures: input.measures,
      dateRange: input.dateRange,
      propertyId: input.propertyId ?? null,
    },
    200
  );
}
