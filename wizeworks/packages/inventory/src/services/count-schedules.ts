// Cycle-count schedules (docs/146 Phase 7.9).
//
// Counts have existed since docs/100, and every one of them had to be created by
// hand. In practice that means counting happens enthusiastically for a fortnight
// and then stops, which is why 44.8% of operators name inaccurate stock data as
// a top problem while owning software that can count.
//
// A schedule is the difference between "we cycle count" as an intention and as a
// fact: a standing instruction that generates the count, picks what goes on it,
// assigns it, and moves its own next date on.
//
// ── ABC-driven cadence ───────────────────────────────────────────────────────
//
// Count where the money is monthly, the middle quarterly, the tail annually. A
// catalogue is covered completely for roughly a tenth of the effort of a full
// stocktake, and the items whose error costs most are checked twelve times a
// year instead of once.
//
// ── What goes on a generated count ───────────────────────────────────────────
//
// The most overdue slice, up to `maxItemsPerRun`. "Most overdue" is
// least-recently-counted first, falling back to never-counted — because an item
// nobody has ever counted is the least trustworthy number in the building and
// should not wait behind one counted last month. A count of four hundred lines
// does not get done, so the rest simply waits for the next run.
//
// ── Generation is idempotent per due-date ────────────────────────────────────
//
// The generator moves `nextRunAt` FORWARD from the date that was due, not from
// now — so a schedule that was paused for six weeks resumes on a sane date
// rather than firing six overdue counts in a row. And a schedule whose previous
// count is still open is skipped entirely: stacking a second count on a shelf
// nobody has finished counting produces two sets of expected quantities for the
// same stock, which is worse than counting late.

import {
  cadenceIntervalDays,
  CreateCountScheduleInput,
  UpdateCountScheduleInput,
} from '@wizeworks/commerce-schemas';
import type { AbcClass, CountCadence } from '@wizeworks/commerce-schemas';
import { withTenant } from '@wizeworks/db';
import type { TxClient } from '@wizeworks/db';

import { writeAuditLog } from '../audit';
import { InventoryNotFoundError, InventoryValidationError } from '../errors';
import type { ServiceContext } from '../errors';

import { isUniqueViolation, nextCountNumber } from './inventory-count-shared';
import { ensureWarehouseActive } from './internal';

const DAY_MS = 86_400_000;

export interface CountScheduleRow {
  id: string;
  warehouseId: string;
  warehouseName: string | null;
  warehouseCode: string | null;
  name: string;
  abcClass: AbcClass | null;
  zoneName: string | null;
  cadence: CountCadence;
  intervalDays: number;
  maxItemsPerRun: number;
  isBlind: boolean;
  assignedTo: string | null;
  isActive: boolean;
  lastRunAt: string | null;
  lastCountId: string | null;
  lastCountNumber: string | null;
  /** Still open, so the next run will be skipped until it is finished. */
  lastCountOpen: boolean;
  nextRunAt: string;
  /** True when the next run is in the past — the schedule is waiting on a sweep. */
  isDue: boolean;
  /** How many levels this schedule's filter currently covers. */
  coveredLevels: number;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleGenerationResult {
  schedulesConsidered: number;
  countsCreated: number;
  skippedOpen: number;
  skippedEmpty: number;
  counts: { scheduleId: string; countId: string; number: string; lineCount: number }[];
}

// ─── CRUD ────────────────────────────────────────────────────────────────────

export async function listCountSchedules(
  ctx: ServiceContext,
  filter: { warehouseId?: string; includeInactive?: boolean } = {}
): Promise<{ items: CountScheduleRow[]; total: number }> {
  return withTenant(ctx, async (tx) => {
    const where = {
      tenantId: ctx.tenantId,
      ...(filter.warehouseId ? { warehouseId: filter.warehouseId } : {}),
      ...(filter.includeInactive ? {} : { isActive: true }),
    };
    const rows = await tx.cycleCountSchedule.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { nextRunAt: 'asc' }],
      include: { warehouse: { select: { name: true, code: true } } },
    });
    const items = await Promise.all(rows.map((r) => toScheduleRow(tx, ctx.tenantId, r)));
    return { items, total: items.length };
  });
}

