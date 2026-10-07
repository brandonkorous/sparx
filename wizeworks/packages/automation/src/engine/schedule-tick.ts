// SCHEDULED (predicate) triggers (docs/81 §5.2).
//
// "Customer inactive 45 days" has no per-record event — inactivity is the
// ABSENCE of activity, visible only to a scan. So a scheduled trigger is a
// (schedule, predicate) pair: on each scheduler tick the engine runs the
// predicate query for the tenant and enqueues ONE run per matched row — exactly
// what `runDailyAutomationTriggers` does today, re-expressed as the unified
// engine path.
//
// Once-per-occurrence is enforced by a window-scoped dedupe key
// (`automation:entity:window`) on the existing `(automation_id, dedupe_key)`
// UNIQUE — so a scheduler that fires the tick several times inside the window
// collapses to a single run. The scanned fields are stamped onto the synthesized
// envelope (`__fields`) so the executing tick acts on the freshly-scanned
// snapshot rather than re-resolving a non-existent event.

import {
  ConditionGroup,
  type ScheduleSpec,
  triggerFromColumns,
} from '@wizeworks/automation-schemas';
import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@wizeworks/db';
import { withTenant } from '@wizeworks/db';
import { formatLocalDate, localCalendarParts, localMinuteOfDay, tzOffsetMs } from '@wizeworks/time';

import { evaluateConditions } from '../conditions/evaluate';
import type { EngineDeps, TenantCtx, TriggerEnvelope } from '../engine-types';
import { getScanner, propertyOf } from '../resolvers/registry';
import { countAuthoredActions } from './handle-trigger';
import { installBuiltins } from './install';

export interface ScheduleTickResult {
  automations: number;
  enqueued: number;
}

/** Raw shape returned by `find_active_scheduled_automations` (snake_case). */
interface ScheduledAutomationRow {
  id: string;
  tenant_id: string;
  /** Which site this rule is scoped to; null = tenant-wide (docs/131 §3.1). */
  property_id: string | null;
  trigger_type: string;
  trigger_config: unknown;
  conditions: unknown;
  actions: unknown;
  version: number;
}

