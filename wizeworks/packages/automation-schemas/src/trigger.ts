// Triggers — what starts an automation (docs/81 §5.2).
//
// Two kinds:
//   • event    — fires off a bus event type (e.g. 'order.placed'). The engine's
//                fan-in delivers these.
//   • schedule — a (schedule, predicate) pair. On each tick the engine runs the
//                predicate query for the tenant and starts ONE run per matched
//                row (inactivity etc. have no per-record event — docs/81 §5.2).
//
// The `automations` row stores a flat `trigger_type` (varchar) + `trigger_config`
// (jsonb); `triggerToColumns` / `triggerFromColumns` map between the rich union
// and that storage shape.

import { z } from 'zod';

import { ConditionGroup } from './condition';

/** Minute-of-day in UTC (0–1439); sub-minute scheduling is excluded by design. */
export const MinuteOfDayUtc = z.number().int().min(0).max(1439);

export const ScheduleSpec = z.discriminatedUnion('cadence', [
  z.object({ cadence: z.literal('daily'), atMinuteUtc: MinuteOfDayUtc.default(0) }),
  z.object({
    cadence: z.literal('weekly'),
    dayOfWeek: z.number().int().min(0).max(6), // 0 = Sunday
    atMinuteUtc: MinuteOfDayUtc.default(0),
  }),
  z.object({
    cadence: z.literal('monthly'),
    dayOfMonth: z.number().int().min(1).max(28), // capped at 28 to dodge month-length edges
    atMinuteUtc: MinuteOfDayUtc.default(0),
  }),
  // Sub-daily recurring scan — fires every `everyMinutes` (on UTC minute
  // boundaries) and dedupes ONCE PER ENTITY (not per calendar window), so a
  // transient row (a cold cart, an unresponded chat) triggers a single run rather
  // than re-firing every interval it stays in the scan window. The daily/weekly/
  // monthly cadences can't express "nudge ~2h after a cart goes cold".
  z.object({
    cadence: z.literal('interval'),
    everyMinutes: z.number().int().min(1).max(1440),
  }),
  z.object({ cadence: z.literal('once'), at: z.string().datetime() }),
]);
export type ScheduleSpec = z.infer<typeof ScheduleSpec>;

// A scheduled trigger scans an entity type and matches rows against a predicate.
// `entity` names a resolver entity type (e.g. 'customer'); `where` is evaluated
// the same way conditions are, but as the SELECTOR rather than a post-filter.
export const PredicateSpec = z.object({
  entity: z.string().min(1).max(64),
  where: ConditionGroup,
});
export type PredicateSpec = z.infer<typeof PredicateSpec>;

export const Trigger = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('event'), eventType: z.string().min(1).max(100) }),
  z.object({ kind: z.literal('schedule'), schedule: ScheduleSpec, predicate: PredicateSpec }),
]);
export type Trigger = z.infer<typeof Trigger>;

/** Flatten a trigger into the `automations.trigger_type` + `trigger_config` columns. */
export function triggerToColumns(t: Trigger): {
  triggerType: string;
  triggerConfig: Record<string, unknown>;
} {
  if (t.kind === 'event') {
    return { triggerType: t.eventType, triggerConfig: {} };
  }
  return {
    triggerType: `schedule.${t.schedule.cadence}`,
    triggerConfig: { schedule: t.schedule, predicate: t.predicate },
  };
}

/** Rebuild a trigger from its stored columns (round-trips `triggerToColumns`). */
export function triggerFromColumns(triggerType: string, triggerConfig: unknown): Trigger {
  if (triggerType.startsWith('schedule.')) {
    const cfg = (triggerConfig ?? {}) as { schedule?: unknown; predicate?: unknown };
    return Trigger.parse({ kind: 'schedule', schedule: cfg.schedule, predicate: cfg.predicate });
  }
  return Trigger.parse({ kind: 'event', eventType: triggerType });
}