export async function getCountSchedule(ctx: ServiceContext, id: string): Promise<CountScheduleRow> {
  return withTenant(ctx, async (tx) => {
    const row = await tx.cycleCountSchedule.findFirst({
      where: { id, tenantId: ctx.tenantId },
      include: { warehouse: { select: { name: true, code: true } } },
    });
    if (!row) throw new InventoryNotFoundError('CycleCountSchedule', id);
    return toScheduleRow(tx, ctx.tenantId, row);
  });
}

export async function createCountSchedule(
  ctx: ServiceContext,
  rawInput: unknown
): Promise<CountScheduleRow> {
  const input = CreateCountScheduleInput.parse(rawInput);
  if (input.cadence === 'custom' && !input.intervalDays) {
    throw new InventoryValidationError(
      'Choose how many days apart the counts should be, or pick one of the standard cadences.'
    );
  }
  const intervalDays = cadenceIntervalDays(input.cadence, input.intervalDays ?? null);

  return withTenant(ctx, async (tx) => {
    await ensureWarehouseActive(tx, input.warehouseId);
    const created = await tx.cycleCountSchedule.create({
      data: {
        tenantId: ctx.tenantId,
        warehouseId: input.warehouseId,
        name: input.name,
        abcClass: input.abcClass ?? null,
        zoneName: input.zoneName ?? null,
        cadence: input.cadence,
        intervalDays,
        maxItemsPerRun: input.maxItemsPerRun,
        isBlind: input.isBlind,
        assignedTo: input.assignedTo ?? null,
        nextRunAt: input.startAt ?? new Date(),
      },
      include: { warehouse: { select: { name: true, code: true } } },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count_schedule.created',
      entityType: 'CycleCountSchedule',
      entityId: created.id,
      diff: { after: { name: created.name, cadence: created.cadence, intervalDays } },
    });

    return toScheduleRow(tx, ctx.tenantId, created);
  });
}

export async function updateCountSchedule(
  ctx: ServiceContext,
  id: string,
  rawInput: unknown
): Promise<CountScheduleRow> {
  const input = UpdateCountScheduleInput.parse(rawInput);

  return withTenant(ctx, async (tx) => {
    const before = await tx.cycleCountSchedule.findFirst({ where: { id, tenantId: ctx.tenantId } });
    if (!before) throw new InventoryNotFoundError('CycleCountSchedule', id);

    // A cadence change re-derives the interval, unless the caller named one —
    // otherwise switching from monthly to quarterly would leave the schedule
    // still firing every 30 days while the screen said "quarterly".
    const cadence = input.cadence ?? (before.cadence as CountCadence);
    const intervalDays =
      input.intervalDays ??
      (input.cadence ? cadenceIntervalDays(cadence, null) : before.intervalDays);

    const updated = await tx.cycleCountSchedule.update({
      where: { id },
      data: {
        ...(input.name !== undefined ? { name: input.name } : {}),
        ...(input.abcClass !== undefined ? { abcClass: input.abcClass ?? null } : {}),
        ...(input.zoneName !== undefined ? { zoneName: input.zoneName ?? null } : {}),
        ...(input.cadence !== undefined ? { cadence: input.cadence } : {}),
        intervalDays,
        ...(input.maxItemsPerRun !== undefined ? { maxItemsPerRun: input.maxItemsPerRun } : {}),
        ...(input.isBlind !== undefined ? { isBlind: input.isBlind } : {}),
        ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo ?? null } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
        ...(input.nextRunAt !== undefined ? { nextRunAt: input.nextRunAt } : {}),
      },
      include: { warehouse: { select: { name: true, code: true } } },
    });

    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count_schedule.updated',
      entityType: 'CycleCountSchedule',
      entityId: id,
      diff: {
        before: {
          cadence: before.cadence,
          intervalDays: before.intervalDays,
          isActive: before.isActive,
        },
        after: {
          cadence: updated.cadence,
          intervalDays: updated.intervalDays,
          isActive: updated.isActive,
        },
      },
    });

    return toScheduleRow(tx, ctx.tenantId, updated);
  });
}

