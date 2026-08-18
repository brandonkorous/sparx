// dashboardService — boards of saved reports (docs/144 §8).
//
// A dashboard is a layout, nothing more: which reports, where on a 12-column
// grid. It holds no numbers and no definitions of its own, so a report edited
// once is corrected on every board it appears on — which is the whole reason
// widgets point at reports rather than embedding a copy of them.

import {
  CreateDashboardInput,
  SetWidgetsInput,
  UpdateDashboardInput,
} from '@wizeworks/crm-schemas';
import { withTenant } from '@wizeworks/db';
import type { CrmDashboard, CrmDashboardWidget, CrmReport, Prisma } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';

const withWidgets = {
  widgets: {
    orderBy: [{ y: 'asc' }, { x: 'asc' }] as const,
    include: { report: true },
  },
} satisfies Prisma.CrmDashboardInclude;

export type DashboardWithWidgets = CrmDashboard & {
  widgets: (CrmDashboardWidget & { report: CrmReport })[];
};

export async function list(
  ctx: ServiceContext,
  args: { propertyIds?: string[] | null } = {}
): Promise<CrmDashboard[]> {
  return withTenant(ctx, (tx) =>
    tx.crmDashboard.findMany({
      where: {
        archivedAt: null,
        ...(args.propertyIds
          ? { OR: [{ propertyId: null }, { propertyId: { in: args.propertyIds } }] }
          : {}),
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  );
}

export async function get(ctx: ServiceContext, id: string): Promise<DashboardWithWidgets> {
  const row = await withTenant(ctx, (tx) =>
    tx.crmDashboard.findFirst({ where: { id }, include: withWidgets })
  );
  if (!row || row.archivedAt) throw new CrmNotFoundError('Dashboard', id);
  return row;
}

/** The board a person lands on: the default, else the first they can see. Null
 *  when a tenant has never made one — the surface offers to build one rather
 *  than inventing a board nobody asked for. */
export async function landing(
  ctx: ServiceContext,
  args: { propertyIds?: string[] | null } = {}
): Promise<DashboardWithWidgets | null> {
  const rows = await list(ctx, args);
  const target = rows.find((d) => d.isDefault) ?? rows[0];
  return target ? get(ctx, target.id) : null;
}

/** Demote whatever currently holds the default flag for this site. The partial
 *  unique index would otherwise reject the write — this makes "make it the
 *  default" mean what a person expects instead of erroring at them. */
async function clearDefault(
  tx: Prisma.TransactionClient,
  propertyId: string | null,
  exceptId?: string
): Promise<void> {
  await tx.crmDashboard.updateMany({
    where: {
      propertyId,
      isDefault: true,
      archivedAt: null,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    data: { isDefault: false },
  });
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmDashboard> {
  const input = CreateDashboardInput.parse(rawInput);
  return withTenant(ctx, async (tx) => {
    if (input.isDefault) await clearDefault(tx, input.propertyId ?? null);
    const row = await tx.crmDashboard.create({
      data: {
        tenantId: ctx.tenantId,
        propertyId: input.propertyId ?? null,
        name: input.name,
        description: input.description ?? null,
        isDefault: input.isDefault,
        ownerId: ctx.userId ?? null,
        shared: input.shared,
      },
    });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'crm.dashboard.created',
      entityType: 'CrmDashboard',
      entityId: row.id,
      diff: { after: { name: row.name } },
    });
    return row;
  });
}

export async function update(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CrmDashboard> {
  const input = UpdateDashboardInput.parse(rawInput);
  const before = await get(ctx, id);
  return withTenant(ctx, async (tx) => {
    const propertyId = input.propertyId === undefined ? before.propertyId : input.propertyId;
    if (input.isDefault) await clearDefault(tx, propertyId ?? null, id);
    return tx.crmDashboard.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.propertyId === undefined ? {} : { propertyId: input.propertyId ?? null }),
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
        ...(input.shared === undefined ? {} : { shared: input.shared }),
      },
    });
  });
}

export async function archive(ctx: ServiceContext, id: string): Promise<CrmDashboard> {
  await get(ctx, id);
  return withTenant(ctx, (tx) =>
    tx.crmDashboard.update({
      where: { id },
      // Dropping the default flag on the way out, so the partial unique index
      // stays free for whichever board becomes the new landing page.
      data: { archivedAt: new Date(), isDefault: false },
    })
  );
}

/**
 * Replace the whole layout in one write.
 *
 * Per-widget saves would be wrong here, not merely chattier: dropping one widget
 * on a grid pushes its neighbours, so a board is only ever valid as a SET. Saved
 * one at a time it would pass through overlapping states, and two people
 * arranging the same board would interleave into a layout neither chose.
 */
export async function setWidgets(
  ctx: ServiceContext,
  dashboardId: string,
  rawInput: unknown
): Promise<DashboardWithWidgets> {
  const input = SetWidgetsInput.parse(rawInput);
  await get(ctx, dashboardId);

  await withTenant(ctx, async (tx) => {
    // Every report must be one this tenant can see. RLS already guarantees that
    // — this turns a silently-dropped widget into an error a person can act on.
    if (input.widgets.length > 0) {
      const ids = [...new Set(input.widgets.map((w) => w.reportId))];
      const found = await tx.crmReport.findMany({
        where: { id: { in: ids }, archivedAt: null },
        select: { id: true },
      });
      if (found.length !== ids.length) {
        throw new CrmValidationError('One of those reports no longer exists.', [
          { field: 'widgets', message: 'unknown or archived reportId' },
        ]);
      }
    }

    await tx.crmDashboardWidget.deleteMany({ where: { dashboardId } });
    if (input.widgets.length > 0) {
      await tx.crmDashboardWidget.createMany({
        data: input.widgets.map((w) => ({
          tenantId: ctx.tenantId,
          dashboardId,
          reportId: w.reportId,
          x: w.x,
          y: w.y,
          w: w.w,
          h: w.h,
          title: w.title ?? null,
        })),
      });
    }
  });

  return get(ctx, dashboardId);
}
