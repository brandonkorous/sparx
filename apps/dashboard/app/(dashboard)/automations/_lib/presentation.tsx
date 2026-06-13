// Presentational helpers for the Automations surface — status badges, module
// tags, and human-readable trigger / condition / action summaries. Pure (no
// hooks, no server-only imports), so both server pages and client components
// render them. The rich rule document is parsed from the stored JSON columns
// with the canonical `@sparx/automation-schemas` parsers (no drift); parsing is
// defensive so a malformed legacy row degrades to a raw view instead of throwing.

import * as React from 'react';
import { Badge } from '@sparx/ui';
import {
  Action as ActionSchema,
  ConditionGroup as ConditionGroupSchema,
  isConditionGroup,
  triggerFromColumns,
} from '@sparx/automation-schemas';
import type {
  Action,
  AutomationStatus,
  Condition,
  ConditionGroup,
  RunStatus,
  ScheduleSpec,
  StepStatus,
  Trigger,
} from '@sparx/automation-schemas';
import {
  DAYS_OF_WEEK,
  actionLabel,
  deriveModules,
  moduleForScanEntity,
  moduleLabel,
  operatorDef,
  primitiveText,
} from './catalog';
import type { ModuleSlug } from './catalog';

// ─── parsing (defensive) ─────────────────────────────────────────────────────

export function parseTrigger(triggerType: string, triggerConfig: unknown): Trigger | null {
  try {
    return triggerFromColumns(triggerType, triggerConfig);
  } catch {
    return null;
  }
}

export function parseConditions(conditions: unknown): ConditionGroup {
  const result = ConditionGroupSchema.safeParse(conditions);
  return result.success ? result.data : { logic: 'AND', conditions: [] };
}

export function parseActions(actions: unknown): Action[] {
  if (!Array.isArray(actions)) return [];
  const parsed: Action[] = [];
  for (const raw of actions) {
    const result = ActionSchema.safeParse(raw);
    if (result.success) parsed.push(result.data);
  }
  return parsed;
}

// ─── time + schedule formatting (deterministic, hydration-safe) ──────────────

const pad = (n: number) => String(n).padStart(2, '0');

/** ISO → `YYYY-MM-DD HH:MM UTC`. Deterministic across server/client (no locale
 *  or timezone), so it never trips React hydration. */