/**
 * Delete a schedule.
 *
 * The counts it generated survive — the FK is SET NULL. Deleting the standing
 * instruction must never delete the evidence that counting happened.
 */
export async function deleteCountSchedule(
  ctx: ServiceContext,
  id: string
): Promise<{ id: string; deleted: true }> {
  return withTenant(ctx, async (tx) => {
    const existing = await tx.cycleCountSchedule.findFirst({
      where: { id, tenantId: ctx.tenantId },
      select: { id: true, name: true },
    });
    if (!existing) throw new InventoryNotFoundError('CycleCountSchedule', id);

    await tx.cycleCountSchedule.delete({ where: { id } });
    await writeAuditLog({
      tx,
      tenantId: ctx.tenantId,
      actorId: ctx.userId ?? null,
      actorType: ctx.userId ? 'user' : 'system',
      action: 'inventory.count_schedule.deleted',
      entityType: 'CycleCountSchedule',
      entityId: id,
      diff: { before: { name: existing.name } },
    });
    return { id, deleted: true as const };
  });
}

// ─── Generation ──────────────────────────────────────────────────────────────

/**
 * Generate the counts that are due.
 *
 * `asOf` is a parameter rather than `new Date()` so the nightly sweep, a manual
 * "run it now", and a test all drive the same code with an explicit instant —
 * and so a schedule's arithmetic is reproducible rather than dependent on when
 * someone happened to click.
 */
export async function generateDueCounts(
  ctx: ServiceContext,
  options: { asOf?: Date; scheduleId?: string; force?: boolean } = {}
): Promise<ScheduleGenerationResult> {
  const asOf = options.asOf ?? new Date();

  const due = await withTenant(ctx, (tx) =>
    tx.cycleCountSchedule.findMany({
      where: {
        tenantId: ctx.tenantId,
        isActive: true,
        ...(options.scheduleId ? { id: options.scheduleId } : {}),
        ...(options.force ? {} : { nextRunAt: { lte: asOf } }),
      },
      orderBy: { nextRunAt: 'asc' },
    })
  );

  const result: ScheduleGenerationResult = {
    schedulesConsidered: due.length,
    countsCreated: 0,
    skippedOpen: 0,
    skippedEmpty: 0,
    counts: [],
  };

  for (const schedule of due) {
    // One schedule per transaction. A schedule whose slice is empty must not
    // roll back the counts other schedules already created in this pass.
    const outcome = await runSchedule(ctx, schedule, asOf);
    if (outcome.kind === 'created') {
      result.countsCreated += 1;
      result.counts.push({
        scheduleId: schedule.id,
        countId: outcome.countId,
        number: outcome.number,
        lineCount: outcome.lineCount,
      });
    } else if (outcome.kind === 'open') {
      result.skippedOpen += 1;
    } else {
      result.skippedEmpty += 1;
    }
  }

  return result;
}

type ScheduleOutcome =
  | { kind: 'created'; countId: string; number: string; lineCount: number }
  | { kind: 'open' }
  | { kind: 'empty' };

