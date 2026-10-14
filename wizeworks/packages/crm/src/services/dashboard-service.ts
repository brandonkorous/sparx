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
import { afterCommit, withTenant } from '@wizeworks/db';
import type { CrmDashboard, CrmDashboardWidget, CrmReport, Prisma } from '@wizeworks/db';
import { indexEntity } from '@wizeworks/events';

import { writeAuditLog } from '../audit';
import type { ServiceContext } from '../errors';
import { CrmNotFoundError, CrmValidationError } from '../errors';
import { BOARD_COLUMNS, canSee, visibleWhere } from './owner-visibility';

const withWidgets = {
  widgets: {
    orderBy: [{ y: 'asc' }, { x: 'asc' }] as const,
    include: { report: true },
  },
} satisfies Prisma.CrmDashboardInclude;

/**
 * One card on a board, as the person looking at it may see it.
 *
 * A shared board can hold a card for a report its maker kept private (persona
 * issue 264). Anyone else gets the card's place on the grid and nothing about
 * the report: `report` and `title` are null and `privateReport` is true, so the
 * card can say whose choice that was. `reportId` stays, so rearranging the board
 * keeps the card where its maker put it.
 */
export type BoardWidget = CrmDashboardWidget & {
  report: CrmReport | null;
  privateReport: boolean;
};

export type DashboardWithWidgets = CrmDashboard & { widgets: BoardWidget[] };

/** A card as `viewerId` may see it: whole, or its place on the grid and no more. */
export function widgetFor(
  viewerId: string | null | undefined,
  widget: CrmDashboardWidget & { report: CrmReport }
): BoardWidget {
  if (canSee(viewerId, widget.report)) return { ...widget, privateReport: false };
  // The card's own name is usually the report's in other words, so it goes too.
  return { ...widget, report: null, title: null, privateReport: true };
}

/**
 * Tell search these boards changed, once the write commits (persona issue 261):
 * "Search everything" finds a board by its name and by the reports on it. Queued
 * from inside the transaction, so a rolled-back write announces nothing.
 */
async function signalBoardSearch(ctx: ServiceContext, dashboardIds: string[]): Promise<void> {
  if (dashboardIds.length === 0) return;
  await afterCommit(`index dashboard ${dashboardIds.join(',')}`, async () => {
    for (const recordId of new Set(dashboardIds)) {
      await indexEntity({
        tenantId: ctx.tenantId,
        actorId: ctx.userId ?? null,
        entityType: 'dashboard',
        recordId,
      });
    }
  });
}

export async function list(
  ctx: ServiceContext,
  args: { propertyIds?: string[] | null } = {}
): Promise<CrmDashboard[]> {
  return withTenant(ctx, (tx) =>
    tx.crmDashboard.findMany({
      where: {
        archivedAt: null,
        AND: [
          visibleWhere(ctx.userId, BOARD_COLUMNS),
          ...(args.propertyIds
            ? [{ OR: [{ propertyId: null }, { propertyId: { in: args.propertyIds } }] }]
            : []),
        ],
      },
      orderBy: [{ isDefault: 'desc' }, { name: 'asc' }],
    })
  );
}

/** One board, if this person may see it. A board kept to somebody else answers
 *  exactly as a board that does not exist, so its existence is not confirmed. */
export async function get(ctx: ServiceContext, id: string): Promise<DashboardWithWidgets> {
  const row = await withTenant(ctx, (tx) =>
    tx.crmDashboard.findFirst({
      where: { id, ...visibleWhere(ctx.userId, BOARD_COLUMNS) },
      include: withWidgets,
    })
  );
  if (!row || row.archivedAt) throw new CrmNotFoundError('Dashboard', id);
  return { ...row, widgets: row.widgets.map((w) => widgetFor(ctx.userId, w)) };
}

/** The board a person lands on: the default if they may see it, else the first
 *  board they can see. A board kept to its maker is never anybody else's landing
 *  board, even while it holds the default flag. Null when there is none, and the
 *  surface offers to build one rather than inventing a board nobody asked for. */
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
  ctx: ServiceContext,
  tx: Prisma.TransactionClient,
  propertyId: string | null,
  exceptId?: string
): Promise<void> {
  const where = {
    propertyId,
    isDefault: true,
    archivedAt: null,
    ...(exceptId ? { id: { not: exceptId } } : {}),
  };
  // Read first: a demoted board's line in search can say it was the landing one.
  const demoted = await tx.crmDashboard.findMany({ where, select: { id: true } });
  await tx.crmDashboard.updateMany({ where, data: { isDefault: false } });
  await signalBoardSearch(
    ctx,
    demoted.map((d) => d.id)
  );
}