export async function runScheduleTick(
  deps: EngineDeps,
  db: PrismaClient,
  now: Date = new Date()
): Promise<ScheduleTickResult> {
  installBuiltins();

  // Cross-tenant DISCOVERY via the SECURITY DEFINER helper — the worker runs as
  // FORCE RLS-bound `sparx_app` (no ambient bypass in prod, docs/16 §4). The
  // per-automation predicate scan + enqueue below stays withTenant-scoped.
  const rows = await db.$queryRaw<ScheduledAutomationRow[]>`
    SELECT id, tenant_id, property_id, trigger_type, trigger_config, conditions, actions, version
    FROM find_active_scheduled_automations()
  `;
  const only = deps.onlyTenants;
  const autos = rows
    .filter((r) => !only || only.has(r.tenant_id))
    .map((r) => ({
      id: r.id,
      tenantId: r.tenant_id,
      propertyId: r.property_id,
      triggerType: r.trigger_type,
      triggerConfig: r.trigger_config,
      conditions: r.conditions,
      actions: r.actions,
      version: r.version,
    }));

  const result: ScheduleTickResult = { automations: 0, enqueued: 0 };

  for (const a of autos) {
    let trigger;
    try {
      trigger = triggerFromColumns(a.triggerType, a.triggerConfig);
    } catch {
      deps.logger.warn({ automationId: a.id }, 'schedule-tick: invalid trigger config, skipping');
      continue;
    }
    if (trigger.kind !== 'schedule') continue;
    const { schedule, predicate } = trigger;
    const conditions = ConditionGroup.safeParse(a.conditions);
    const actionsTotal = countAuthoredActions(a.actions);

    await withTenant(
      { tenantId: a.tenantId },
      async (tx) => {
        // The business's own day, read once per rule: the same calendar the
        // scanners count "7 days late" on, so a rule's once-a-day and its
        // question about the day are the same day (sparx persona issue 140).
        const clock = businessClockAt(now, await businessZone(tx, a.tenantId));
        if (!isScheduleDue(schedule, now, clock)) return;
        result.automations += 1;
        const windowKey = scheduleWindowKey(schedule, clock);

        const scanner = getScanner(predicate.entity);
        if (!scanner) {
          deps.logger.warn(
            { automationId: a.id, entity: predicate.entity },
            'schedule-tick: no scanner registered for entity, skipping'
          );
          return;
        }
        const ctx: TenantCtx = { tenantId: a.tenantId, tx, deps, causeDepth: 0 };
        const rows = await scanner(ctx);

        for (const row of rows) {
          // The site filter, applied PER SCANNED ROW (docs/131 §3.1) — a scan
          // returns the tenant's whole entity set, so a site-scoped sweep must
          // discard rows belonging to another business. Same semantics as the
          // event path: a tenant-wide rule takes everything, and a row whose
          // site is unknown is only ever taken by a tenant-wide rule.
          const rowProperty = propertyOf(row.fields);
          if (a.propertyId !== null && a.propertyId !== rowProperty) continue;

          // The predicate is the SELECTOR; the automation's own conditions are an
          // additional AND post-filter.
          if (!evaluateConditions(predicate.where, row.fields)) continue;
          if (conditions.success && !evaluateConditions(conditions.data, row.fields)) continue;

          const dedupeKey = `${a.id}:${row.id}:${windowKey}`;

          // Once-per-window: a run already enqueued this window is a no-op. We
          // check-then-create (rather than upsert) so `enqueued` counts only NEW
          // runs — the scheduler is single-instance, and the (automation_id,
          // dedupe_key) UNIQUE is still the integrity backstop if two ticks race.
          const already = await tx.automationRun.findUnique({
            where: { automationId_dedupeKey: { automationId: a.id, dedupeKey } },
            select: { id: true },
          });
          if (already) continue;

          const envelope: TriggerEnvelope = {
            type: a.triggerType,
            tenantId: a.tenantId,
            actorId: null,
            occurredAt: now.toISOString(),
            data: { entityId: row.id, __dedupe: dedupeKey, __fields: row.fields },
          };
          await tx.automationRun.create({
            data: {
              automationId: a.id,
              tenantId: a.tenantId,
              // From the scanned ROW, not the rule: a tenant-wide sweep that
              // matched a donut customer produced a donut-site run.
              propertyId: rowProperty,
              triggerEvent: envelope as unknown as Prisma.InputJsonValue,
              dedupeKey,
              causeDepth: 0,
              status: 'running',
              cursorIndex: 0,
              actionsTotal,
              automationVersion: a.version,
            },
          });
          result.enqueued += 1;
        }
      },
      db
    );
  }

  return result;
}

// ─── schedule arithmetic, on the business's clock ───────────────────────────
//
// A daily, weekly or monthly rule runs once per BUSINESS day, at the time its
// screen shows. It ran once per UTC date instead, at any hour after its minute
// of the UTC day. The reminder rules ask about the business's day ("is this
// bill 7 days late today?", counted on its calendar since issue 099), and a
// Denver day overlaps two UTC dates, so each notice went out twice: at midnight
// in Denver (a new UTC date, and the bill already 7 days late) and again at
// 6pm (the next UTC date, and the bill still 7 days late). The screen said
// "Every day at 6:00pm" (sparx persona issue 140).
//
// The stored minute stays a minute of the UTC day (the editor converts what the
// owner typed with the offset of the day, issue 613). Its time on the business
// clock is that minute plus today's offset, which is exactly what the screen
// prints. The weekday and day of the month were always the owner's: the editor
// stores the day she picked, unconverted, and the screen prints it as-is.
//
// A business with no zone keeps UTC, exactly as before. An interval rule is not
// a time of day and keeps the UTC minute.

const MINUTES_IN_DAY = 1440;