async function runSchedule(
  ctx: ServiceContext,
  schedule: {
    id: string;
    warehouseId: string;
    name: string;
    abcClass: string | null;
    zoneName: string | null;
    intervalDays: number;
    maxItemsPerRun: number;
    isBlind: boolean;
    assignedTo: string | null;
    lastCountId: string | null;
    nextRunAt: Date;
  },
  asOf: Date
): Promise<ScheduleOutcome> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await withTenant(ctx, async (tx) => {
        // Still counting the last one? Leave it alone. Two open counts over the
        // same shelf produce two sets of expected quantities for one lot of
        // stock, and posting the second silently undoes the first.
        if (schedule.lastCountId) {
          const previous = await tx.inventoryCount.findFirst({
            where: { id: schedule.lastCountId, tenantId: ctx.tenantId },
            select: { status: true },
          });
          if (previous && !['posted', 'cancelled'].includes(previous.status)) {
            return { kind: 'open' as const };
          }
        }

        const lines = await selectSliceToCount(tx, ctx.tenantId, schedule);
        if (lines.length === 0) {
          // Nothing to count is not a failure, but the schedule must still move
          // on — otherwise an empty filter makes it due forever.
          await tx.cycleCountSchedule.update({
            where: { id: schedule.id },
            data: { nextRunAt: advance(schedule.nextRunAt, schedule.intervalDays, asOf) },
          });
          return { kind: 'empty' as const };
        }

        const number = await nextCountNumber(tx, ctx.tenantId);
        const count = await tx.inventoryCount.create({
          data: {
            tenantId: ctx.tenantId,
            number,
            warehouseId: schedule.warehouseId,
            type: 'cycle',
            status: 'counting',
            scope: schedule.zoneName ? 'zone' : 'location',
            zoneName: schedule.zoneName,
            isBlind: schedule.isBlind,
            scheduleId: schedule.id,
            note: `${schedule.name} — scheduled count`,
          },
          select: { id: true, number: true },
        });

        await tx.inventoryCountLine.createMany({
          data: lines.map((l) => ({
            tenantId: ctx.tenantId,
            countId: count.id,
            variantId: l.variantId,
            expectedQuantity: l.onHand,
          })),
        });

        await tx.cycleCountSchedule.update({
          where: { id: schedule.id },
          data: {
            lastRunAt: asOf,
            lastCountId: count.id,
            nextRunAt: advance(schedule.nextRunAt, schedule.intervalDays, asOf),
          },
        });

        await writeAuditLog({
          tx,
          tenantId: ctx.tenantId,
          actorId: ctx.userId ?? null,
          actorType: 'system',
          action: 'inventory.count.created',
          entityType: 'InventoryCount',
          entityId: count.id,
          diff: {
            after: {
              number: count.number,
              type: 'cycle',
              lineCount: lines.length,
              scheduleId: schedule.id,
            },
          },
        });

        return {
          kind: 'created' as const,
          countId: count.id,
          number: count.number,
          lineCount: lines.length,
        };
      });
    } catch (err) {
      // The count number is count+1; a lost race poisons the transaction and the
      // whole schedule retries, exactly as the hand-made path does.
      if (isUniqueViolation(err) && attempt < 4) continue;
      throw err;
    }
  }
  throw new InventoryValidationError('Could not allocate an inventory-count number');
}

/**
 * The slice to count: least-recently-counted first, never-counted first of all.
 *
 * An item nobody has ever counted is the least trustworthy number in the
 * building, so `NULLS FIRST` is the whole ordering decision. The ABC filter reads
 * the level's denormalised class, which is the EFFECTIVE one (an override
 * already applied) — so a buyer who marked the washer an A gets it counted
 * monthly, which is the entire reason they marked it.
 */
