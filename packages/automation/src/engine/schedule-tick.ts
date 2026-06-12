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

import { ConditionGroup, type ScheduleSpec, triggerFromColumns } from '@sparx/automation-schemas';
import type { PrismaClient } from '@prisma/client';
import type { Prisma } from '@sparx/db';
import { withTenant } from '@sparx/db';

import { evaluateConditions } from '../conditions/evaluate';
import type { EngineDeps, TenantCtx, TriggerEnvelope } from '../engine-types';
import { getScanner } from '../resolvers/registry';
import { installBuiltins } from './install';

export interface ScheduleTickResult {
  automations: number;
  enqueued: number;
}

/** Raw shape returned by `find_active_scheduled_automations` (snake_case). */
interface ScheduledAutomationRow {
  id: string;
  tenant_id: string;
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
    SELECT id, tenant_id, trigger_type, trigger_config, conditions, actions, version
    FROM find_active_scheduled_automations()
  `;
  const autos = rows.map((r) => ({
    id: r.id,
    tenantId: r.tenant_id,
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
      deps.logger.warn({ automationId: a.id }, 'schedule-tick: invalid trigger config — skipping');
      continue;
    }
    if (trigger.kind !== 'schedule') continue;
    if (!isScheduleDue(trigger.schedule, now)) continue;

    result.automations += 1;
    const windowKey = scheduleWindowKey(trigger.schedule, now);
    const conditions = ConditionGroup.safeParse(a.conditions);
    const actionsTotal = Array.isArray(a.actions) ? a.actions.length : 0;

    await withTenant(
      { tenantId: a.tenantId },
      async (tx) => {
        const scanner = getScanner(trigger.predicate.entity);
        if (!scanner) {
          deps.logger.warn(
            { automationId: a.id, entity: trigger.predicate.entity },
            'schedule-tick: no scanner registered for entity — skipping'
          );
          return;
        }
        const ctx: TenantCtx = { tenantId: a.tenantId, tx, deps, causeDepth: 0 };
        const rows = await scanner(ctx);

        for (const row of rows) {
          // The predicate is the SELECTOR; the automation's own conditions are an
          // additional AND post-filter.
          if (!evaluateConditions(trigger.predicate.where, row.fields)) continue;
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

// ─── schedule arithmetic (UTC) ───────────────────────────────────────────────

function minuteOfDayUtc(d: Date): number {
  return d.getUTCHours() * 60 + d.getUTCMinutes();
}

/** Are we at/past the scheduled moment within the current window? Combined with
 *  the window-scoped dedupe this yields exactly-once-per-occurrence firing even
 *  when the scheduler ticks many times. */
function isScheduleDue(schedule: ScheduleSpec, now: Date): boolean {
  switch (schedule.cadence) {
    case 'daily':
      return minuteOfDayUtc(now) >= schedule.atMinuteUtc;
    case 'weekly':
      return now.getUTCDay() === schedule.dayOfWeek && minuteOfDayUtc(now) >= schedule.atMinuteUtc;
    case 'monthly':
      return (
        now.getUTCDate() === schedule.dayOfMonth && minuteOfDayUtc(now) >= schedule.atMinuteUtc
      );
    case 'once':
      return now.getTime() >= new Date(schedule.at).getTime();
    default:
      return false;
  }
}

/** A stable key for the current firing window — `once` fires once ever; the
 *  cadenced schedules fire at most once on their calendar date. */
function scheduleWindowKey(schedule: ScheduleSpec, now: Date): string {
  if (schedule.cadence === 'once') return `once:${schedule.at}`;
  return now.toISOString().slice(0, 10); // YYYY-MM-DD (UTC)
}