/** The business has ONE board Dashboards opens on, for everyone, so only a shared
 *  board can hold it: a private one there switched the team's default off for every
 *  teammate (persona issue 264). */
function assertDefaultIsShared(isDefault: boolean, shared: boolean): void {
  if (isDefault && !shared) {
    throw new CrmValidationError(
      'Only a board shared with your team can be the one Dashboards opens on, because it opens for everyone. Share it, or leave "Open this board first" off.',
      [{ field: 'isDefault', message: 'a private board cannot be the default' }]
    );
  }
}

export async function create(ctx: ServiceContext, rawInput: unknown): Promise<CrmDashboard> {
  const input = CreateDashboardInput.parse(rawInput);
  assertDefaultIsShared(input.isDefault, input.shared);
  return withTenant(ctx, async (tx) => {
    if (input.isDefault) await clearDefault(ctx, tx, input.propertyId ?? null);
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
    await signalBoardSearch(ctx, [row.id]);
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
  // Only a change to either switch is checked, so a board left in that state by an
  // older version can still be renamed.
  if (input.isDefault !== undefined || input.shared !== undefined) {
    assertDefaultIsShared(input.isDefault ?? before.isDefault, input.shared ?? before.shared);
  }
  return withTenant(ctx, async (tx) => {
    const propertyId = input.propertyId === undefined ? before.propertyId : input.propertyId;
    if (input.isDefault) await clearDefault(ctx, tx, propertyId ?? null, id);
    const row = await tx.crmDashboard.update({
      where: { id },
      data: {
        ...(input.name === undefined ? {} : { name: input.name }),
        ...(input.description === undefined ? {} : { description: input.description ?? null }),
        ...(input.propertyId === undefined ? {} : { propertyId: input.propertyId ?? null }),
        ...(input.isDefault === undefined ? {} : { isDefault: input.isDefault }),
        ...(input.shared === undefined ? {} : { shared: input.shared }),
      },
    });
    await signalBoardSearch(ctx, [row.id]);
    return row;
  });
}

export async function archive(ctx: ServiceContext, id: string): Promise<CrmDashboard> {
  await get(ctx, id);
  return withTenant(ctx, async (tx) => {
    const row = await tx.crmDashboard.update({
      where: { id },
      // Dropping the default flag on the way out, so the partial unique index
      // stays free for whichever board becomes the new landing page.
      data: { archivedAt: new Date(), isDefault: false },
    });
    await signalBoardSearch(ctx, [row.id]);
    return row;
  });
}

/**
 * Check every report in a new layout, and return the stored card names of the
 * private cards this person may keep on the board but not see.
 *
 * Every report must be one this person can see, or one already on this board.
 * The second half is what lets a teammate rearrange a shared board holding a
 * card for its maker's private report: the card stays, unseen. Anything else is
 * refused exactly as a report that does not exist, which is also how RLS answers
 * another business's report, as an error a person can act on rather than a
 * silently dropped card.
 */
async function privateCardsKept(
  ctx: ServiceContext,
  tx: Prisma.TransactionClient,
  dashboardId: string,
  next: { reportId: string }[]
): Promise<Map<string, (string | null)[]>> {
  const kept = new Map<string, (string | null)[]>();
  if (next.length === 0) return kept;
  const ids = [...new Set(next.map((w) => w.reportId))];
  const found = await tx.crmReport.findMany({
    where: { id: { in: ids }, archivedAt: null },
    select: { id: true, ownerId: true, shared: true },
  });
  const unseen = new Set(found.filter((r) => !canSee(ctx.userId, r)).map((r) => r.id));
  const onBoard =
    unseen.size === 0
      ? []
      : await tx.crmDashboardWidget.findMany({
          where: { dashboardId, reportId: { in: [...unseen] } },
          select: { reportId: true, title: true },
        });
  for (const card of onBoard) {
    kept.set(card.reportId, [...(kept.get(card.reportId) ?? []), card.title]);
  }
  const usable = found.filter((r) => !unseen.has(r.id) || kept.has(r.id));
  if (usable.length !== ids.length) {
    throw new CrmValidationError('One of those reports no longer exists.', [
      { field: 'widgets', message: 'unknown or archived reportId' },
    ]);
  }
  return kept;
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
    const kept = await privateCardsKept(ctx, tx, dashboardId, input.widgets);

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
          // A card this person sees without its name keeps the name its maker
          // gave it: they were sent null for it, not asked to clear it.
          title: kept.has(w.reportId) ? (kept.get(w.reportId)?.shift() ?? null) : (w.title ?? null),
        })),
      });
    }
    // The reports on a board are words search finds it by.
    await signalBoardSearch(ctx, [dashboardId]);
  });

  return get(ctx, dashboardId);
}