/** The business's clock at an instant. */
export interface BusinessClock {
  /** `YYYY-MM-DD` on the business's calendar: the once-a-day key. */
  date: string;
  /** 0 = Sunday … 6 = Saturday. */
  weekday: number;
  dayOfMonth: number;
  /** Minutes past the business's midnight. */
  minute: number;
  /** How far the business's clock is ahead of UTC at this instant. */
  offsetMinutes: number;
}

/**
 * Where the business keeps its books, or null when it has not said. The same
 * read as `businessTimeZone` in `@wizeworks/crm`, which this engine package
 * cannot depend on: a blank column is "not set".
 */
async function businessZone(
  tx: Prisma.TransactionClient,
  tenantId: string
): Promise<string | null> {
  const business = await tx.tenantBusiness.findUnique({
    where: { tenantId },
    select: { timezone: true },
  });
  const zone = business?.timezone?.trim() ?? '';
  return zone.length > 0 ? zone : null;
}

/** The business's clock at `now`; UTC with no zone, or with one the runtime
 *  does not know (a bad zone name must not stop every rule the business has). */
export function businessClockAt(now: Date, timeZone: string | null): BusinessClock {
  const ms = now.getTime();
  if (timeZone) {
    try {
      const parts = localCalendarParts(ms, timeZone);
      return {
        date: formatLocalDate(parts),
        weekday: parts.weekday,
        dayOfMonth: parts.day,
        minute: localMinuteOfDay(ms, timeZone),
        offsetMinutes: Math.round(tzOffsetMs(ms, timeZone) / 60_000),
      };
    } catch {
      // Unknown zone: fall through to UTC.
    }
  }
  return {
    date: now.toISOString().slice(0, 10),
    weekday: now.getUTCDay(),
    dayOfMonth: now.getUTCDate(),
    minute: minuteOfDayUtc(now),
    offsetMinutes: 0,
  };
}

function minuteOfDayUtc(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** The rule's time of day on the business's clock. */
function scheduledMinute(atMinuteUtc: number, clock: BusinessClock): number {
  return (((atMinuteUtc + clock.offsetMinutes) % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
}

/** Are we at/past the scheduled moment within the current window? Combined with
 *  the window-scoped dedupe this yields exactly-once-per-occurrence firing even
 *  when the scheduler ticks many times. */
export function isScheduleDue(schedule: ScheduleSpec, now: Date, clock: BusinessClock): boolean {
  switch (schedule.cadence) {
    case 'daily':
      return clock.minute >= scheduledMinute(schedule.atMinuteUtc, clock);
    case 'weekly':
      return (
        clock.weekday === schedule.dayOfWeek &&
        clock.minute >= scheduledMinute(schedule.atMinuteUtc, clock)
      );
    case 'monthly':
      return (
        clock.dayOfMonth === schedule.dayOfMonth &&
        clock.minute >= scheduledMinute(schedule.atMinuteUtc, clock)
      );
    case 'interval':
      // Due on each `everyMinutes` boundary of the UTC day (the worker ticks every
      // minute). everyMinutes that don't divide 1440 still fire ~every N minutes.
      return minuteOfDayUtc(now) % schedule.everyMinutes === 0;
    case 'once':
      return now.getTime() >= new Date(schedule.at).getTime();
    default:
      return false;
  }
}

/** A stable key for the current firing window — `once` fires once ever; the
 *  cadenced schedules fire at most once on the business's calendar date. */
export function scheduleWindowKey(schedule: ScheduleSpec, clock: BusinessClock): string {
  if (schedule.cadence === 'once') return `once:${schedule.at}`;
  // An interval scan dedupes ONCE PER ENTITY (stable key, not date-bucketed): a
  // transient row fires a single run and never re-fires each interval while it
  // remains in the scan window. The per-automation + per-row parts of the dedupe
  // key still namespace it.
  if (schedule.cadence === 'interval') return 'interval';
  return clock.date;
}