async function selectSliceToCount(
  tx: TxClient,
  tenantId: string,
  schedule: {
    warehouseId: string;
    abcClass: string | null;
    zoneName: string | null;
    maxItemsPerRun: number;
  }
): Promise<{ variantId: string; onHand: number }[]> {
  return tx.$queryRaw<{ variantId: string; onHand: number }[]>`
    SELECT l.variant_id AS "variantId", l.on_hand AS "onHand"
    FROM inventory_levels l
    JOIN commerce_product_variants v ON v.id = l.variant_id AND v.deleted_at IS NULL
    LEFT JOIN LATERAL (
      SELECT MAX(c.posted_at) AS last_counted_at
      FROM inventory_count_lines cl
      JOIN inventory_counts c ON c.id = cl.count_id
      WHERE cl.tenant_id = l.tenant_id
        AND cl.variant_id = l.variant_id
        AND c.warehouse_id = l.warehouse_id
        AND c.status = 'posted'
    ) lc ON true
    WHERE l.tenant_id = ${tenantId}::uuid
      AND l.warehouse_id = ${schedule.warehouseId}::uuid
      AND (${schedule.abcClass}::text IS NULL OR l.abc_class = ${schedule.abcClass}::text)
      AND (
        ${schedule.zoneName}::text IS NULL
        OR EXISTS (
          SELECT 1
          FROM inventory_bin_levels bl
          JOIN inventory_bins b ON b.id = bl.bin_id
          WHERE bl.tenant_id = l.tenant_id
            AND bl.variant_id = l.variant_id
            AND b.warehouse_id = l.warehouse_id
            AND b.zone = ${schedule.zoneName}::text
        )
      )
    ORDER BY lc.last_counted_at ASC NULLS FIRST, l.on_hand DESC
    LIMIT ${schedule.maxItemsPerRun}
  `;
}

/**
 * The next due date: one interval on from the date that WAS due, but never in
 * the past.
 *
 * Advancing from `now` would let a schedule drift later every time the sweep ran
 * a few minutes late. Advancing blindly from the due date would leave a schedule
 * paused for six weeks still six weeks behind, so it fires again tomorrow, and
 * the day after. Walking forward until it passes `asOf` is the version that does
 * neither.
 */
function advance(from: Date, intervalDays: number, asOf: Date): Date {
  const step = Math.max(1, intervalDays) * DAY_MS;
  let next = from.getTime() + step;
  while (next <= asOf.getTime()) next += step;
  return new Date(next);
}

async function toScheduleRow(
  tx: TxClient,
  tenantId: string,
  row: {
    id: string;
    warehouseId: string;
    name: string;
    abcClass: string | null;
    zoneName: string | null;
    cadence: string;
    intervalDays: number;
    maxItemsPerRun: number;
    isBlind: boolean;
    assignedTo: string | null;
    isActive: boolean;
    lastRunAt: Date | null;
    lastCountId: string | null;
    nextRunAt: Date;
    createdAt: Date;
    updatedAt: Date;
    warehouse?: { name: string | null; code: string } | null;
  }
): Promise<CountScheduleRow> {
  const [lastCount, coveredLevels] = await Promise.all([
    row.lastCountId
      ? tx.inventoryCount.findFirst({
          where: { id: row.lastCountId, tenantId },
          select: { number: true, status: true },
        })
      : Promise.resolve(null),
    tx.inventoryLevel.count({
      where: {
        tenantId,
        warehouseId: row.warehouseId,
        ...(row.abcClass ? { abcClass: row.abcClass } : {}),
      },
    }),
  ]);

  return {
    id: row.id,
    warehouseId: row.warehouseId,
    warehouseName: row.warehouse?.name ?? null,
    warehouseCode: row.warehouse?.code ?? null,
    name: row.name,
    abcClass: (row.abcClass as AbcClass | null) ?? null,
    zoneName: row.zoneName,
    cadence: row.cadence as CountCadence,
    intervalDays: row.intervalDays,
    maxItemsPerRun: row.maxItemsPerRun,
    isBlind: row.isBlind,
    assignedTo: row.assignedTo,
    isActive: row.isActive,
    lastRunAt: row.lastRunAt?.toISOString() ?? null,
    lastCountId: row.lastCountId,
    lastCountNumber: lastCount?.number ?? null,
    lastCountOpen: lastCount ? !['posted', 'cancelled'].includes(lastCount.status) : false,
    nextRunAt: row.nextRunAt.toISOString(),
    isDue: row.isActive && row.nextRunAt.getTime() <= Date.now(),
    coveredLevels,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}