export function formatTimestamp(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(
    d.getUTCHours()
  )}:${pad(d.getUTCMinutes())} UTC`;
}

function minuteToHHMM(minute: number): string {
  return `${pad(Math.floor(minute / 60))}:${pad(minute % 60)}`;
}

export function humanizeSchedule(schedule: ScheduleSpec): string {
  switch (schedule.cadence) {
    case 'daily':
      return `Daily at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
    case 'weekly': {
      const day = DAYS_OF_WEEK.find((d) => d.value === schedule.dayOfWeek)?.label ?? 'day';
      return `Weekly on ${day} at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
    }
    case 'monthly':
      return `Monthly on day ${schedule.dayOfMonth} at ${minuteToHHMM(schedule.atMinuteUtc)} UTC`;
    case 'interval':
      return `Every ${schedule.everyMinutes} min`;
    case 'once':
      return `Once at ${formatTimestamp(schedule.at)}`;
  }
}

/** One-line trigger summary for list rows + chrome. */
export function summarizeTrigger(triggerType: string, triggerConfig: unknown): string {
  const trigger = parseTrigger(triggerType, triggerConfig);
  if (!trigger) return triggerType;
  if (trigger.kind === 'event') return `On ${trigger.eventType}`;
  const entity = SCAN_ENTITY_LABEL[trigger.predicate.entity] ?? trigger.predicate.entity;
  return `${humanizeSchedule(trigger.schedule)} · ${entity}`;
}

const SCAN_ENTITY_LABEL: Record<string, string> = {
  customer: 'customers',
  b2b_account: 'B2B accounts',
};

// ─── status badges ───────────────────────────────────────────────────────────

const AUTOMATION_STATUS: Record<
  AutomationStatus,
  { color: string; variant: string; label: string }
> = {
  active: { color: 'success', variant: 'soft', label: 'Active' },
  paused: { color: 'neutral', variant: 'soft', label: 'Paused' },
  draft: { color: 'neutral', variant: 'outline', label: 'Draft' },
  error: { color: 'danger', variant: 'soft', label: 'Error' },
};

export function AutomationStatusBadge({ status }: { status: AutomationStatus }) {
  const s = AUTOMATION_STATUS[status] ?? AUTOMATION_STATUS.draft;
  return (
    <Badge color={s.color} variant={s.variant as never}>
      {s.label}
    </Badge>
  );
}

const RUN_STATUS: Record<RunStatus, { color: string; variant: string; label: string }> = {
  completed: { color: 'success', variant: 'soft', label: 'Completed' },
  failed: { color: 'danger', variant: 'soft', label: 'Failed' },
  running: { color: 'info', variant: 'soft', label: 'Running' },
  waiting: { color: 'warning', variant: 'soft', label: 'Waiting' },
  skipped: { color: 'neutral', variant: 'outline', label: 'Skipped' },
};

export function RunStatusBadge({ status }: { status: RunStatus }) {
  const s = RUN_STATUS[status] ?? { color: 'neutral', variant: 'outline', label: status };
  return (
    <Badge color={s.color} variant={s.variant as never}>
      {s.label}
    </Badge>
  );
}

const STEP_STATUS: Record<StepStatus, { color: string; variant: string; label: string }> = {
  completed: { color: 'success', variant: 'soft', label: 'Completed' },
  failed: { color: 'danger', variant: 'soft', label: 'Failed' },
  gated: { color: 'warning', variant: 'soft', label: 'Gated' },
  running: { color: 'info', variant: 'soft', label: 'Running' },
  skipped: { color: 'neutral', variant: 'outline', label: 'Skipped' },
  pending: { color: 'neutral', variant: 'outline', label: 'Pending' },
};

export function StepStatusBadge({ status }: { status: StepStatus }) {
  const s = STEP_STATUS[status] ?? { color: 'neutral', variant: 'outline', label: status };
  return (
    <Badge color={s.color} variant={s.variant as never}>
      {s.label}
    </Badge>
  );
}

// ─── module tags + origin ────────────────────────────────────────────────────

export function ModuleTags({
  trigger,
  actions,
}: {
  trigger: { triggerType: string; triggerConfig: unknown };
  actions: readonly { type: string }[];
}) {
  const modules: ModuleSlug[] = deriveModules(
    { triggerType: trigger.triggerType, triggerConfig: trigger.triggerConfig },
    actions
  );
  if (modules.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center gap-1">
      {modules.map((m) => (
        <Badge key={m} color={m} variant="soft" size="sm">
          {moduleLabel(m)}
        </Badge>
      ))}
    </div>
  );
}

export function OriginBadge({ origin, locked }: { origin: string; locked: boolean }) {
  if (locked) {
    return (
      <Badge color="warning" variant="outline" size="sm">
        Locked
      </Badge>
    );
  }
  if (origin === 'system') {
    return (
      <Badge color="neutral" variant="outline" size="sm">
        System
      </Badge>
    );
  }
  return null;
}

// ─── condition + action read views ───────────────────────────────────────────

function conditionValueText(value: unknown): string {
  if (Array.isArray(value)) return value.map(primitiveText).join(', ');
  return primitiveText(value);
}

export function conditionToText(c: Condition): string {
  const op = operatorDef(c.operator);
  const label = op?.label ?? c.operator;
  if (op?.valueless) return `${c.field} ${label}`;
  return `${c.field} ${label} ${conditionValueText(c.value)}`.trim();
}

export function ConditionGroupView({
  group,
  nested = false,
}: {
  group: ConditionGroup;
  nested?: boolean;
}) {
  if (group.conditions.length === 0) {
    return nested ? (
      <span className="text-sm text-[var(--color-text-tertiary)]">(empty group)</span>
    ) : (
      <p className="text-sm text-[var(--color-text-tertiary)]">
        No conditions — runs on every trigger.
      </p>
    );
  }
  const joiner = group.logic;
  return (
    <ul
      className={
        nested
          ? 'flex flex-col gap-1 border-l-2 border-[var(--color-border-default)] pl-3'
          : 'flex flex-col gap-1'
      }
    >
      {group.conditions.map((node, i) => (
        <li key={i} className="flex items-start gap-2 text-sm">
          {i > 0 && (
            <span className="mt-0.5 text-xs font-medium tracking-wide text-[var(--color-text-tertiary)] uppercase">
              {joiner}
            </span>
          )}
          {isConditionGroup(node) ? (
            <ConditionGroupView group={node} nested />
          ) : (
            <code className="rounded bg-[var(--color-bg-subtle)] px-1.5 py-0.5 font-mono text-xs">
              {conditionToText(node as Condition)}
            </code>
          )}
        </li>
      ))}
    </ul>
  );
}

export function actionSummaryText(action: Action): string {
  const cfg = action.config ?? {};
  switch (action.type) {
    case 'platform.wait': {
      const secs = Number((cfg as { delaySeconds?: unknown }).delaySeconds);
      return Number.isFinite(secs) ? `Wait ${secs.toLocaleString()}s` : 'Wait';
    }
    case 'platform.stop':
      return (cfg as { reason?: string }).reason
        ? `Stop — ${(cfg as { reason?: string }).reason}`
        : 'Stop';
    case 'crm.add_tag':
    case 'crm.remove_tag': {
      const tags = (cfg as { tags?: unknown[] }).tags;
      return `${actionLabel(action.type)}: ${Array.isArray(tags) ? tags.join(', ') : ''}`;
    }
    case 'email.send_internal':
      return `Notify ${(cfg as { to?: string }).to ?? 'staff'}`;
    default:
      return actionLabel(action.type);
  }
}

export function ActionListView({ actions }: { actions: readonly Action[] }) {
  if (actions.length === 0) {
    return <p className="text-sm text-[var(--color-text-tertiary)]">No actions.</p>;
  }
  return (
    <ol className="flex flex-col gap-2">
      {actions.map((a, i) => (
        <li key={i} className="flex items-start gap-3 text-sm">
          <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[var(--color-bg-subtle)] text-xs font-medium">
            {i + 1}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="font-medium">{actionSummaryText(a)}</span>
            <span className="font-mono text-xs text-[var(--color-text-tertiary)]">{a.type}</span>
          </div>
        </li>
      ))}
    </ol>
  );
}

// Re-export for chrome that wants the scan-entity module mapping.
export { moduleForScanEntity };
